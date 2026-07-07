// 헬스체크 컨트롤러 단위 테스트 (AGENTS.md 규칙 11)
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('status ok와 버전 문자열을 반환한다', () => {
    const controller = new HealthController();
    const response = controller.check();
    expect(response.status).toBe('ok');
    expect(typeof response.version).toBe('string');
    expect(response.version.length).toBeGreaterThan(0);
  });
});
