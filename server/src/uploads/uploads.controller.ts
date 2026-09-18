import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadsService } from './uploads.service.js';

@Controller('uploads')
export class UploadsController {
  constructor(private uploads: UploadsService) {}

  /** 上传图片，返回可直接写入 Markdown 的 URL（§8.4；存储目标由 UploadsService 按环境决定：R2 / 本地磁盘）
   *  multer limits 收紧 multipart 字段数/大小（缓解 GHSA-wc9g-mqfw-jrwm 等字段名 DoS） */
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 20 * 1024 * 1024,
        files: 1,
        fields: 4,
        fieldSize: 1024,
        parts: 10,
      },
    }),
  )
  async uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      return { url: null, error: '未收到文件' };
    }
    const url = await this.uploads.save(file);
    return { url };
  }
}
