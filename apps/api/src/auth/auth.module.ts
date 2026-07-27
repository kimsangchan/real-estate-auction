// 인증 모듈 — DATABASE_URL로 pg Pool을 만들어 리포지토리에 주입한다 (auction-items 모듈과 동일 패턴)
import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { loadEnv } from '../config/env';
import { AuthController } from './auth.controller';
import { AuthRepository, AUTH_PG_POOL } from './auth.repository';
import { AuthService } from './auth.service';
import { KakaoProvider } from './providers/kakao.provider';
import { NaverProvider } from './providers/naver.provider';
import { JwtService } from './token/jwt.service';
import { MobileExchangeService } from './token/mobile-exchange.service';
import { OAuthStateService } from './token/oauth-state.service';
import { RefreshJwtService } from './token/refresh-jwt.service';

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_PG_POOL,
      useFactory: () => new Pool({ connectionString: loadEnv(process.env).DATABASE_URL }),
    },
    AuthRepository,
    {
      provide: AuthService,
      useFactory: (repository: AuthRepository) => {
        const env = loadEnv(process.env);
        return new AuthService(
          repository,
          {
            kakao: new KakaoProvider({ clientId: env.KAKAO_OAUTH_CLIENT_ID, clientSecret: env.KAKAO_OAUTH_CLIENT_SECRET }),
            naver: new NaverProvider({ clientId: env.NAVER_OAUTH_CLIENT_ID, clientSecret: env.NAVER_OAUTH_CLIENT_SECRET }),
          },
          new JwtService(env.JWT_ACCESS_SECRET),
          new OAuthStateService(env.OAUTH_STATE_SECRET),
          new RefreshJwtService(env.JWT_REFRESH_SECRET),
          new MobileExchangeService(env.OAUTH_STATE_SECRET),
          { webOrigin: env.AUTH_WEB_ORIGIN },
        );
      },
      inject: [AuthRepository],
    },
    // JwtAuthGuard(/auth/me에서 @UseGuards(JwtAuthGuard)로 참조)는 Nest가 클래스 참조 가드를
    // 항상 생성자 리플렉션으로 직접 생성하므로(이 모듈에 등록해도 무시됨), JwtAuthGuard 자체가 아니라
    // 그 생성자 의존성인 JwtService를 실제 provider로 등록해 해석 가능하게 만든다.
    {
      provide: JwtService,
      useFactory: () => new JwtService(loadEnv(process.env).JWT_ACCESS_SECRET),
    },
  ],
})
export class AuthModule {}
