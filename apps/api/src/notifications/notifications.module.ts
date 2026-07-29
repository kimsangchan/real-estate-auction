// 알림 모듈 — 기기 토큰 등록·해제만 API로 노출한다(발송은 cron CLI, WP-09 §1-3).
// FavoritesModule과 같은 이유로 JwtAuthGuard의 의존성인 JwtService를 이 모듈 provider로 등록한다
// (클래스 참조 가드는 Nest가 생성자 리플렉션으로 직접 만들기 때문 — WP-08 §1-4,6).
import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { JwtService } from '../auth/token/jwt.service';
import { loadEnv } from '../config/env';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository, NOTIFICATIONS_PG_POOL } from './notifications.repository';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    {
      provide: NOTIFICATIONS_PG_POOL,
      useFactory: () => new Pool({ connectionString: loadEnv(process.env).DATABASE_URL }),
    },
    NotificationsRepository,
    NotificationsService,
    {
      provide: JwtService,
      useFactory: () => new JwtService(loadEnv(process.env).JWT_ACCESS_SECRET),
    },
  ],
})
export class NotificationsModule {}
