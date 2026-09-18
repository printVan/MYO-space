import { Body, Controller, Get, Post, Query, UnauthorizedException } from '@nestjs/common';
import { SyncService, type SyncChange } from './sync.service.js';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator.js';

@Controller('sync')
export class SyncController {
  constructor(private sync: SyncService) {}

  /** 推送本地变更（§4.8.2 只同步变更内容；本地为真相源） */
  @Post('push')
  push(@CurrentUser() user: JwtUser | null, @Body() body: { changes: SyncChange[] }) {
    if (!user) throw new UnauthorizedException('未登录');
    return this.sync.push(user.sub, body?.changes ?? []);
  }

  /** 拉取增量变更（§4.8.3 支持离线编辑，联网后自动同步） */
  @Get('pull')
  pull(@CurrentUser() user: JwtUser | null, @Query('since') since?: string) {
    if (!user) throw new UnauthorizedException('未登录');
    const sinceTs = Number(since ?? 0);
    return this.sync.pull(user.sub, Number.isFinite(sinceTs) ? sinceTs : 0);
  }
}
