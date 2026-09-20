import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'node:path';
import { AppModule } from './app.module.js';

/**
 * 后端服务入口（§3.3）
 * 职责：账号鉴权 JWT、增量同步接口、图片上传代理、公开页面密码校验；
 * 不执行业务计算（不做 Markdown 渲染、diff 计算）
 */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');

  // CORS 白名单：仅允许已知前端来源（修复 BUG-02 泛反射）
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'https://myblog-af7.pages.dev,https://preview.myblog-af7.pages.dev,http://localhost:10086,http://localhost:8080')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin(origin, callback) {
      // 无 Origin（curl/服务端调用）放行；带 Origin 的必须命中白名单，否则不返回 CORS 头（浏览器侧拦截）
      if (!origin) return callback(null, true);
      // 放行 Cloudflare Pages 全部部署子域（生产 / preview / 随机 hash 子域）
      // 放行局域网 IP（开发阶段手机/其他设备访问）
      if (
        corsOrigins.includes(origin) ||
        /^https:\/\/([a-z0-9-]+\.)?pages\.dev$/.test(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):\d+$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  });

  // 安全响应头（修复 BUG-07）：CSP / HSTS / X-Frame-Options / X-Content-Type-Options 等
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  // 图片上传目录静态服务（§4.7 图片上传；生产环境替换为 OSS 域名）
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`[myblog-server] listening on http://localhost:${port}/api`);
}
await bootstrap();
