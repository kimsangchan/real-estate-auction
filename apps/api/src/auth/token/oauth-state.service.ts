// OAuth state 서명 쿠키 — CSRF 방지용 state·카카오 nonce·되돌아올 경로를 짧은 만료(10분)의
// 서명된 토큰에 담아 httpOnly 쿠키로 왕복시킨다 (WP-08 §1-2, §3-4)
import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';
import type { Provider } from '../providers/provider.types';

export class OAuthStateError extends Error {}

const STATE_TOKEN_TTL_SECONDS = 10 * 60;
const STATE_TOKEN_TYPE = 'oauth_state';

export interface OAuthStateClaims {
  provider: Provider;
  state: string;
  nonce?: string;
  returnTo: string;
  /** 로그인을 시작한 클라이언트 — 생략 시 웹(쿠키 세션), 'mobile'이면 콜백에서 교환 코드 발급 (WP-08b §1-1) */
  client?: 'mobile';
  /** PKCE S256 챌린지 — 모바일 클라이언트만 사용 (RFC 7636) */
  codeChallenge?: string;
}

export class OAuthStateService {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly now: () => number = Date.now,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async sign(claims: OAuthStateClaims): Promise<string> {
    const issuedAtSeconds = Math.floor(this.now() / 1000);
    return new SignJWT({ typ: STATE_TOKEN_TYPE, ...claims })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(issuedAtSeconds)
      .setExpirationTime(issuedAtSeconds + STATE_TOKEN_TTL_SECONDS)
      .sign(this.key);
  }

  async verify(token: string): Promise<OAuthStateClaims> {
    let payload;
    try {
      ({ payload } = await jwtVerify(token, this.key, {
        algorithms: ['HS256'],
        currentDate: new Date(this.now()),
      }));
    } catch (cause) {
      if (cause instanceof joseErrors.JWTExpired) {
        throw new OAuthStateError('state 쿠키가 만료됐어요');
      }
      throw new OAuthStateError('state 쿠키가 유효하지 않아요');
    }

    if (
      payload.typ !== STATE_TOKEN_TYPE ||
      typeof payload.state !== 'string' ||
      typeof payload.provider !== 'string' ||
      typeof payload.returnTo !== 'string'
    ) {
      throw new OAuthStateError('state 쿠키 클레임이 올바르지 않아요');
    }

    return {
      provider: payload.provider as Provider,
      state: payload.state,
      nonce: typeof payload.nonce === 'string' ? payload.nonce : undefined,
      returnTo: payload.returnTo,
      client: payload.client === 'mobile' ? 'mobile' : undefined,
      codeChallenge: typeof payload.codeChallenge === 'string' ? payload.codeChallenge : undefined,
    };
  }
}
