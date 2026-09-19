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

  /** v1.1: 列出某笔记的云端历史版本 */
  @Get('snapshots')
  listSnapshots(@CurrentUser() user: JwtUser | null, @Query('noteId') noteId?: string) {
    if (!user) throw new UnauthorizedException('未登录');
    if (!noteId) throw new Error('noteId 必填');
    return this.sync.listCloudSnapshots(user.sub, noteId);
  }
}
