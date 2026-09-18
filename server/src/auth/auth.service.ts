import { Injectable, UnauthorizedException, ConflictException, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service.js';
import type { JwtUser } from '../common/current-user.decorator.js';

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: number;
}

/**
 * 账号服务（§3.3 账号鉴权 JWT）
 * 双模式：
 * - 配置 DATABASE_URL → PostgreSQL（生产持久化，users 表）
 * - 未配置 → 内存 Map（开发环境，重启即清空）
 */
@Injectable()
export class AuthService implements OnModuleDestroy {
  /** 内存模式账号存储（开发环境） */
  private users = new Map<string, UserRecord>();

  constructor(
    private jwt: JwtService,
    private db: DatabaseService,
  ) {}

  private get usePg(): boolean {
    return this.db.isEnabled;
  }

  async register(username: string, password: string) {
    const name = username.trim();
    if (name.length < 3) {
      throw new ConflictException('用户名至少 3 个字符');
    }
    // 修复 BUG-05：弱密码策略（长度 + 复杂度 + 常见弱密码黑名单）
    if (password.length < 8) {
      throw new ConflictException('密码至少 8 个字符');
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new ConflictException('密码需同时包含字母和数字');
    }
    const WEAK = new Set(['12345678', 'password', '123456789', 'qwerty123', 'abc12345', '11111111', '00000000']);
    if (WEAK.has(password.toLowerCase())) {
      throw new ConflictException('密码过于简单，请更换');
    }

    if (this.usePg) {
      // PG 模式：查重后插入
      const dup = await this.db.query<{ id: string }>(
        'SELECT id FROM users WHERE username = $1',
        [name],
      );
      if (dup.rows.length > 0) {
        throw new ConflictException('用户名已存在');
      }
      const user: UserRecord = {
        id: `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        username: name,
        passwordHash: await bcrypt.hash(password, 10),
        createdAt: Date.now(),
      };
      await this.db.query(
        'INSERT INTO users (id, username, password_hash, created_at) VALUES ($1, $2, $3, $4)',
        [user.id, user.username, user.passwordHash, user.createdAt],
      );
      return this.buildToken(user);
    }

    // 内存模式（原有逻辑）
    for (const u of this.users.values()) {
      if (u.username === name) {
        throw new ConflictException('用户名已存在');
      }
    }
    const user: UserRecord = {
      id: `u_${Date.now().toString(36)}`,
      username: name,
      passwordHash: await bcrypt.hash(password, 10),
      createdAt: Date.now(),
    };
    this.users.set(user.id, user);
    return this.buildToken(user);
  }

  async login(username: string, password: string) {
    const name = username.trim();
    if (this.usePg) {
      const res = await this.db.query<UserRecord>(
        'SELECT id, username, password_hash AS "passwordHash", created_at AS "createdAt" FROM users WHERE username = $1',
        [name],
      );
      const user = res.rows[0];
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        throw new UnauthorizedException('用户名或密码错误');
      }
      return this.buildToken(user);
    }
    const user = [...this.users.values()].find((u) => u.username === name);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    return this.buildToken(user);
  }

  async findBySub(sub: string) {
    if (this.usePg) {
      const res = await this.db.query<{ id: string; username: string }>(
        'SELECT id, username FROM users WHERE id = $1',
        [sub],
      );
      return res.rows[0] ?? null;
    }
    return this.users.get(sub) ?? null;
  }

  private buildToken(user: UserRecord) {
    const payload: JwtUser = { sub: user.id, username: user.username };
    return {
      accessToken: this.jwt.sign(payload),
      user: { id: user.id, username: user.username },
    };
  }

  async onModuleDestroy(): Promise<void> {
    this.users.clear();
  }
}
