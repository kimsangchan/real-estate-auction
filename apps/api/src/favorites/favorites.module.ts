// 관심 물건 모듈 — DATABASE_URL로 pg Pool을 만들어 리포지토리에 주입한다.
// FavoritesController가 `@UseGuards(JwtAuthGuard)`로 가드를 클래스 참조하는데, Nest는 이런
// 클래스 참조 가드를 항상 생성자 리플렉션으로 직접 생성한다(이 모듈에 JwtAuthGuard 자체를 provider로
// 등록해도 무시됨) — 그래서 JwtAuthGuard가 아니라 그 생성자 의존성인 JwtService를 이 모듈의 실제
// provider로 등록해 해석 가능하게 만든다 (WP-08 §1-4,6)
import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { loadEnv } from '../config/env';
import { JwtService } from '../auth/token/jwt.service';
import { FavoritesController } from './favorites.controller';
import { FavoritesRepository, FAVORITES_PG_POOL } from './favorites.repository';

@Module({
  controllers: [FavoritesController],
  providers: [
    {
      provide: FAVORITES_PG_POOL,
      useFactory: () => new Pool({ connectionString: loadEnv(process.env).DATABASE_URL }),
    },
    FavoritesRepository,
    {
      provide: JwtService,
      useFactory: () => new JwtService(loadEnv(process.env).JWT_ACCESS_SECRET),
    },
  ],
})
export class FavoritesModule {}
