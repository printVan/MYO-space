import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service.js';

export type SyncEntity = 'project' | 'folder' | 'note' | 'snapshot' | 'annotation';

export interface SyncChange {
  /** 客户端生成的变化 id（幂等去重） */
  id: string;
  entity: SyncEntity;
  op: 'upsert' | 'delete';
  /** upsert 时携带完整业务对象（含 updatedAt 时间戳） */
  data?: Record<string, unknown>;
  updatedAt: number;
}

/**
 * 增量同步服务（§4.8）
 * 本地为真相源；记录变更时间戳，只同步变更内容；
 * 版本快照作为普通业务数据参与同步；多端冲突由前端 diff 手动选择，后端不做合并
 *
 * 双模式：
 * - 配置 DATABASE_URL → PostgreSQL（sync_changes 表，ON CONFLICT 幂等）
 * - 未配置 → 内存 Map（开发环境）
 */
@Injectable()
export class SyncService implements OnModuleDestroy {
  /** 内存模式：userId -> 按更新时间排序的变更记录 */
  private store = new Map<string, SyncChange[]>();
  /** 内存模式：userId -> 已见 change id 集合（幂等） */
  private seen = new Map<string, Set<string>>();

  constructor(private db: DatabaseService) {}

  private get usePg(): boolean {
    return this.db.isEnabled;
  }

  /** 客户端推送变更（增量，幂等） */
  async push(userId: string, changes: SyncChange[]): Promise<{ accepted: number }> {
    // 修复 BUG-04：项目密码改为 bcrypt 哈希后存储（前端仅用 truthiness 判断是否密码保护，不回显）
    const secured = changes.map((c) => {
      if (c.entity === 'project' && c.op === 'upsert' && c.data?.password) {
        const pwd = String(c.data.password);
        if (!pwd.startsWith('$2')) {
          return { ...c, data: { ...c.data, password: bcrypt.hashSync(pwd, 10) } };
        }
      }
      return c;
    });
    if (this.usePg) {
      // PG 模式：ON CONFLICT (id) DO NOTHING 天然幂等去重
      let accepted = 0;
      for (const change of secured) {
        if (!change?.id) continue;
        const data = change.data ?? null;
        const res = await this.db.query<{ id: string }>(
          `INSERT INTO sync_changes (id, user_id, entity, op, data, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [change.id, userId, change.entity, change.op, data, change.updatedAt],
        );
        accepted += res.rowCount ?? 0;
      }
      return { accepted };
    }

    // 内存模式（原有逻辑）
    let list = this.store.get(userId);
    let seen = this.seen.get(userId);
    if (!list) {
      list = [];
      this.store.set(userId, list);
    }
    if (!seen) {
      seen = new Set();
      this.seen.set(userId, seen);
    }
    let accepted = 0;
    for (const change of secured) {
      if (!change?.id) continue;
      if (seen.has(change.id)) continue;
      seen.add(change.id);
      list.push(change);
      accepted++;
    }
    list.sort((a, b) => a.updatedAt - b.updatedAt);
    return { accepted };
  }

  /** 拉取自 since 时间戳以来的全部变更 */
  async pull(userId: string, since = 0): Promise<{ changes: SyncChange[]; serverTime: number }> {
    if (this.usePg) {
      const res = await this.db.query<SyncChange>(
        `SELECT id, entity, op, data, updated_at AS "updatedAt"
         FROM sync_changes
         WHERE user_id = $1 AND updated_at > $2
         ORDER BY updated_at ASC`,
        [userId, since],
      );
      return { changes: res.rows, serverTime: Date.now() };
    }

    const list = this.store.get(userId) ?? [];
    const changes = list.filter((c) => c.updatedAt > since);
    return { changes, serverTime: Date.now() };
  }

  /** 服务端存储的公开项目（供云端公开页查询，取每个项目最新版本） */
  async listPublicProjects(): Promise<Record<string, unknown>[]> {
    if (this.usePg) {
      const res = await this.db.query<{ data: Record<string, unknown> }>(
        `SELECT DISTINCT ON (data->>'id') data
         FROM sync_changes
         WHERE entity = 'project' AND op = 'upsert' AND data->>'visibility' = 'public'
         ORDER BY data->>'id', updated_at DESC`,
      );
      return res.rows.map((r) => r.data);
    }

    const result: Record<string, unknown>[] = [];
    for (const list of this.store.values()) {
      for (const change of list) {
        if (change.entity !== 'project' || change.op !== 'upsert') continue;
        const data = change.data ?? {};
        if (data.visibility === 'public') {
          result.push(data);
        }
      }
    }
    return result;
  }

  /** 查找某个项目记录（含密码，用于公开密码校验，取最新版本） */
  async findProject(projectId: string): Promise<Record<string, unknown> | null> {
    if (this.usePg) {
      const res = await this.db.query<{ data: Record<string, unknown> }>(
        `SELECT data
         FROM sync_changes
         WHERE entity = 'project' AND op = 'upsert' AND data->>'id' = $1
         ORDER BY updated_at DESC
         LIMIT 1`,
        [projectId],
      );
      return res.rows[0]?.data ?? null;
    }

    for (const list of this.store.values()) {
      for (const change of list) {
        if (change.entity === 'project' && change.op === 'upsert' && change.data?.id === projectId) {
          return change.data;
        }
      }
    }
    return null;
  }

  async onModuleDestroy(): Promise<void> {
    this.store.clear();
    this.seen.clear();
  }
}
