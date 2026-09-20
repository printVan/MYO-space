import { db } from '@/db'
import { genId } from '@/utils/id'
import type { Project } from '@/types/models'
import { useAccountStore } from '@/stores/account'

/** v1.1: 两个固定默认项目 */
export const DEFAULT_PRIVATE_PROJECT_ID = 'p_default_workspace'
export const DEFAULT_PRIVATE_PROJECT_NAME = '我的私密空间'
export const DEFAULT_PUBLIC_PROJECT_ID = 'p_public_space'
export const DEFAULT_PUBLIC_PROJECT_NAME = '我的公开空间'

/** 创建项目 */
export async function createProject(data: {
  name: string
  description?: string
  visibility?: 'public' | 'private'
  password?: string | null
  topics?: string[]
}): Promise<Project> {
  const now = Date.now()
  // 登录状态下创建的项目自带已同步标识
  const account = useAccountStore().account
  const project: Project = {
    id: genId('p_'),
    name: data.name,
    description: data.description ?? '',
    visibility: data.visibility ?? 'private',
    password: data.password ?? null,
    topics: data.topics ?? [],
    synced: !!account,
    createdAt: now,
    updatedAt: now
  }
  await db.projects.add(project)
  return project
}

/** v1.1: 确保两个默认项目都存在（启动时调用，不可删除） */
export async function ensureDefaultProjects(): Promise<void> {
  const now = Date.now()
  const priv = await db.projects.get(DEFAULT_PRIVATE_PROJECT_ID)
  if (!priv) {
    await db.projects.add({
      id: DEFAULT_PRIVATE_PROJECT_ID,
      name: DEFAULT_PRIVATE_PROJECT_NAME,
      description: '默认私密空间，快速笔记默认存这里',
      visibility: 'private',
      password: null,
      topics: [],
      createdAt: now,
      updatedAt: now
    })
  }
  const pub = await db.projects.get(DEFAULT_PUBLIC_PROJECT_ID)
  if (!pub) {
    await db.projects.add({
      id: DEFAULT_PUBLIC_PROJECT_ID,
      name: DEFAULT_PUBLIC_PROJECT_NAME,
      description: '默认公开空间，公开笔记自动同步到这里',
      visibility: 'public',
      password: null,
      topics: [],
      createdAt: now,
      updatedAt: now
    })
  }
}

/** v1.1: 是否默认项目（任一） */
export function isDefaultProject(id: string): boolean {
  return id === DEFAULT_PRIVATE_PROJECT_ID || id === DEFAULT_PUBLIC_PROJECT_ID
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

/** 删除项目（级联删除目录树、笔记、补充区；默认项目不可删） */
export async function deleteProject(id: string): Promise<void> {
  if (isDefaultProject(id)) {
    throw new Error('默认项目不可删除')
  }
  await db.transaction('rw', [db.projects, db.folders, db.notes, db.snapshots, db.annotations], async () => {
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
