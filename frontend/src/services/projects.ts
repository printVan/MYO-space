import { db } from '@/db'
import { genId } from '@/utils/id'
import type { Project } from '@/types/models'

/** 创建项目 */
export async function createProject(data: {
  name: string
  description?: string
  visibility?: 'public' | 'private'
  password?: string | null
  topics?: string[]
}): Promise<Project> {
  const now = Date.now()
  const project: Project = {
    id: genId('p_'),
    name: data.name,
    description: data.description ?? '',
    visibility: data.visibility ?? 'private',
    password: data.password ?? null,
    topics: data.topics ?? [],
    createdAt: now,
    updatedAt: now
  }
  await db.projects.add(project)
  return project
}

/** 读取单个项目 */
export async function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id)
}

/** 更新项目（含权限 / 密码 / topic 标签） */
export async function updateProject(id: string, patch: Partial<Project>): Promise<void> {
  const now = Date.now()
  await db.projects.update(id, { ...patch, updatedAt: now })
}

/** 删除项目（级联删除目录树、笔记、快照、补充区） */
export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', db.projects, db.folders, db.notes, db.snapshots, db.annotations, async () => {
    await db.projects.delete(id)
    await db.folders.where('projectId').equals(id).delete()
    const noteIds = await db.notes.where('projectId').equals(id).primaryKeys()
    await db.notes.where('projectId').equals(id).delete()
    if (noteIds.length) {
      await db.snapshots.where('noteId').anyOf(noteIds).delete()
      await db.annotations.where('noteId').anyOf(noteIds).delete()
    }
  })
}

/** 全部项目列表（按更新时间倒序） */
export async function listProjects(): Promise<Project[]> {
  return db.projects.orderBy('updatedAt').reverse().toArray()
}
