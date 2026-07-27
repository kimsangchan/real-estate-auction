// env 검증 단위 테스트 — 정상/실패/경계값 (AGENTS.md 규칙 11)
import { loadEnv } from './env';

const VALID_DB_URL = 'postgresql://app:changeme@localhost:5432/auction';

const VALID_AUTH_ENV = {
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  OAUTH_STATE_SECRET: 'c'.repeat(32),
  KAKAO_OAUTH_CLIENT_ID: 'kakao-client-id',
  KAKAO_OAUTH_CLIENT_SECRET: 'kakao-client-secret',
  NAVER_OAUTH_CLIENT_ID: 'naver-client-id',
  NAVER_OAUTH_CLIENT_SECRET: 'naver-client-secret',
};

const VALID_ENV = { DATABASE_URL: VALID_DB_URL, ...VALID_AUTH_ENV };

describe('loadEnv', () => {
  it('유효한 환경 변수를 파싱하고 기본값을 채운다', () => {
    const env = loadEnv(VALID_ENV);
    expect(env.DATABASE_URL).toBe(VALID_DB_URL);
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.AUTH_WEB_ORIGIN).toBe('http://localhost:3000');
  });

  it('DATABASE_URL이 없으면 기동을 중단한다', () => {
    expect(() => loadEnv({})).toThrow('환경 변수 검증 실패');
  });

  it('DATABASE_URL 스킴이 잘못되면 거부한다', () => {
    expect(() => loadEnv({ ...VALID_ENV, DATABASE_URL: 'mysql://x' })).toThrow('환경 변수 검증 실패');
  });

  it('경계값: PORT=0은 거부, PORT=65535는 허용', () => {
    expect(() => loadEnv({ ...VALID_ENV, PORT: '0' })).toThrow();
    expect(loadEnv({ ...VALID_ENV, PORT: '65535' }).PORT).toBe(65535);
  });

  it('JWT 시크릿이 없으면 기동을 중단한다', () => {
    expect(() => loadEnv({ DATABASE_URL: VALID_DB_URL, ...VALID_AUTH_ENV, JWT_ACCESS_SECRET: undefined })).toThrow(
      '환경 변수 검증 실패',
    );
  });

  it('경계값: JWT 시크릿이 32자 미만이면 거부한다', () => {
    expect(() => loadEnv({ ...VALID_ENV, JWT_ACCESS_SECRET: 'a'.repeat(31) })).toThrow('환경 변수 검증 실패');
  });

  it('OAUTH_STATE_SECRET이 없거나 32자 미만이면 기동을 중단한다 (WP-08b §0-1)', () => {
    expect(() => loadEnv({ DATABASE_URL: VALID_DB_URL, ...VALID_AUTH_ENV, OAUTH_STATE_SECRET: undefined })).toThrow(
      '환경 변수 검증 실패',
    );
    expect(() => loadEnv({ ...VALID_ENV, OAUTH_STATE_SECRET: 'c'.repeat(31) })).toThrow('환경 변수 검증 실패');
  });

  it('카카오·네이버 OAuth 클라이언트 값이 없으면 기동을 중단한다', () => {
    expect(() => loadEnv({ ...VALID_ENV, KAKAO_OAUTH_CLIENT_ID: '' })).toThrow('환경 변수 검증 실패');
  });

  it('AUTH_WEB_ORIGIN을 지정하면 그 값을 쓰고, URL 형식이 아니면 거부한다', () => {
    expect(loadEnv({ ...VALID_ENV, AUTH_WEB_ORIGIN: 'https://auction.example.com' }).AUTH_WEB_ORIGIN).toBe(
      'https://auction.example.com',
    );
    expect(() => loadEnv({ ...VALID_ENV, AUTH_WEB_ORIGIN: 'not-a-url' })).toThrow('환경 변수 검증 실패');
  });
});
