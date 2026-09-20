import { db } from '@/db'
import { genId } from '@/utils/id'
import type { Note } from '@/types/models'
import { DEFAULT_PUBLIC_PROJECT_ID, DEFAULT_PRIVATE_PROJECT_ID } from './projects'
import { useAccountStore } from '@/stores/account'

/** 创建笔记 */
export async function createNote(data: {
  projectId: string
  folderId: string | null
  title: string
  content?: string
  visibility?: 'public' | 'private'
}): Promise<Note> {
  const now = Date.now()
  // 登录状态下创建的文件自带已同步标识
  const account = useAccountStore().account
  const note: Note = {
    id: genId('n_'),
    projectId: data.projectId,
    folderId: data.folderId,
    title: data.title.replace(/\.md$/i, ''),
    content: data.content ?? '',
    visibility: data.visibility ?? 'private',
    pinned: false,
    topics: [],
    synced: !!account,
    createdAt: now,
    updatedAt: now
  }
  await db.notes.add(note)
  return note
}

/** 读取笔记 */
export async function getNote(id: string): Promise<Note | undefined> {
  return db.notes.get(id)
}

/** 保存笔记正文（含自动草稿保存；实质变更的快照由调用方触发） */
export async function saveNoteContent(id: string, content: string): Promise<void> {
  await db.notes.update(id, { content, updatedAt: Date.now() })
}

/** 更新笔记元信息（标题 / 权限 / 置顶 / topic） */
export async function updateNoteMeta(id: string, patch: Partial<Note>): Promise<void> {
  await db.notes.update(id, { ...patch, updatedAt: Date.now() })
}

/** 重命名笔记 */
export async function renameNote(id: string, title: string): Promise<void> {
  await db.notes.update(id, { title: title.replace(/\.md$/i, ''), updatedAt: Date.now() })
}

/** 移动笔记（项目内换文件夹） */
export async function moveNote(id: string, folderId: string | null): Promise<void> {
  await db.notes.update(id, { folderId, updatedAt: Date.now() })
}

/** 删除笔记（级联删除快照与补充区） */
export async function deleteNote(id: string): Promise<void> {
  await db.transaction('rw', [db.notes, db.snapshots, db.annotations], async () => {
    await db.notes.delete(id)
    await db.snapshots.where('noteId').equals(id).delete()
    await db.annotations.where('noteId').equals(id).delete()
  })
}

/** 项目内的公开笔记（公开博客项目页数据源） */
export async function listPublicNotes(projectId: string, folderId: string | null = null): Promise<Note[]> {
  const all = await db.notes.toArray()
  return all.filter((n) => n.projectId === projectId && (n.folderId ?? null) === (folderId ?? null) && n.visibility === 'public')
}

/** 项目笔记总数（公开页展示） */
export async function countProjectNotes(projectId: string): Promise<number> {
  return db.notes.where('projectId').equals(projectId).count()
}

/** v1.1: 首页近期文件——按更新时间倒序取最近 N 条 */
export async function listRecentNotes(limit = 50): Promise<Note[]> {
  const all = await db.notes.orderBy('updatedAt').reverse().toArray()
  // 置顶优先，再按更新时间
  all.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.updatedAt - a.updatedAt
  })
  return all.slice(0, limit)
}

/** v1.1: 跨项目移动笔记（同属性项目间，直接改 projectId/folderId） */
export async function moveNoteToProject(
  noteId: string,
  targetProjectId: string,
  targetFolderId: string | null
): Promise<void> {
  await db.notes.update(noteId, {
    projectId: targetProjectId,
    folderId: targetFolderId,
    updatedAt: Date.now()
  })
}

/**
 * v1.1: 私密 → 公开（简化逻辑）
 * 本质：直接把文件移动到"我的公开空间"根目录，visibility 改为 public
 * 内容/快照/时间戳都不变
 */
export async function makeNotePublic(noteId: string): Promise<void> {
  await db.notes.update(noteId, {
    projectId: DEFAULT_PUBLIC_PROJECT_ID,
    folderId: null,
    visibility: 'public',
    updatedAt: Date.now()
  })
}

/**
 * v1.1: 公开 → 私密（简化逻辑）
 * 本质：直接把文件移动到"我的私密空间"根目录，visibility 改为 private
 * 内容/快照/时间戳都不变
 */
export async function makeNotePrivate(noteId: string): Promise<void> {
  await db.notes.update(noteId, {
    projectId: DEFAULT_PRIVATE_PROJECT_ID,
    folderId: null,
    visibility: 'private',
    updatedAt: Date.now()
  })
}

/** v1.1: 列出某项目下所有笔记（用于移动选择目标） */
export async function listNotesInProject(projectId: string): Promise<Note[]> {
  return db.notes.where('projectId').equals(projectId).toArray()
}
