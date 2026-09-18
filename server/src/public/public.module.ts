import { Module } from '@nestjs/common';
import { SyncModule } from '../sync/sync.module.js';
import { PublicController } from './public.controller.js';

@Module({
  imports: [SyncModule],
  controllers: [PublicController],
})
export class PublicModule {}
