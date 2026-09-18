import Dexie, { type Table } from 'dexie'
import type {
  Project,
  FolderNode,
  Note,
  Snapshot,
  Annotation,
  Preference,
  Account
} from '@/types/models'

/**
 * 本地优先存储层
 * 未登录账号时全部能力可用，数据保存在 IndexedDB；
 * 后端仅作为同步备份网关（§1 / §2.1）
 */
class MyOSpaceDB extends Dexie {
  projects!: Table<Project, string>
  folders!: Table<FolderNode, string>
  notes!: Table<Note, string>
  snapshots!: Table<Snapshot, string>
  annotations!: Table<Annotation, string>
  preferences!: Table<Preference, string>
  accounts!: Table<Account, string>

  constructor() {
    super('myblog-db') // 库名保持不变：改名会导致 IndexedDB 数据丢失
    this.version(1).stores({
      projects: 'id, name, visibility, updatedAt',
      folders: 'id, projectId, parentId, [projectId+parentId]',
      notes: 'id, projectId, folderId, title, visibility, pinned, updatedAt, [projectId+pinned], [projectId+folderId]',
      snapshots: 'id, noteId, kind, createdAt, [noteId+kind]',
      annotations: 'id, noteId, order, [noteId+order]',
      preferences: 'key',
      accounts: 'id'
    })
  }
}

export const db = new MyOSpaceDB()

export const tables = db
