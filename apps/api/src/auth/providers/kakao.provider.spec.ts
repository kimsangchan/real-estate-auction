import { KakaoAuthError, KakaoProvider } from './kakao.provider';

const CONFIG = { clientId: 'kakao-client', clientSecret: 'kakao-secret' };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('KakaoProvider', () => {
  it('buildAuthorizeUrl은 client_id·redirect_uri·scope=openid·state·nonce를 포함한다', () => {
    const provider = new KakaoProvider(CONFIG);

    const url = new URL(
      provider.buildAuthorizeUrl({ redirectUri: 'https://web.example/api/auth/kakao/callback', state: 's1', nonce: 'n1' }),
    );

    expect(url.origin + url.pathname).toBe('https://kauth.kakao.com/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('kakao-client');
    expect(url.searchParams.get('redirect_uri')).toBe('https://web.example/api/auth/kakao/callback');
    expect(url.searchParams.get('scope')).toBe('openid');
    expect(url.searchParams.get('state')).toBe('s1');
    expect(url.searchParams.get('nonce')).toBe('n1');
  });

  it('토큰 교환 후 id_token을 검증해 providerUserId·nickname을 반환한다', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(jsonResponse(200, { access_token: 'a', id_token: 'id-token', token_type: 'bearer', expires_in: 3600 }));
    const verifyIdToken = jest.fn().mockResolvedValue({ sub: 'kakao-user-1', nickname: '홍길동', nonce: 'n1' });
    const provider = new KakaoProvider(CONFIG, fetchFn as unknown as typeof fetch, verifyIdToken);

    const profile = await provider.exchangeCodeForProfile({ code: 'code-1', redirectUri: 'https://web.example/cb', nonce: 'n1' });

    expect(profile).toEqual({ providerUserId: 'kakao-user-1', nickname: '홍길동' });
    expect(verifyIdToken).toHaveBeenCalledWith('id-token', 'https://kauth.kakao.com', 'kakao-client');
  });

  it('nonce가 없으면 거부한다', async () => {
    const provider = new KakaoProvider(CONFIG, jest.fn() as unknown as typeof fetch);

    await expect(provider.exchangeCodeForProfile({ code: 'c', redirectUri: 'r' })).rejects.toThrow(KakaoAuthError);
  });

  it('id_token의 nonce가 요청한 nonce와 다르면 거부한다', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(jsonResponse(200, { access_token: 'a', id_token: 'id-token', token_type: 'bearer', expires_in: 3600 }));
    const verifyIdToken = jest.fn().mockResolvedValue({ sub: 'kakao-user-1', nonce: 'other-nonce' });
    const provider = new KakaoProvider(CONFIG, fetchFn as unknown as typeof fetch, verifyIdToken);

    await expect(
      provider.exchangeCodeForProfile({ code: 'code-1', redirectUri: 'https://web.example/cb', nonce: 'n1' }),
    ).rejects.toThrow(KakaoAuthError);
  });

  it('id_token 서명 검증(iss/aud) 실패는 KakaoAuthError로 전파된다', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(jsonResponse(200, { access_token: 'a', id_token: 'id-token', token_type: 'bearer', expires_in: 3600 }));
    const verifyIdToken = jest.fn().mockRejectedValue(new Error('JWTClaimValidationFailed'));
    const provider = new KakaoProvider(CONFIG, fetchFn as unknown as typeof fetch, verifyIdToken);

    await expect(
      provider.exchangeCodeForProfile({ code: 'code-1', redirectUri: 'https://web.example/cb', nonce: 'n1' }),
    ).rejects.toThrow('JWTClaimValidationFailed');
  });

  it('토큰 교환 HTTP 실패는 KakaoAuthError로 감싼다', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(401, { error: 'invalid_grant' }));
    const provider = new KakaoProvider(CONFIG, fetchFn as unknown as typeof fetch);

    await expect(
      provider.exchangeCodeForProfile({ code: 'code-1', redirectUri: 'r', nonce: 'n1' }),
    ).rejects.toThrow(KakaoAuthError);
  });

  it('토큰 응답 형식이 올바르지 않으면 거부한다', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(200, { unexpected: true }));
    const provider = new KakaoProvider(CONFIG, fetchFn as unknown as typeof fetch);

    await expect(
      provider.exchangeCodeForProfile({ code: 'code-1', redirectUri: 'r', nonce: 'n1' }),
    ).rejects.toThrow(KakaoAuthError);
  });

  it('네트워크 오류도 KakaoAuthError로 감싼다', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const provider = new KakaoProvider(CONFIG, fetchFn as unknown as typeof fetch);

    await expect(
      provider.exchangeCodeForProfile({ code: 'code-1', redirectUri: 'r', nonce: 'n1' }),
    ).rejects.toThrow(KakaoAuthError);
  });
});
