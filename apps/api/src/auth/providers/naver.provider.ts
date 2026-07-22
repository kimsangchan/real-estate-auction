// 네이버 로그인 어댑터 — OIDC 미지원이라 OAuth2 토큰 교환 후 /v1/nid/me 프로필 API로 사용자 정보를 얻는다
// (WP-08 §1-2, §3-6 — id_token 파싱을 카카오와 억지로 공용화하지 않는다)
import { z } from 'zod';
import { OAuthProviderError, type OAuthProfile, type OAuthProvider } from './provider.types';

export class NaverAuthError extends OAuthProviderError {}

const NAVER_AUTHORIZE_URL = 'https://nid.naver.com/oauth2.0/authorize';
const NAVER_TOKEN_URL = 'https://nid.naver.com/oauth2.0/token';
const NAVER_PROFILE_URL = 'https://openapi.naver.com/v1/nid/me';
const NAVER_SUCCESS_RESULT_CODE = '00';

const naverTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
});

const naverProfileResponseSchema = z.object({
  resultcode: z.string(),
  message: z.string(),
  response: z.object({
    id: z.string(),
    nickname: z.string().optional(),
  }),
});

export interface NaverProviderConfig {
  clientId: string;
  clientSecret: string;
}

type FetchFn = typeof fetch;

export class NaverProvider implements OAuthProvider {
  readonly name = 'naver' as const;

  constructor(
    private readonly config: NaverProviderConfig,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  buildAuthorizeUrl({ redirectUri, state }: { redirectUri: string; state: string }): string {
    const url = new URL(NAVER_AUTHORIZE_URL);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCodeForProfile({ code, redirectUri }: { code: string; redirectUri: string }): Promise<OAuthProfile> {
    const tokenUrl = new URL(NAVER_TOKEN_URL);
    tokenUrl.searchParams.set('grant_type', 'authorization_code');
    tokenUrl.searchParams.set('client_id', this.config.clientId);
    tokenUrl.searchParams.set('client_secret', this.config.clientSecret);
    tokenUrl.searchParams.set('code', code);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);

    let tokenResponse: Response;
    try {
      tokenResponse = await this.fetchFn(tokenUrl.toString());
    } catch (cause) {
      throw new NaverAuthError(`네이버 토큰 교환 요청 실패: ${(cause as Error).message}`);
    }
    if (!tokenResponse.ok) {
      throw new NaverAuthError(`네이버 토큰 교환 실패: HTTP ${tokenResponse.status}`);
    }

    const tokenJson: unknown = await tokenResponse.json();
    const parsedToken = naverTokenResponseSchema.safeParse(tokenJson);
    if (!parsedToken.success) {
      throw new NaverAuthError('네이버 토큰 응답 형식이 올바르지 않아요');
    }

    let profileResponse: Response;
    try {
      profileResponse = await this.fetchFn(NAVER_PROFILE_URL, {
        headers: { Authorization: `Bearer ${parsedToken.data.access_token}` },
      });
    } catch (cause) {
      throw new NaverAuthError(`네이버 프로필 조회 요청 실패: ${(cause as Error).message}`);
    }
    if (!profileResponse.ok) {
      throw new NaverAuthError(`네이버 프로필 조회 실패: HTTP ${profileResponse.status}`);
    }

    const profileJson: unknown = await profileResponse.json();
    const parsedProfile = naverProfileResponseSchema.safeParse(profileJson);
    if (!parsedProfile.success || parsedProfile.data.resultcode !== NAVER_SUCCESS_RESULT_CODE) {
      throw new NaverAuthError('네이버 프로필 응답 형식이 올바르지 않아요');
    }

    return {
      providerUserId: parsedProfile.data.response.id,
      nickname: parsedProfile.data.response.nickname ?? '네이버 사용자',
    };
  }
}
