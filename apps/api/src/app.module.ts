// 루트 모듈 — 도메인 모듈이 추가되면 여기에 등록한다
import { Module } from '@nestjs/common';
import { AuctionItemsModule } from './auction-items/auction-items.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [AuctionItemsModule],
  controllers: [HealthController],
})
export class AppModule {}
