import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      name: 'myblog-server',
      version: '1.0.0',
      description: 'GitHub 风格个人笔记博客后端（鉴权 / 增量同步 / 图片上传 / 公开密码校验）',
      endpoints: ['/api/auth/*', '/api/sync/*', '/api/uploads/*', '/api/public/*'],
    };
  }
}
