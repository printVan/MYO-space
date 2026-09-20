import { defineStore } from 'pinia'
import { db } from '@/db'
import { api, type SyncChange } from '@/services/api'
import type { Account } from '@/types/models'

/**
 * 账号与云端同步（v1.1 改造）
 * - 仅同步：只 push 本地新增/修改，不 pull，不持久化 token
 * - 登录：三选一（取消登录/覆盖本地/推送云端），存 token
 * - 本地废弃 snapshots 表，快照由云端自动生成
 */

type SyncEntity = Exclude<SyncChange['entity'], 'snapshot'>
type SyncTable = 'projects' | 'folders' | 'notes' | 'annotations'

const TABLE_MAP: Record<SyncEntity, SyncTable> = {
  project: 'projects',
  folder: 'folders',
  note: 'notes',
  annotation: 'annotations'
}

export interface DiffItem {
  change: SyncChange
  /** 用于 UI 展示的名称 */
  label: string
  status: 'new' | 'modified'
}

export const useAccountStore = defineStore('account', {
  state: () => ({
    account: null as Account | null,
    syncing: false,
    lastSyncAt: 0,
    lastSyncCount: 0
  }),

  getters: {
    isLoggedIn: (s) => !!s.account,
    username: (s) => s.account?.username ?? '',
    initial: (s) => (s.account?.username?.[0] ?? '').toUpperCase(),
    syncStatusText: (s) => {
      if (!s.account) return '未登录'
      if (s.syncing) return '同步中…'
      if (s.lastSyncAt) return `已同步 ${s.lastSyncCount} 条`
      return '已登录 · 待同步'
    }
  },

  actions: {
    async init() {
      this.account = (await db.accounts.toArray())[0] ?? null
    },

    async login(username: string, password: string) {
      const res = await api.login(username, password)
      await this.persistAccount(res.user.username, res.accessToken)
    },

    async register(username: string, password: string) {
      const res = await api.register(username, password)
      await this.persistAccount(res.user.username, res.accessToken)
    },

    async persistAccount(username: string, token: string) {
      const acc: Account = {
        id: 'main',
        username,
        token,
        syncEnabled: true,
        updatedAt: Date.now()
      }
      await db.accounts.put(acc)
      this.account = acc
    },

    async logout() {
      await db.accounts.clear()
      this.account = null
      this.lastSyncAt = 0
      this.lastSyncCount = 0
    },

    /**
     * 收集本地未同步的变更（v1.1: 不含 snapshots，因为废弃）
     * 只 push synced !== true 的行，已同步的不再重复推。
     */
    async collectLocalChanges(): Promise<DiffItem[]> {
      const items: DiffItem[] = []
      for (const [entity, table] of Object.entries(TABLE_MAP) as [SyncEntity, SyncTable][]) {
        const rows = await (db[table] as any).toArray()
        for (const row of rows) {
          if (row.synced === true) continue
          const updatedAt = row.updatedAt ?? Date.now()
          items.push({
            change: {
              id: `push:${entity}:${row.id}:${updatedAt}`,
              entity,
              op: 'upsert',
              data: { ...row },
              updatedAt
            },
            label: (row.title || row.name || row.id) as string,
            status: 'new' as const
          })
        }
      }
      return items
    },

    /**
     * 仅同步：只 push 选中的本地变更，不 pull，不持久化 token
     * 用于"不登录但备份到云端"场景
     */
    async pushOnly(token: string, changes: SyncChange[]): Promise<{ accepted: number }> {
      this.syncing = true
      try {
        const result = await api.push(token, changes)
        return result
      } finally {
        this.syncing = false
      }
    },

    /**
     * 登录模式：用云端数据覆盖本地
     * 拉云端所有变更，按 LWW 覆盖本地
     */
    async overwriteFromCloud(token: string): Promise<void> {
      this.syncing = true
      try {
        const { changes } = await api.pull(token, 0)
        for (const c of changes) {
          const table = TABLE_MAP[c.entity as SyncEntity]
          if (!table || !c.data?.id) continue
          if (c.op === 'delete') {
            await (db[table] as any).delete(c.data.id as string)
          } else {
            await (db[table] as any).put(c.data)
          }
        }
      } finally {
        this.syncing = false
      }
    },

    /**
     * 已登录状态下手动同步：push 本地变更（云端自动存快照）
     */
    async syncNow(): Promise<void> {
      if (!this.account) throw new Error('请先登录')
      const changes = await this.collectLocalChanges()
      const { accepted } = await this.pushOnly(this.account.token, changes.map((i) => i.change))
      // push 成功后，把本地所有数据标记为已同步
      for (const table of Object.values(TABLE_MAP) as SyncTable[]) {
        const rows = await (db[table] as any).toArray()
        for (const row of rows) {
          if (!row.synced) {
            await (db[table] as any).put({ ...row, synced: true })
          }
        }
      }
      this.lastSyncAt = Date.now()
      this.lastSyncCount = accepted
    }
  }
})
