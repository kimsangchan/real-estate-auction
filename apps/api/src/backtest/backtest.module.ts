// 룰 역채점 모듈 — 내부 확인용 집계를 읽는다 (WP-11)
import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { loadEnv } from '../config/env';
import { BacktestController } from './backtest.controller';
import { BACKTEST_PG_POOL, BacktestRepository } from './backtest.repository';

@Module({
  controllers: [BacktestController],
  providers: [
    {
      provide: BACKTEST_PG_POOL,
      useFactory: () => new Pool({ connectionString: loadEnv(process.env).DATABASE_URL }),
    },
    BacktestRepository,
  ],
})
export class BacktestModule {}
