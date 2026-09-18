import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { SyncService } from '../sync/sync.service.js';
import { Public } from '../common/public.decorator.js';
import { RateLimitGuard } from '../common/rate-limit.guard.js';

/**
 * 公开博客数据接口（§4.5.3 / §4.6）
 * 公开页面为独立路由，不需要登录；密码访问权限校验由后端接口完成（§8.5）
 */
@Public()
@Controller('public')
export class PublicController {
  constructor(private sync: SyncService) {}

  /** 公开项目列表（同步到服务端的公开项目） */
  @Get('projects')
  async listProjects() {
    const projects = await this.sync.listPublicProjects();
    // 不返回密码字段
    return projects.map(({ password: _password, ...rest }) => rest);
  }

  /** 校验公开项目访问密码（修复 BUG-03 限流 + BUG-04 bcrypt 比较） */
  @UseGuards(new RateLimitGuard(10, 60_000))
  @Post('verify-password')
  async verifyPassword(@Body() body: { projectId: string; password: string }) {
    const project = await this.sync.findProject(body?.projectId ?? '');
    if (!project) throw new NotFoundException('项目不存在');
    if (!project.password) return { ok: true, locked: false };
    const input = String(body?.password ?? '');
    const stored = String(project.password);
    let valid: boolean;
    if (stored.startsWith('$2')) {
      // 新版：bcrypt 哈希比较
      valid = await bcrypt.compare(input, stored);
    } else {
      // 旧数据明文（兼容存量；再次 push 后会被服务端自动哈希）
      valid = stored === input;
    }
    if (!valid) throw new UnauthorizedException('密码错误');
    return { ok: true, locked: true, verified: true };
  }
}
