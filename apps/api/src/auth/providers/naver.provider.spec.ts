import { NaverAuthError, NaverProvider } from './naver.provider';

const CONFIG = { clientId: 'naver-client', clientSecret: 'naver-secret' };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('NaverProvider', () => {
  it('buildAuthorizeUrl은 client_id·redirect_uri·state를 포함한다', () => {
    const provider = new NaverProvider(CONFIG);

    const url = new URL(provider.buildAuthorizeUrl({ redirectUri: 'https://web.example/api/auth/naver/callback', state: 's1' }));

    expect(url.origin + url.pathname).toBe('https://nid.naver.com/oauth2.0/authorize');
    expect(url.searchParams.get('client_id')).toBe('naver-client');
    expect(url.searchParams.get('redirect_uri')).toBe('https://web.example/api/auth/naver/callback');
    expect(url.searchParams.get('state')).toBe('s1');
  });

  it('토큰 교환 후 프로필 API를 호출해 providerUserId·nickname을 반환한다', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'nv-access', token_type: 'bearer' }))
      .mockResolvedValueOnce(
        jsonResponse(200, { resultcode: '00', message: 'success', response: { id: 'naver-user-1', nickname: '길동' } }),
      );
    const provider = new NaverProvider(CONFIG, fetchFn as unknown as typeof fetch);

    const profile = await provider.exchangeCodeForProfile({ code: 'code-1', redirectUri: 'https://web.example/cb' });

    expect(profile).toEqual({ providerUserId: 'naver-user-1', nickname: '길동' });
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      'https://openapi.naver.com/v1/nid/me',
      expect.objectContaining({ headers: { Authorization: 'Bearer nv-access' } }),
    );
  });

  it('nickname이 없으면 기본값을 쓴다', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'nv-access', token_type: 'bearer' }))
      .mockResolvedValueOnce(jsonResponse(200, { resultcode: '00', message: 'success', response: { id: 'naver-user-1' } }));
    const provider = new NaverProvider(CONFIG, fetchFn as unknown as typeof fetch);

    const profile = await provider.exchangeCodeForProfile({ code: 'code-1', redirectUri: 'r' });

    expect(profile.nickname).toBe('네이버 사용자');
  });

  it('토큰 교환 HTTP 실패는 NaverAuthError로 감싼다', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(400, { error: 'invalid_request' }));
    const provider = new NaverProvider(CONFIG, fetchFn as unknown as typeof fetch);

    await expect(provider.exchangeCodeForProfile({ code: 'c', redirectUri: 'r' })).rejects.toThrow(NaverAuthError);
  });

  it('프로필 API가 resultcode 00이 아니면 거부한다', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'nv-access', token_type: 'bearer' }))
      .mockResolvedValueOnce(jsonResponse(200, { resultcode: '024', message: 'Authentication failed', response: {} }));
    const provider = new NaverProvider(CONFIG, fetchFn as unknown as typeof fetch);

    await expect(provider.exchangeCodeForProfile({ code: 'c', redirectUri: 'r' })).rejects.toThrow(NaverAuthError);
  });

  it('네트워크 오류도 NaverAuthError로 감싼다', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const provider = new NaverProvider(CONFIG, fetchFn as unknown as typeof fetch);

    await expect(provider.exchangeCodeForProfile({ code: 'c', redirectUri: 'r' })).rejects.toThrow(NaverAuthError);
  });
});
