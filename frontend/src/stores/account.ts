import { defineStore } from 'pinia'
import { db } from '@/db'
import { api, type SyncChange } from '@/services/api'
import type { Account } from '@/types/models'

/**
 * 账号与云端同步（§3.3 / §4.8）
 * 本地优先：未登录时全部数据保存在 IndexedDB 完整可用；
 * 登录后可将本地数据同步备份到后端网关。
 */

type SyncEntity = SyncChange['entity']
type SyncTable = 'projects' | 'folders' | 'notes' | 'snapshots' | 'annotations'

const TABLE_MAP: Record<SyncEntity, SyncTable> = {
  project: 'projects',
  folder: 'folders',
  note: 'notes',
  snapshot: 'snapshots',
  annotation: 'annotations'
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
     * 一键同步：先拉取云端增量合并到本地，再把本地全量推送到云端
     * （远端更新优先；本地数据在下次编辑后再次推送覆盖）
     */
    async syncNow(): Promise<void> {
      if (!this.account) throw new Error('请先登录')
      this.syncing = true
      try {
        const token = this.account.token
        // 1) 拉取远端变更并合并到本地
        const { changes } = await api.pull(token, 0)
        for (const c of changes) {
          const table = TABLE_MAP[c.entity]
          if (!table || !c.data?.id) continue
          if (c.op === 'delete') {
            await (db[table] as any).delete(c.data.id as string)
          } else {
            const local = await (db[table] as any).get(c.data.id)
            if (!local || (c.data.updatedAt as number) > (local.updatedAt as number)) {
              await (db[table] as any).put(c.data)
            }
          }
        }
        // 2) 推送本地全量（幂等 id 由实体 + id + updatedAt 组成）
        const localChanges: SyncChange[] = []
        for (const [entity, table] of Object.entries(TABLE_MAP) as [SyncEntity, SyncTable][]) {
          const rows = await (db[table] as any).toArray()
          for (const row of rows) {
            localChanges.push({
              id: `push:${entity}:${row.id}:${row.updatedAt}`,
              entity,
              op: 'upsert',
              data: { ...row },
              updatedAt: row.updatedAt ?? Date.now()
            })
          }
        }
        const { accepted } = await api.push(token, localChanges)
        this.lastSyncAt = Date.now()
        this.lastSyncCount = accepted
      } finally {
        this.syncing = false
      }
    }
  }
})
