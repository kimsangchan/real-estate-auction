import { JwtService, TokenExpiredError, TokenInvalidError } from './jwt.service';

const SECRET = 'a'.repeat(32);

describe('JwtService', () => {
  it('액세스 토큰을 발급하고 검증하면 sub을 그대로 돌려준다', async () => {
    const service = new JwtService(SECRET);
    const token = await service.issueAccessToken('user-1');

    const payload = await service.verifyAccessToken(token);

    expect(payload.sub).toBe('user-1');
  });

  it('만료 시간이 지나면 TokenExpiredError를 던진다', async () => {
    let now = 0;
    const service = new JwtService(SECRET, () => now);
    const token = await service.issueAccessToken('user-1');

    now += 16 * 60 * 1000; // 15분 TTL 경과

    await expect(service.verifyAccessToken(token)).rejects.toThrow(TokenExpiredError);
  });

  it('경계값: 만료 직전(14분 59초)에는 유효하다', async () => {
    let now = 0;
    const service = new JwtService(SECRET, () => now);
    const token = await service.issueAccessToken('user-1');

    now += 14 * 60 * 1000 + 59_000;

    await expect(service.verifyAccessToken(token)).resolves.toEqual({ sub: 'user-1' });
  });

  it('다른 시크릿으로 서명된 토큰은 거부한다', async () => {
    const issuer = new JwtService(SECRET);
    const verifier = new JwtService('b'.repeat(32));
    const token = await issuer.issueAccessToken('user-1');

    await expect(verifier.verifyAccessToken(token)).rejects.toThrow(TokenInvalidError);
  });

  it('형식이 아예 잘못된 문자열은 TokenInvalidError로 거부한다', async () => {
    const service = new JwtService(SECRET);

    await expect(service.verifyAccessToken('not-a-jwt')).rejects.toThrow(TokenInvalidError);
  });

  it('iss·aud가 다른 토큰은 거부한다', async () => {
    const service = new JwtService(SECRET);
    const { SignJWT } = await import('jose');
    const foreignToken = await new SignJWT({ sub: 'user-1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('other-issuer')
      .setAudience('other-audience')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode(SECRET));

    await expect(service.verifyAccessToken(foreignToken)).rejects.toThrow(TokenInvalidError);
  });
});
