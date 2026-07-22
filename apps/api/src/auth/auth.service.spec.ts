import { AuthService, OAuthCallbackError, RefreshTokenError } from './auth.service';
import { hashToken } from './token/refresh-token.util';
import type { AuthRepository, RefreshTokenRecord } from './auth.repository';
import type { OAuthProvider } from './providers/provider.types';
import { JwtService } from './token/jwt.service';
import { OAuthStateService } from './token/oauth-state.service';
import { RefreshJwtService } from './token/refresh-jwt.service';

const SECRET = 'a'.repeat(32);
const REFRESH_SECRET = 'r'.repeat(32);

function buildDeps(overrides: { repository?: Partial<jest.Mocked<AuthRepository>>; now?: () => number } = {}) {
  const repository = {
    upsertUser: jest.fn(),
    findUserById: jest.fn(),
    insertRefreshToken: jest.fn(),
    findRefreshTokenByHashForUpdate: jest.fn(),
    revokeToken: jest.fn(),
    revokeFamily: jest.fn(),
    withTransaction: jest.fn(async (fn: (client: unknown) => unknown) => fn({})),
    ...overrides.repository,
  } as unknown as jest.Mocked<AuthRepository>;

  const kakaoProvider: OAuthProvider = {
    name: 'kakao',
    buildAuthorizeUrl: jest.fn(({ state }) => `https://kauth.kakao.com/oauth/authorize?state=${state}`),
    exchangeCodeForProfile: jest.fn(async () => ({ providerUserId: 'kakao-1', nickname: '홍길동' })),
  };
  const naverProvider: OAuthProvider = {
    name: 'naver',
    buildAuthorizeUrl: jest.fn(({ state }) => `https://nid.naver.com/oauth2.0/authorize?state=${state}`),
    exchangeCodeForProfile: jest.fn(async () => ({ providerUserId: 'naver-1', nickname: '길동' })),
  };

  const now = overrides.now ?? (() => 0);
  const jwtService = new JwtService(SECRET, now);
  const stateService = new OAuthStateService(SECRET, now);
  const refreshJwtService = new RefreshJwtService(REFRESH_SECRET);
  const service = new AuthService(
    repository,
    { kakao: kakaoProvider, naver: naverProvider },
    jwtService,
    stateService,
    refreshJwtService,
    { webOrigin: 'https://web.example' },
    now,
  );

  return { service, repository, kakaoProvider, naverProvider, stateService, jwtService, refreshJwtService };
}

describe('AuthService.startLogin', () => {
  it('provider의 authorize URL과 서명된 state 쿠키를 반환한다', async () => {
    const { service, kakaoProvider } = buildDeps();

    const result = await service.startLogin('kakao', '/items/1');

    expect(result.url).toContain('kauth.kakao.com');
    expect(kakaoProvider.buildAuthorizeUrl).toHaveBeenCalledWith(
      expect.objectContaining({ redirectUri: 'https://web.example/api/auth/kakao/callback' }),
    );
    expect(typeof result.stateCookieValue).toBe('string');
  });

  it('네이버는 nonce 없이 state를 서명한다', async () => {
    const { service, stateService } = buildDeps();

    const result = await service.startLogin('naver', '/');
    const claims = await stateService.verify(result.stateCookieValue);

    expect(claims.nonce).toBeUndefined();
  });
});

describe('AuthService.handleCallback', () => {
  it('state가 일치하면 프로필을 조회해 사용자·세션을 발급한다', async () => {
    const { service, repository } = buildDeps();
    repository.upsertUser.mockResolvedValue({
      id: 'user-1',
      provider: 'kakao',
      providerUserId: 'kakao-1',
      nickname: '홍길동',
      createdAt: new Date(),
    });

    const login = await service.startLogin('kakao', '/items/1');
    const session = await service.handleCallback({
      provider: 'kakao',
      code: 'auth-code',
      state: new URL(login.url).searchParams.get('state') ?? '',
      stateCookieValue: login.stateCookieValue,
    });

    expect(session.user).toEqual({ id: 'user-1', nickname: '홍길동', provider: 'kakao' });
    expect(session.returnTo).toBe('/items/1');
    expect(typeof session.accessToken).toBe('string');
    expect(typeof session.refreshToken).toBe('string');
  });

  it('state 쿠키가 없으면 거부한다', async () => {
    const { service } = buildDeps();

    await expect(
      service.handleCallback({ provider: 'kakao', code: 'c', state: 's', stateCookieValue: undefined }),
    ).rejects.toThrow(OAuthCallbackError);
  });

  it('쿼리 state와 쿠키 안 state가 다르면 거부한다', async () => {
    const { service } = buildDeps();
    const login = await service.startLogin('kakao', '/');

    await expect(
      service.handleCallback({
        provider: 'kakao',
        code: 'c',
        state: '다른-state',
        stateCookieValue: login.stateCookieValue,
      }),
    ).rejects.toThrow(OAuthCallbackError);
  });

  it('state 쿠키에 담긴 provider와 콜백 provider가 다르면 거부한다 (제공자 간 재사용 방지)', async () => {
    const { service } = buildDeps();
    const login = await service.startLogin('kakao', '/');
    const state = new URL(login.url).searchParams.get('state') ?? '';

    await expect(
      service.handleCallback({ provider: 'naver', code: 'c', state, stateCookieValue: login.stateCookieValue }),
    ).rejects.toThrow(OAuthCallbackError);
  });
});

describe('AuthService.refresh', () => {
  it('유효한 토큰이면 회전(폐기+재발급)하고 새 토큰을 반환한다', async () => {
    const refreshJwtService = new RefreshJwtService(REFRESH_SECRET);
    const rawToken = await refreshJwtService.issue('user-1', 'family-1');
    const row: RefreshTokenRecord = {
      id: 'rt-1',
      userId: 'user-1',
      tokenHash: hashToken(rawToken),
      familyId: 'family-1',
      expiresAt: new Date(1000 * 60 * 60 * 24 * 30),
      revokedAt: null,
    };
    const { service, repository } = buildDeps({
      repository: { findRefreshTokenByHashForUpdate: jest.fn().mockResolvedValue(row) },
    });

    const result = await service.refresh(rawToken);

    expect(result.userId).toBe('user-1');
    expect(result.refreshToken).not.toBe(rawToken);
    expect(repository.revokeToken).toHaveBeenCalledWith(expect.anything(), 'rt-1');
    expect(repository.insertRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', familyId: 'family-1' }),
      expect.anything(),
    );
    expect(repository.revokeFamily).not.toHaveBeenCalled();
  });

  it('이미 폐기(재사용)된 토큰이 다시 제출되면 계열 전체를 폐기하고 거부한다', async () => {
    const refreshJwtService = new RefreshJwtService(REFRESH_SECRET);
    const rawToken = await refreshJwtService.issue('user-1', 'family-1');
    const row: RefreshTokenRecord = {
      id: 'rt-1',
      userId: 'user-1',
      tokenHash: hashToken(rawToken),
      familyId: 'family-1',
      expiresAt: new Date(1000 * 60 * 60 * 24 * 30),
      revokedAt: new Date(0),
    };
    const { service, repository } = buildDeps({
      repository: { findRefreshTokenByHashForUpdate: jest.fn().mockResolvedValue(row) },
    });

    await expect(service.refresh(rawToken)).rejects.toThrow(RefreshTokenError);

    expect(repository.revokeFamily).toHaveBeenCalledWith(expect.anything(), 'family-1');
    expect(repository.insertRefreshToken).not.toHaveBeenCalled();
  });

  it('서명이 위조/형식오류인 토큰은 DB 조회 없이 거부한다', async () => {
    const { service, repository } = buildDeps({
      repository: { findRefreshTokenByHashForUpdate: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.refresh('not-a-jwt')).rejects.toThrow(RefreshTokenError);
    expect(repository.findRefreshTokenByHashForUpdate).not.toHaveBeenCalled();
    expect(repository.revokeFamily).not.toHaveBeenCalled();
  });

  it('서명은 유효하지만 DB에 없는(이미 정리된) 토큰은 거부한다', async () => {
    const refreshJwtService = new RefreshJwtService(REFRESH_SECRET);
    const rawToken = await refreshJwtService.issue('user-1', 'family-1');
    const { service, repository } = buildDeps({
      repository: { findRefreshTokenByHashForUpdate: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.refresh(rawToken)).rejects.toThrow(RefreshTokenError);
    expect(repository.revokeFamily).not.toHaveBeenCalled();
  });

  it('경계값: 만료 시각이 지난 토큰은 거부한다', async () => {
    const refreshJwtService = new RefreshJwtService(REFRESH_SECRET);
    const rawToken = await refreshJwtService.issue('user-1', 'family-1');
    const row: RefreshTokenRecord = {
      id: 'rt-1',
      userId: 'user-1',
      tokenHash: hashToken(rawToken),
      familyId: 'family-1',
      expiresAt: new Date(500),
      revokedAt: null,
    };
    const { service } = buildDeps({
      repository: { findRefreshTokenByHashForUpdate: jest.fn().mockResolvedValue(row) },
      now: () => 1000,
    });

    await expect(service.refresh(rawToken)).rejects.toThrow(RefreshTokenError);
  });
});

describe('AuthService.logout', () => {
  it('제출된 토큰이 속한 계열 전체를 폐기한다', async () => {
    const refreshJwtService = new RefreshJwtService(REFRESH_SECRET);
    const rawToken = await refreshJwtService.issue('user-1', 'family-1');
    const row: RefreshTokenRecord = {
      id: 'rt-1',
      userId: 'user-1',
      tokenHash: hashToken(rawToken),
      familyId: 'family-1',
      expiresAt: new Date(),
      revokedAt: null,
    };
    const { service, repository } = buildDeps({
      repository: { findRefreshTokenByHashForUpdate: jest.fn().mockResolvedValue(row) },
    });

    await service.logout(rawToken);

    expect(repository.revokeFamily).toHaveBeenCalledWith(expect.anything(), 'family-1');
  });

  it('모르는(형식이 잘못된) 토큰이어도 조용히 종료한다', async () => {
    const { service, repository } = buildDeps({
      repository: { findRefreshTokenByHashForUpdate: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.logout('unknown')).resolves.toBeUndefined();
    expect(repository.revokeFamily).not.toHaveBeenCalled();
  });
});

describe('AuthService.me', () => {
  it('사용자를 찾으면 최소 정보를 반환한다', async () => {
    const { service, repository } = buildDeps();
    repository.findUserById.mockResolvedValue({
      id: 'user-1',
      provider: 'kakao',
      providerUserId: 'kakao-1',
      nickname: '홍길동',
      createdAt: new Date(),
    });

    expect(await service.me('user-1')).toEqual({ id: 'user-1', nickname: '홍길동', provider: 'kakao' });
  });

  it('사용자가 없으면 null을 반환한다', async () => {
    const { service, repository } = buildDeps();
    repository.findUserById.mockResolvedValue(null);

    expect(await service.me('missing')).toBeNull();
  });
});
