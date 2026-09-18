import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';

/**
 * PostgreSQL 连接服务
 * - 配置 DATABASE_URL 时启用 PG（生产）；否则 isEnabled=false（开发环境内存模式）
 * - 启动时自动执行 schema.sql 中的建表语句（幂等，CREATE TABLE IF NOT EXISTS）
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool | null = null;
  readonly isEnabled: boolean;

  constructor() {
    const url = process.env.DATABASE_URL;
    this.isEnabled = Boolean(url);
    if (url) {
      this.pool = new Pool({
        connectionString: url,
        ssl: { rejectUnauthorized: false },
        max: 10,
        connectionTimeoutMillis: 15_000,
        idleTimeoutMillis: 30_000,
        maxUses: 7_500,
      });
      this.logger.log('PostgreSQL 连接池已启用（生产持久化模式）');
      void this.initSchema();
    } else {
      this.logger.log('未配置 DATABASE_URL，使用内存模式（开发环境）');
    }
  }

  /** 执行 schema.sql 建表（幂等） */
  private async initSchema(): Promise<void> {
    try {
      await this.query(`
        CREATE TABLE IF NOT EXISTS users (
          id            VARCHAR(40) PRIMARY KEY,
          username      VARCHAR(64) NOT NULL UNIQUE,
          password_hash VARCHAR(128) NOT NULL,
          created_at    BIGINT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sync_changes (
          id         VARCHAR(48) PRIMARY KEY,
          user_id    VARCHAR(40) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          entity     VARCHAR(24) NOT NULL,
          op         VARCHAR(8) NOT NULL,
          data       JSONB,
          updated_at BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sync_changes_user_time
          ON sync_changes (user_id, updated_at);
      `);
      this.logger.log('数据库表结构就绪（users / sync_changes）');
    } catch (err) {
      this.logger.error('初始化数据库表结构失败', err as Error);
    }
  }

  /** 执行 SQL（参数化），PG 未启用时抛错；T 为行数据类型，返回 rows */
  async query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    if (!this.pool) throw new Error('DATABASE_URL 未配置，PostgreSQL 不可用');
    return this.pool.query(sql, params) as Promise<QueryResult<T>>;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
