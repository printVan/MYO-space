import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/** 允许的图片类型 */
const ALLOWED = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);
/** 本地磁盘目录（开发环境，与 main.ts 静态服务 /uploads/ 对应） */
const LOCAL_DIR = join(process.cwd(), 'uploads', 'images');

/**
 * 图片上传服务（§4.8.5 / §8.4）
 * 双模式：
 * - 配置 S3_*（生产）→ 上传至 S3 兼容对象存储（Supabase Storage / Cloudflare R2 等），返回公网 URL
 * - 未配置 → 保存本地 uploads/ 目录，由静态服务暴露（开发环境）
 * 兼容旧变量名 R2_*（Cloudflare R2 场景），优先读取 S3_*。
 */
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly s3: S3Client | null;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor() {
    const endpoint =
      process.env.S3_ENDPOINT ||
      (process.env.R2_ACCOUNT_ID
        ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : '');
    const key = process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
    const secret =
      process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.S3_BUCKET || process.env.R2_BUCKET;
    const region = process.env.S3_REGION || 'auto';
    this.bucket = bucket || '';
    this.publicUrl =
      process.env.S3_PUBLIC_URL || process.env.R2_PUBLIC_URL || '';

    if (endpoint && key && secret && bucket) {
      this.s3 = new S3Client({
        region,
        endpoint,
        credentials: { accessKeyId: key, secretAccessKey: secret },
        forcePathStyle: true,
      });
      this.logger.log(`图片上传已启用 S3 兼容对象存储（${endpoint}）`);
    } else {
      this.s3 = null;
      mkdirSync(LOCAL_DIR, { recursive: true });
      this.logger.log('未配置 S3_*/R2_*，图片保存本地 uploads/ 目录（开发环境）');
    }
  }

  makeFilename(originalName: string): string {
    const ext = extname(originalName).toLowerCase();
    if (!ALLOWED.has(ext)) {
      throw new BadRequestException(`不支持的图片格式：${ext || '未知'}`);
    }
    return `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  }

  /** 保存图片，返回可直接写入 Markdown 的 URL */
  async save(file: Express.Multer.File): Promise<string> {
    const filename = this.makeFilename(file.originalname);
    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: filename,
          Body: file.buffer,
          ContentType: file.mimetype || 'application/octet-stream',
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      if (this.publicUrl) {
        return `${this.publicUrl.replace(/\/$/, '')}/${filename}`;
      }
      // 未配置公网 URL 时，尽力构造（Supabase 约定格式）
      const m = this.s3.config.endpoint
        ? String(this.s3.config.endpoint)
        : '';
      if (m.includes('supabase.co/storage/v1/s3')) {
        const host = m.replace('storage.supabase.co/storage/v1/s3', 'supabase.co');
        return `${host}/storage/v1/object/public/${this.bucket}/${filename}`;
      }
      throw new Error('对象存储已启用但未配置 S3_PUBLIC_URL');
    }

    // 本地磁盘（开发环境）
    writeFileSync(join(LOCAL_DIR, filename), file.buffer);
    return `/uploads/images/${filename}`;
  }
}
