import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

/**
 * 全局数据库模块（§3.4 生产持久化）
 * 提供 PostgreSQL 连接池（DATABASE_URL）；未配置时服务自动退化为内存模式
 */
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
