// 모바일 교환 코드 단위 테스트 — 정상/실패/경계값 (AGENTS.md 규칙 11)
import { MobileExchangeError, MobileExchangeService, s256CodeChallenge } from './mobile-exchange.service';
import { OAuthStateService } from './oauth-state.service';

const SECRET = 's'.repeat(32);
const VERIFIER = 'v'.repeat(43);

describe('MobileExchangeService', () => {
  it('발급한 코드를 올바른 verifier로 소모하면 userId를 돌려준다', async () => {
    const service = new MobileExchangeService(SECRET, () => 0);
    const code = await service.issue('user-1', s256CodeChallenge(VERIFIER));

    await expect(service.consume(code, VERIFIER)).resolves.toEqual({ userId: 'user-1' });
  });

  it('같은 코드는 두 번 소모할 수 없다 (1회용)', async () => {
    const service = new MobileExchangeService(SECRET, () => 0);
    const code = await service.issue('user-1', s256CodeChallenge(VERIFIER));

    await service.consume(code, VERIFIER);
    await expect(service.consume(code, VERIFIER)).rejects.toThrow('이미 사용된 교환 코드예요');
  });

  it('verifier가 틀리면 거부하고, 그 시도로 코드가 소모된다 (브루트포스 차단)', async () => {
    const service = new MobileExchangeService(SECRET, () => 0);
    const code = await service.issue('user-1', s256CodeChallenge(VERIFIER));

    await expect(service.consume(code, 'w'.repeat(43))).rejects.toThrow('코드 검증값이 일치하지 않아요');
    await expect(service.consume(code, VERIFIER)).rejects.toThrow('이미 사용된 교환 코드예요');
  });

  it('경계값: TTL 60초 — 60초 직전은 허용, 이후는 만료', async () => {
    let nowMs = 0;
    const service = new MobileExchangeService(SECRET, () => nowMs);
    const code = await service.issue('user-1', s256CodeChallenge(VERIFIER));

    nowMs = 59 * 1000;
    await expect(service.consume(code, VERIFIER)).resolves.toEqual({ userId: 'user-1' });

    const code2 = await service.issue('user-2', s256CodeChallenge(VERIFIER));
    nowMs = 59 * 1000 + 61 * 1000;
    await expect(service.consume(code2, VERIFIER)).rejects.toThrow('교환 코드가 만료됐어요');
  });

  it('같은 시크릿으로 서명된 state 토큰은 typ이 달라 거부한다 (교차 사용 차단)', async () => {
    const stateService = new OAuthStateService(SECRET, () => 0);
    const stateToken = await stateService.sign({ provider: 'kakao', state: 's1', returnTo: '/' });
    const service = new MobileExchangeService(SECRET, () => 0);

    await expect(service.consume(stateToken, VERIFIER)).rejects.toThrow('교환 코드 클레임이 올바르지 않아요');
  });

  it('서명이 위조된 코드는 거부한다', async () => {
    const service = new MobileExchangeService(SECRET, () => 0);
    const other = new MobileExchangeService('x'.repeat(32), () => 0);
    const forged = await other.issue('user-1', s256CodeChallenge(VERIFIER));

    await expect(service.consume(forged, VERIFIER)).rejects.toThrow(MobileExchangeError);
  });
});
