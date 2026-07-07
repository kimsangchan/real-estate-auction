// 루트 모듈 — 도메인 모듈이 추가되면 여기에 등록한다
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';

@Module({
  controllers: [HealthController],
})
export class AppModule {}
