// 물건 조회 모듈 — DATABASE_URL로 pg Pool을 만들어 리포지토리에 주입한다
import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { loadEnv } from '../config/env';
import { AuctionItemsController } from './auction-items.controller';
import { AuctionItemsRepository, PG_POOL } from './auction-items.repository';

@Module({
  controllers: [AuctionItemsController],
  providers: [
    {
      provide: PG_POOL,
      useFactory: () => new Pool({ connectionString: loadEnv(process.env).DATABASE_URL }),
    },
    AuctionItemsRepository,
  ],
})
export class AuctionItemsModule {}
