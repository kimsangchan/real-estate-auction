// 카카오 로그인 어댑터 — OIDC. id_token은 카카오 JWKS로 서명 검증하고 iss/aud/nonce를 확인한다 (WP-08 §1-2)
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';
import type { OAuthProfile, OAuthProvider } from './provider.types';

export class KakaoAuthError extends Error {}

const KAKAO_AUTHORIZE_URL = 'https://kauth.kakao.com/oauth/authorize';
const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const KAKAO_ISSUER = 'https://kauth.kakao.com';
const KAKAO_JWKS_URL = 'https://kauth.kakao.com/.well-known/jwks.json';

const kakaoTokenResponseSchema = z.object({
  access_token: z.string(),
  id_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
});

const kakaoIdTokenPayloadSchema = z.object({
  sub: z.string(),
  nickname: z.string().optional(),
  nonce: z.string().optional(),
});

export interface KakaoProviderConfig {
  clientId: string;
  clientSecret: string;
}

type FetchFn = typeof fetch;

/** id_token 서명·iss·aud 검증 — 테스트에서는 실제 카카오 JWKS를 호출하지 않도록 이 함수를 주입해 대체한다 */
export type VerifyKakaoIdToken = (idToken: string, issuer: string, audience: string) => Promise<unknown>;

async function defaultVerifyKakaoIdToken(idToken: string, issuer: string, audience: string): Promise<unknown> {
  const jwks = createRemoteJWKSet(new URL(KAKAO_JWKS_URL));
  const { payload } = await jwtVerify(idToken, jwks, { issuer, audience });
  return payload;
}

export class KakaoProvider implements OAuthProvider {
  readonly name = 'kakao' as const;

  constructor(
    private readonly config: KakaoProviderConfig,
    private readonly fetchFn: FetchFn = fetch,
    private readonly verifyIdToken: VerifyKakaoIdToken = defaultVerifyKakaoIdToken,
  ) {}

  buildAuthorizeUrl({ redirectUri, state, nonce }: { redirectUri: string; state: string; nonce?: string }): string {
    const url = new URL(KAKAO_AUTHORIZE_URL);
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid');
    url.searchParams.set('state', state);
    if (nonce) {
      url.searchParams.set('nonce', nonce);
    }
    return url.toString();
  }

  async exchangeCodeForProfile({
    code,
    redirectUri,
    nonce,
  }: {
    code: string;
    redirectUri: string;
    nonce?: string;
  }): Promise<OAuthProfile> {
    if (!nonce) {
      throw new KakaoAuthError('카카오 로그인에는 nonce가 필요해요');
    }

    let response: Response;
    try {
      response = await this.fetchFn(KAKAO_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: redirectUri,
          code,
        }).toString(),
      });
    } catch (cause) {
      throw new KakaoAuthError(`카카오 토큰 교환 요청 실패: ${(cause as Error).message}`);
    }

    if (!response.ok) {
      throw new KakaoAuthError(`카카오 토큰 교환 실패: HTTP ${response.status}`);
    }

    const tokenJson: unknown = await response.json();
    const parsedToken = kakaoTokenResponseSchema.safeParse(tokenJson);
    if (!parsedToken.success) {
      throw new KakaoAuthError('카카오 토큰 응답 형식이 올바르지 않아요');
    }

    const rawPayload = await this.verifyIdToken(parsedToken.data.id_token, KAKAO_ISSUER, this.config.clientId);
    const parsedPayload = kakaoIdTokenPayloadSchema.safeParse(rawPayload);
    if (!parsedPayload.success) {
      throw new KakaoAuthError('카카오 id_token 클레임 형식이 올바르지 않아요');
    }
    if (parsedPayload.data.nonce !== nonce) {
      throw new KakaoAuthError('카카오 id_token nonce가 일치하지 않아요');
    }

    return {
      providerUserId: parsedPayload.data.sub,
      nickname: parsedPayload.data.nickname ?? '카카오 사용자',
    };
  }
}
