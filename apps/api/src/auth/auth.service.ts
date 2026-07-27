// 인증 서비스 — OAuth 콜백 처리, JWT 세션 발급, 리프레시 회전·재사용 감지를 담당한다 (WP-08 §1-2,3)
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuthRepository } from './auth.repository';
import type { OAuthProvider, Provider } from './providers/provider.types';
import { generateFamilyId, generateOpaqueToken, hashToken } from './token/refresh-token.util';
import { JwtService } from './token/jwt.service';
import { MobileExchangeService } from './token/mobile-exchange.service';
import { OAuthStateService } from './token/oauth-state.service';
import { RefreshJwtService, RefreshTokenInvalidError } from './token/refresh-jwt.service';

export class OAuthCallbackError extends Error {}
export class RefreshTokenError extends Error {}

const REFRESH_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export interface AuthServiceConfig {
  webOrigin: string;
}

export interface LoginRedirect {
  url: string;
  stateCookieValue: string;
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  user: { id: string; nickname: string; provider: string };
  returnTo: string;
}

/** 콜백 결과 — 웹은 쿠키 세션, 모바일은 딥링크로 전달할 일회성 교환 코드 (WP-08b §1-1) */
export type CallbackResult = ({ kind: 'web' } & IssuedSession) | { kind: 'mobile'; exchangeCode: string };

export interface MobileLoginStart {
  codeChallenge: string;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly providers: Record<Provider, OAuthProvider>,
    private readonly jwtService: JwtService,
    private readonly stateService: OAuthStateService,
    private readonly refreshJwtService: RefreshJwtService,
    private readonly mobileExchangeService: MobileExchangeService,
    private readonly config: AuthServiceConfig,
    private readonly now: () => number = Date.now,
  ) {}

  get webOrigin(): string {
    return this.config.webOrigin;
  }

  private buildRedirectUri(provider: Provider): string {
    return `${this.config.webOrigin}/api/auth/${provider}/callback`;
  }

  async startLogin(provider: Provider, returnTo: string, mobile?: MobileLoginStart): Promise<LoginRedirect> {
    const providerAdapter = this.providers[provider];
    const state = generateOpaqueToken();
    const nonce = provider === 'kakao' ? generateOpaqueToken() : undefined;

    const url = providerAdapter.buildAuthorizeUrl({ redirectUri: this.buildRedirectUri(provider), state, nonce });
    const stateCookieValue = await this.stateService.sign({
      provider,
      state,
      nonce,
      returnTo,
      client: mobile ? 'mobile' : undefined,
      codeChallenge: mobile?.codeChallenge,
    });

    return { url, stateCookieValue };
  }

  async handleCallback(params: {
    provider: Provider;
    code: string;
    state: string;
    stateCookieValue: string | undefined;
  }): Promise<CallbackResult> {
    if (!params.stateCookieValue) {
      throw new OAuthCallbackError('state 쿠키가 없어요');
    }

    let claims;
    try {
      claims = await this.stateService.verify(params.stateCookieValue);
    } catch (cause) {
      throw new OAuthCallbackError((cause as Error).message);
    }

    if (claims.provider !== params.provider || claims.state !== params.state) {
      throw new OAuthCallbackError('state 값이 일치하지 않아요');
    }

    const providerAdapter = this.providers[params.provider];
    const profile = await providerAdapter.exchangeCodeForProfile({
      code: params.code,
      redirectUri: this.buildRedirectUri(params.provider),
      nonce: claims.nonce,
    });

    const user = await this.repository.upsertUser(params.provider, profile.providerUserId, profile.nickname);

    // 모바일은 세션을 아직 만들지 않는다 — 교환 코드가 소모될 때 발급해 미수령 세션 잔류를 막는다 (WP-08b §1-1)
    if (claims.client === 'mobile') {
      if (!claims.codeChallenge) {
        throw new OAuthCallbackError('모바일 로그인에 코드 챌린지가 없어요');
      }
      const exchangeCode = await this.mobileExchangeService.issue(user.id, claims.codeChallenge);
      return { kind: 'mobile', exchangeCode };
    }

    const session = await this.issueSession(user.id);

    return {
      kind: 'web',
      ...session,
      user: { id: user.id, nickname: user.nickname, provider: user.provider },
      returnTo: claims.returnTo,
    };
  }

  /** 딥링크로 받은 일회성 교환 코드 + PKCE verifier → 토큰 쌍. 실패 사유는 호출부에서 401로 통일한다 (규칙 8) */
  async exchangeMobileCode(code: string, codeVerifier: string): Promise<{ accessToken: string; refreshToken: string }> {
    const { userId } = await this.mobileExchangeService.consume(code, codeVerifier);
    return this.issueSession(userId);
  }

  /** 회원 탈퇴 — app_user 삭제 시 refresh_token·favorite는 FK CASCADE로 함께 삭제된다 (마이그레이션 002) */
  async deleteAccount(userId: string): Promise<void> {
    await this.repository.deleteUser(userId);
  }

  /** 리프레시 토큰 회전 — 재사용(이미 폐기된 토큰 재제출)이 감지되면 해당 계열 전체를 폐기한다 (WP-08 §1-3) */
  async refresh(rawRefreshToken: string): Promise<RefreshResult> {
    try {
      await this.refreshJwtService.verifySignature(rawRefreshToken);
    } catch (cause) {
      if (cause instanceof RefreshTokenInvalidError) {
        throw new RefreshTokenError(cause.message);
      }
      throw cause;
    }

    const tokenHash = hashToken(rawRefreshToken);

    return this.repository.withTransaction(async (client) => {
      const row = await this.repository.findRefreshTokenByHashForUpdate(client, tokenHash);
      if (!row) {
        throw new RefreshTokenError('리프레시 토큰을 찾을 수 없어요');
      }
      if (row.revokedAt) {
        await this.repository.revokeFamily(client, row.familyId);
        throw new RefreshTokenError('토큰 재사용이 감지되어 세션을 종료했어요');
      }
      if (row.expiresAt.getTime() <= this.now()) {
        throw new RefreshTokenError('리프레시 토큰이 만료됐어요');
      }

      await this.repository.revokeToken(client, row.id);

      const newRefreshToken = await this.refreshJwtService.issue(row.userId, row.familyId);
      await this.repository.insertRefreshToken(
        {
          id: randomUUID(),
          userId: row.userId,
          tokenHash: hashToken(newRefreshToken),
          familyId: row.familyId,
          expiresAt: new Date(this.now() + REFRESH_TOKEN_TTL_MS),
        },
        client,
      );

      const accessToken = await this.jwtService.issueAccessToken(row.userId);
      return { accessToken, refreshToken: newRefreshToken, userId: row.userId };
    });
  }

  /** 로그아웃 — 제출된 토큰이 속한 계열 전체를 폐기한다(다중 기기 세션은 로그인마다 별도 계열이라 영향 없음) */
  async logout(rawRefreshToken: string): Promise<void> {
    try {
      await this.refreshJwtService.verifySignature(rawRefreshToken);
    } catch {
      return; // 형식이 잘못된 토큰이면 폐기할 세션이 없는 것과 같으므로 조용히 종료한다
    }

    const tokenHash = hashToken(rawRefreshToken);

    await this.repository.withTransaction(async (client) => {
      const row = await this.repository.findRefreshTokenByHashForUpdate(client, tokenHash);
      if (!row) {
        return;
      }
      await this.repository.revokeFamily(client, row.familyId);
    });
  }

  async me(userId: string): Promise<{ id: string; nickname: string; provider: string } | null> {
    const user = await this.repository.findUserById(userId);
    return user ? { id: user.id, nickname: user.nickname, provider: user.provider } : null;
  }

  private async issueSession(userId: string): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.jwtService.issueAccessToken(userId);
    const familyId = generateFamilyId();
    const refreshToken = await this.refreshJwtService.issue(userId, familyId);

    await this.repository.insertRefreshToken({
      id: randomUUID(),
      userId,
      tokenHash: hashToken(refreshToken),
      familyId,
      expiresAt: new Date(this.now() + REFRESH_TOKEN_TTL_MS),
    });

    return { accessToken, refreshToken };
  }
}
