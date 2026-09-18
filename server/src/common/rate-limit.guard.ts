import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * 简易内存限流守卫（修复 BUG-03 无速率限制）
 * 按「来源 IP + 路由」维度做滑动窗口计数；
 * 仅用于登录/注册/公开密码校验等高危接口，单实例内存即可满足。
 * 生产如需多实例可替换为 Redis 计数。
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private hits = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private readonly limit: number = 10,
    private readonly windowMs: number = 60_000,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'unknown';
    const route = `${req.method}:${req.route?.path ?? req.url}`;
    const key = `${ip}|${route}`;
    const now = Date.now();

    const cur = this.hits.get(key);
    if (!cur || now - cur.windowStart >= this.windowMs) {
      this.hits.set(key, { count: 1, windowStart: now });
      return true;
    }
    cur.count += 1;
    if (cur.count > this.limit) {
      // 返回 429 并附带重试时间
      const retryAfter = Math.ceil((cur.windowStart + this.windowMs - now) / 1000);
      throw new HttpException(
        {
          message: '请求过于频繁，请稍后再试',
          error: 'Too Many Requests',
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          retryAfterSec: retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
