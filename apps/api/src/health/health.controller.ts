// 헬스체크 엔드포인트 — 배포·모니터링용 생존 확인 (WP-01)
import { Controller, Get } from '@nestjs/common';

const APP_VERSION = process.env.npm_package_version ?? '0.1.0';

export interface HealthResponse {
  status: 'ok';
  version: string;
}

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: 'ok', version: APP_VERSION };
  }
}
