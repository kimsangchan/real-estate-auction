import { OAuthStateError, OAuthStateService } from './oauth-state.service';

const SECRET = 'a'.repeat(32);

describe('OAuthStateService', () => {
  it('서명한 클레임을 검증하면 그대로 돌려준다', async () => {
    const service = new OAuthStateService(SECRET);
    const token = await service.sign({ provider: 'kakao', state: 'state-1', nonce: 'nonce-1', returnTo: '/items/1' });

    const claims = await service.verify(token);

    expect(claims).toEqual({ provider: 'kakao', state: 'state-1', nonce: 'nonce-1', returnTo: '/items/1' });
  });

  it('네이버는 nonce 없이도 서명·검증된다', async () => {
    const service = new OAuthStateService(SECRET);
    const token = await service.sign({ provider: 'naver', state: 'state-2', returnTo: '/' });

    const claims = await service.verify(token);

    expect(claims.nonce).toBeUndefined();
  });

  it('만료되면 OAuthStateError를 던진다', async () => {
    let now = 0;
    const service = new OAuthStateService(SECRET, () => now);
    const token = await service.sign({ provider: 'kakao', state: 's', nonce: 'n', returnTo: '/' });

    now += 11 * 60 * 1000; // 10분 TTL 경과

    await expect(service.verify(token)).rejects.toThrow(OAuthStateError);
  });

  it('다른 시크릿으로 서명된 토큰(위조)은 거부한다', async () => {
    const signer = new OAuthStateService(SECRET);
    const verifier = new OAuthStateService('b'.repeat(32));
    const token = await signer.sign({ provider: 'kakao', state: 's', nonce: 'n', returnTo: '/' });

    await expect(verifier.verify(token)).rejects.toThrow(OAuthStateError);
  });

  it('형식이 잘못된 문자열은 거부한다', async () => {
    const service = new OAuthStateService(SECRET);

    await expect(service.verify('garbage')).rejects.toThrow(OAuthStateError);
  });
});
