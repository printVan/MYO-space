import { db } from '@/db'
import { genId } from '@/utils/id'
import type { Note } from '@/types/models'

/** 创建笔记 */
export async function createNote(data: {
  projectId: string
  folderId: string | null
  title: string
  content?: string
  visibility?: 'public' | 'private'
}): Promise<Note> {
  const now = Date.now()
  const note: Note = {
    id: genId('n_'),
    projectId: data.projectId,
    folderId: data.folderId,
    title: data.title.replace(/\.md$/i, ''),
    content: data.content ?? '',
    visibility: data.visibility ?? 'public',
    pinned: false,
    topics: [],
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

/** 移动笔记（拖拽到其他文件夹） */
export async function moveNote(id: string, folderId: string | null): Promise<void> {
  await db.notes.update(id, { folderId, updatedAt: Date.now() })
}

/** 删除笔记（级联删除快照与补充区） */
export async function deleteNote(id: string): Promise<void> {
  await db.transaction('rw', db.notes, db.snapshots, db.annotations, async () => {
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
