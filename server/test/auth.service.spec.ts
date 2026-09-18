import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/auth/auth.service.js';
import type { DatabaseService } from '../src/database/database.service.js';

/** JwtService 最小 mock：sign 返回固定 token */
const jwtMock = {
  sign: (payload: unknown) => `fake-token:${JSON.stringify(payload)}`,
};

/** DatabaseService mock：内存模式（isEnabled=false）下不会被调用 */
const dbMock = {
  isEnabled: false,
  query: vi.fn(),
} as unknown as DatabaseService;

describe('AuthService（内存模式）', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService(jwtMock as never, dbMock);
  });

  describe('register 注册校验', () => {
    it('注册成功：返回 accessToken 与用户信息', async () => {
      const res = await service.register('tester3', 'Test@12345');
      expect(res.accessToken).toContain('fake-token:');
      expect(res.user.username).toBe('tester3');
      expect(res.user.id).toMatch(/^u_/);
    });

    it('用户名少于 3 个字符时拒绝', async () => {
      await expect(service.register('ab', 'Test@12345')).rejects.toThrow(ConflictException);
    });

    it('密码少于 8 位时拒绝', async () => {
      await expect(service.register('tester3', 'Test12')).rejects.toThrow('密码至少 8 个字符');
    });

    it('密码不含字母时拒绝', async () => {
      await expect(service.register('tester3', '1234567890')).rejects.toThrow(
        '密码需同时包含字母和数字',
      );
    });

    it('密码不含数字时拒绝', async () => {
      await expect(service.register('tester3', 'abcdefgh')).rejects.toThrow(
        '密码需同时包含字母和数字',
      );
    });

    it('弱密码黑名单命中时拒绝（如 abc12345）', async () => {
      await expect(service.register('tester3', 'abc12345')).rejects.toThrow('密码过于简单');
    });

    it('重复用户名时拒绝', async () => {
      await service.register('tester3', 'Test@12345');
      await expect(service.register('tester3', 'Other@12345')).rejects.toThrow('用户名已存在');
    });
  });

  describe('login 登录', () => {
    it('正确密码登录成功', async () => {
      await service.register('tester3', 'Test@12345');
      const res = await service.login('tester3', 'Test@12345');
      expect(res.user.username).toBe('tester3');
      expect(res.accessToken).toContain('fake-token:');
    });

    it('错误密码抛出 UnauthorizedException', async () => {
      await service.register('tester3', 'Test@12345');
      await expect(service.login('tester3', 'Wrong@123')).rejects.toThrow(UnauthorizedException);
    });

    it('不存在的用户抛出 UnauthorizedException', async () => {
      await expect(service.login('nobody', 'Test@12345')).rejects.toThrow(UnauthorizedException);
    });

    it('用户名首尾空白会被 trim', async () => {
      await service.register('tester3', 'Test@12345');
      const res = await service.login('  tester3  ', 'Test@12345');
      expect(res.user.username).toBe('tester3');
    });
  });

  describe('findBySub 会话恢复', () => {
    it('返回已注册用户', async () => {
      const { user } = await service.register('tester3', 'Test@12345');
      const found = await service.findBySub(user.id);
      expect(found?.username).toBe('tester3');
    });

    it('不存在的 sub 返回 null', async () => {
      expect(await service.findBySub('u_not_exist')).toBeNull();
    });
  });
});
