import { RefreshJwtService, RefreshTokenInvalidError } from './refresh-jwt.service';

const SECRET = 'r'.repeat(32);

describe('RefreshJwtService', () => {
  it('발급한 토큰을 검증하면 sub·familyId를 돌려준다', async () => {
    const service = new RefreshJwtService(SECRET);
    const token = await service.issue('user-1', 'family-1');

    const claims = await service.verifySignature(token);

    expect(claims).toEqual({ sub: 'user-1', familyId: 'family-1' });
  });

  it('14일 TTL이 지나면 만료로 거부한다', async () => {
    let now = 0;
    const service = new RefreshJwtService(SECRET, () => now);
    const token = await service.issue('user-1', 'family-1');

    now += 15 * 24 * 60 * 60 * 1000;

    await expect(service.verifySignature(token)).rejects.toThrow(RefreshTokenInvalidError);
  });

  it('다른 시크릿(액세스 시크릿 등)으로는 검증되지 않는다', async () => {
    const issuer = new RefreshJwtService(SECRET);
    const verifier = new RefreshJwtService('other-secret-32-bytes-long-000000');
    const token = await issuer.issue('user-1', 'family-1');

    await expect(verifier.verifySignature(token)).rejects.toThrow(RefreshTokenInvalidError);
  });

  it('형식이 잘못된 문자열은 거부한다', async () => {
    const service = new RefreshJwtService(SECRET);

    await expect(service.verifySignature('not-a-jwt')).rejects.toThrow(RefreshTokenInvalidError);
  });
});
