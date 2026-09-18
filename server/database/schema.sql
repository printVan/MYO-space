-- MyBlog 后端 PostgreSQL 数据库结构（§3.4）
-- 数据库：账号、元数据；大文本对象存放对象存储 OSS
-- 说明：当前后端实现为内存存储（同步网关），接入 PostgreSQL 时执行本脚本并替换数据服务实现

CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(40) PRIMARY KEY,
  username      VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(128) NOT NULL,
  created_at    BIGINT NOT NULL
);

-- 同步变更记录（增量同步，本地为真相源）
CREATE TABLE IF NOT EXISTS sync_changes (
  id         VARCHAR(48) PRIMARY KEY,          -- 客户端生成，幂等
  user_id    VARCHAR(40) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity     VARCHAR(24) NOT NULL,             -- project / folder / note / snapshot / annotation
  op         VARCHAR(8) NOT NULL,              -- upsert / delete
  data       JSONB,                            -- upsert 时完整业务对象
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_changes_user_time
  ON sync_changes (user_id, updated_at);

-- 公开项目密码校验缓存（可选）：从同步数据中物化的公开项目视图
CREATE TABLE IF NOT EXISTS public_projects (
  project_id  VARCHAR(48) PRIMARY KEY,
  data        JSONB NOT NULL,
  password    VARCHAR(128)
);
