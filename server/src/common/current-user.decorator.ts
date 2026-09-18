import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface JwtUser {
  sub: string;
  username: string;
}

/** 从请求中取当前登录用户（JWT payload） */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser | null => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: JwtUser }>();
    return req.user ?? null;
  },
);
