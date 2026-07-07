// env 검증 단위 테스트 — 정상/실패/경계값 (AGENTS.md 규칙 11)
import { loadEnv } from './env';

const VALID_DB_URL = 'postgresql://app:changeme@localhost:5432/auction';

describe('loadEnv', () => {
  it('유효한 환경 변수를 파싱하고 기본값을 채운다', () => {
    const env = loadEnv({ DATABASE_URL: VALID_DB_URL });
    expect(env.DATABASE_URL).toBe(VALID_DB_URL);
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('DATABASE_URL이 없으면 기동을 중단한다', () => {
    expect(() => loadEnv({})).toThrow('환경 변수 검증 실패');
  });

  it('DATABASE_URL 스킴이 잘못되면 거부한다', () => {
    expect(() => loadEnv({ DATABASE_URL: 'mysql://x' })).toThrow('환경 변수 검증 실패');
  });

  it('경계값: PORT=0은 거부, PORT=65535는 허용', () => {
    expect(() => loadEnv({ DATABASE_URL: VALID_DB_URL, PORT: '0' })).toThrow();
    expect(loadEnv({ DATABASE_URL: VALID_DB_URL, PORT: '65535' }).PORT).toBe(65535);
  });
});
