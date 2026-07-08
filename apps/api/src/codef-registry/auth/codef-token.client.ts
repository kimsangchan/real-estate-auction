// CODEF OAuth2 client_credentials 토큰 발급·만료 캐시 (WP-04 요구사항 1)
// 등기부 조회 자체(과금 대상)와 분리된 무료 인증 계층 — 토큰은 만료 전까지 재사용한다.

export class CodefAuthError extends Error {}

export interface CodefTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface CodefTokenClientConfig {
  oauthBaseUrl: string;
  clientId: string;
  clientSecret: string;
}

type FetchFn = typeof fetch;

const TOKEN_EXPIRY_SAFETY_MARGIN_MS = 60_000;

export class CodefTokenClient {
  private cachedToken: { accessToken: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: CodefTokenClientConfig,
    private readonly fetchFn: FetchFn = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async getAccessToken(): Promise<string> {
    const nowMs = this.now();
    if (this.cachedToken && this.cachedToken.expiresAt > nowMs) {
      return this.cachedToken.accessToken;
    }

    const token = await this.requestNewToken();
    this.cachedToken = {
      accessToken: token.access_token,
      expiresAt: nowMs + token.expires_in * 1000 - TOKEN_EXPIRY_SAFETY_MARGIN_MS,
    };
    return token.access_token;
  }

  private async requestNewToken(): Promise<CodefTokenResponse> {
    const basicAuth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString(
      'base64',
    );

    let response: Response;
    try {
      response = await this.fetchFn(`${this.config.oauthBaseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'read' }).toString(),
      });
    } catch (cause) {
      throw new CodefAuthError(`CODEF 토큰 발급 요청 실패: ${(cause as Error).message}`);
    }

    if (!response.ok) {
      throw new CodefAuthError(`CODEF 토큰 발급 실패: HTTP ${response.status}`);
    }

    return (await response.json()) as CodefTokenResponse;
  }
}
