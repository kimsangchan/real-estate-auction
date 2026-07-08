import { CodefAuthError, CodefTokenClient } from './codef-token.client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('CodefTokenClient', () => {
  const config = { oauthBaseUrl: 'https://oauth.codef.io', clientId: 'id', clientSecret: 'secret' };

  it('토큰을 발급받아 반환한다', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      jsonResponse(200, { access_token: 'token-1', token_type: 'bearer', expires_in: 3600, scope: 'read' }),
    );
    const client = new CodefTokenClient(config, fetchFn as unknown as typeof fetch);

    const token = await client.getAccessToken();

    expect(token).toBe('token-1');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://oauth.codef.io/oauth/token',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('만료 전까지는 캐시된 토큰을 재사용하고 재발급하지 않는다', async () => {
    let now = 0;
    const fetchFn = jest.fn().mockResolvedValue(
      jsonResponse(200, { access_token: 'token-1', token_type: 'bearer', expires_in: 3600, scope: 'read' }),
    );
    const client = new CodefTokenClient(config, fetchFn as unknown as typeof fetch, () => now);

    await client.getAccessToken();
    now += 1000; // 아직 만료 전
    const second = await client.getAccessToken();

    expect(second).toBe('token-1');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('만료 시점이 지나면 새 토큰을 발급받는다', async () => {
    let now = 0;
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { access_token: 'token-1', token_type: 'bearer', expires_in: 3600, scope: 'read' }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { access_token: 'token-2', token_type: 'bearer', expires_in: 3600, scope: 'read' }),
      );
    const client = new CodefTokenClient(config, fetchFn as unknown as typeof fetch, () => now);

    await client.getAccessToken();
    now += 3600 * 1000; // 만료 시점 경과
    const second = await client.getAccessToken();

    expect(second).toBe('token-2');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('토큰 발급 실패(HTTP 오류)는 CodefAuthError로 감싼다', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(401, { error: 'invalid_client' }));
    const client = new CodefTokenClient(config, fetchFn as unknown as typeof fetch);

    await expect(client.getAccessToken()).rejects.toThrow(CodefAuthError);
  });

  it('네트워크 오류도 CodefAuthError로 감싼다', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const client = new CodefTokenClient(config, fetchFn as unknown as typeof fetch);

    await expect(client.getAccessToken()).rejects.toThrow(CodefAuthError);
  });
});
