import {
  Controller,
  Post,
  Body,
  Get,
  UnauthorizedException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { Public } from '../common/public.decorator.js';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator.js';
import { RateLimitGuard } from '../common/rate-limit.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @UseGuards(new RateLimitGuard(10, 60_000))
  @Post('register')
  register(@Body() body: { username: string; password: string }) {
    // 修复 BUG-06：DTO 类型防御，非法类型返回 400 而非 500
    if (typeof body?.username !== 'string' || typeof body?.password !== 'string') {
      throw new BadRequestException('用户名和密码必须是字符串');
    }
    return this.auth.register(body.username, body.password);
  }

  @Public()
  @UseGuards(new RateLimitGuard(10, 60_000))
  @Post('login')
  login(@Body() body: { username: string; password: string }) {
    if (typeof body?.username !== 'string' || typeof body?.password !== 'string') {
      throw new BadRequestException('用户名和密码必须是字符串');
    }
    return this.auth.login(body.username, body.password);
  }

  @Get('me')
  async me(@CurrentUser() user: JwtUser | null) {
    if (!user) throw new UnauthorizedException('未登录');
    const record = await this.auth.findBySub(user.sub);
    return { id: record?.id, username: record?.username };
  }
}
