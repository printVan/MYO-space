import { db } from '@/db'
import { genId } from '@/utils/id'
import type { FolderNode, Note } from '@/types/models'

export interface FileEntry {
  kind: 'folder' | 'note'
  id: string
  name: string
  /** 文件夹：子文件数；笔记：更新时间 */
  meta?: { noteCount?: number; updatedAt?: number; pinned?: boolean; summary?: string }
}

/** 取笔记内容首行作为更新摘要（去 markdown 标记，截断 60 字） */
export function summarizeContent(content: string | undefined): string {
  if (!content) return ''
  const line = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !/^[-*_#>|`~]/.test(l))
  if (!line) return ''
  const plain = line.replace(/[*_`~]/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  return plain.length > 60 ? plain.slice(0, 60) + '…' : plain
}

/** 创建文件夹（无限层级） */
export async function createFolder(projectId: string, parentId: string | null, name: string): Promise<FolderNode> {
  const now = Date.now()
  const folder: FolderNode = {
    id: genId('f_'),
    projectId,
    parentId,
    name,
    createdAt: now,
    updatedAt: now
  }
  await db.folders.add(folder)
  return folder
}

/** 重命名文件夹 */
export async function renameFolder(id: string, name: string): Promise<void> {
  await db.folders.update(id, { name, updatedAt: Date.now() })
}

/** 删除文件夹（级联删除子树与内部笔记） */
export async function deleteFolder(id: string): Promise<void> {
  const folder = await db.folders.get(id)
  if (!folder) return
  // 找出所有子孙文件夹 id
  const allFolders = await db.folders.where('projectId').equals(folder.projectId).toArray()
  const descIds = collectDescendantIds(id, allFolders)
  const folderIds = [id, ...descIds]
  await db.transaction('rw', db.folders, db.notes, db.snapshots, db.annotations, async () => {
    await db.folders.bulkDelete(folderIds)
    const noteIds = await db.notes.where('folderId').anyOf(folderIds).primaryKeys()
    await db.notes.where('folderId').anyOf(folderIds).delete()
    if (noteIds.length) {
      await db.snapshots.where('noteId').anyOf(noteIds).delete()
      await db.annotations.where('noteId').anyOf(noteIds).delete()
    }
  })
}

/** 收集文件夹的所有子孙 id */
function collectDescendantIds(rootId: string, all: FolderNode[]): string[] {
  const result: string[] = []
  const walk = (pid: string) => {
    for (const f of all) {
      if (f.parentId === pid) {
        result.push(f.id)
        walk(f.id)
      }
    }
  }
  walk(rootId)
  return result
}

/** 移动文件夹（拖拽） */
export async function moveFolder(id: string, newParentId: string | null): Promise<void> {
  const folder = await db.folders.get(id)
  if (!folder || folder.parentId === newParentId) return
  // 防止移动到自己的子孙目录下造成环
  if (newParentId) {
    const all = await db.folders.where('projectId').equals(folder.projectId).toArray()
    if (collectDescendantIds(id, all).includes(newParentId)) {
      throw new Error('不能移动到自己的子目录内')
    }
  }
  await db.folders.update(id, { parentId: newParentId, updatedAt: Date.now() })
}

/** 获取文件夹的直接子条目（文件夹优先，笔记按置顶+更新时间排序） */
export async function listFolderEntries(projectId: string, folderId: string | null): Promise<FileEntry[]> {
  const allFolders = await db.folders.where('projectId').equals(projectId).toArray()
  const folders = allFolders.filter((f) => (f.parentId ?? null) === (folderId ?? null)).sort((a, b) => a.name.localeCompare(b.name))
  const notes = (await db.notes.toArray()).filter((n) => n.projectId === projectId && (n.folderId ?? null) === (folderId ?? null))
  notes.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.updatedAt - a.updatedAt
  })
  const entries: FileEntry[] = []
  for (const f of folders) {
    const childNotes = await db.notes.where('folderId').equals(f.id).count()
    const childFolders = await db.folders.where('parentId').equals(f.id).count()
    entries.push({ kind: 'folder', id: f.id, name: f.name, meta: { noteCount: childNotes + childFolders } })
  }
  for (const n of notes) {
    entries.push({
      kind: 'note',
      id: n.id,
      name: n.title.endsWith('.md') ? n.title : `${n.title}.md`,
      meta: { updatedAt: n.updatedAt, pinned: n.pinned, summary: summarizeContent(n.content) }
    })
  }
  return entries
}

/** 构建项目完整目录树（用于抽屉展示） */
export interface TreeItem {
  id: string
  name: string
  kind: 'folder' | 'note'
  children: TreeItem[]
}

export async function buildProjectTree(projectId: string): Promise<TreeItem[]> {
  const folders = await db.folders.where('projectId').equals(projectId).toArray()
  const notes = await db.notes.where('projectId').equals(projectId).toArray()
  const notesByFolder = new Map<string | null, Note[]>()
  for (const n of notes) {
    const key = n.folderId
    if (!notesByFolder.has(key)) notesByFolder.set(key, [])
    notesByFolder.get(key)!.push(n)
  }
  const folderChildren = new Map<string | null, FolderNode[]>()
  for (const f of folders) {
    const key = f.parentId
    if (!folderChildren.has(key)) folderChildren.set(key, [])
    folderChildren.get(key)!.push(f)
  }
  const buildFolder = (parentId: string | null): TreeItem[] => {
    const result: TreeItem[] = []
    const subs = (folderChildren.get(parentId) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name))
    for (const f of subs) {
      result.push({ id: f.id, name: f.name, kind: 'folder', children: buildFolder(f.id) })
    }
    const ns = (notesByFolder.get(parentId) ?? []).slice().sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updatedAt - a.updatedAt
    })
    for (const n of ns) {
      result.push({
        id: n.id,
        name: n.title.endsWith('.md') ? n.title : `${n.title}.md`,
        kind: 'note',
        children: []
      })
    }
    return result
  }
  return buildFolder(null)
}
