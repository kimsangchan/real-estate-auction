import type { IncomingMessage, ServerResponse } from 'node:http';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService, OAuthCallbackError, RefreshTokenError } from './auth.service';

function createRes(): ServerResponse {
  return {
    statusCode: 0,
    setHeader: jest.fn(),
    end: jest.fn(),
  } as unknown as ServerResponse;
}

function createReq(cookie?: string): IncomingMessage {
  return { headers: { cookie } } as IncomingMessage;
}

describe('AuthController.startLogin', () => {
  it('provider의 authorize URL로 302 리다이렉트하고 state 쿠키를 설정한다', async () => {
    const authService = {
      startLogin: jest.fn().mockResolvedValue({ url: 'https://kauth.kakao.com/authorize?x=1', stateCookieValue: 'signed-state' }),
    } as unknown as AuthService;
    const controller = new AuthController(authService);
    const res = createRes();

    await controller.startLogin('kakao', '/items/1', res);

    expect(authService.startLogin).toHaveBeenCalledWith('kakao', '/items/1');
    expect(res.statusCode).toBe(302);
    expect(res.setHeader).toHaveBeenCalledWith('Location', 'https://kauth.kakao.com/authorize?x=1');
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', [expect.stringContaining('oauth_state=signed-state')]);
  });

  it('지원하지 않는 provider는 BadRequestException을 던진다', async () => {
    const authService = { startLogin: jest.fn() } as unknown as AuthService;
    const controller = new AuthController(authService);

    await expect(controller.startLogin('apple', undefined, createRes())).rejects.toThrow();
    expect(authService.startLogin).not.toHaveBeenCalled();
  });

  it('returnTo가 //로 시작하면(오픈 리다이렉트 방지) 기본값 /로 대체한다', async () => {
    const authService = {
      startLogin: jest.fn().mockResolvedValue({ url: 'https://kauth.kakao.com/authorize', stateCookieValue: 's' }),
    } as unknown as AuthService;
    const controller = new AuthController(authService);

    await controller.startLogin('kakao', '//evil.example', createRes());

    expect(authService.startLogin).toHaveBeenCalledWith('kakao', '/');
  });
});

describe('AuthController.callback', () => {
  it('성공하면 세션 쿠키를 설정하고 returnTo로 리다이렉트한다', async () => {
    const authService = {
      webOrigin: 'https://web.example',
      handleCallback: jest.fn().mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        user: { id: 'u1', nickname: '홍길동', provider: 'kakao' },
        returnTo: '/items/1',
      }),
    } as unknown as AuthService;
    const controller = new AuthController(authService);
    const res = createRes();

    await controller.callback('kakao', 'code-1', 'state-1', undefined, createReq('oauth_state=cookie-val'), res);

    expect(res.statusCode).toBe(302);
    expect(res.setHeader).toHaveBeenCalledWith('Location', 'https://web.example/items/1');
    const setCookieCall = (res.setHeader as jest.Mock).mock.calls.find((call) => call[0] === 'Set-Cookie');
    expect(setCookieCall[1].some((c: string) => c.startsWith('access_token='))).toBe(true);
    expect(setCookieCall[1].some((c: string) => c.startsWith('refresh_token='))).toBe(true);
  });

  it('provider가 error를 보내면 /login?error로 리다이렉트한다', async () => {
    const authService = { webOrigin: 'https://web.example', handleCallback: jest.fn() } as unknown as AuthService;
    const controller = new AuthController(authService);
    const res = createRes();

    await controller.callback('kakao', undefined, undefined, 'access_denied', createReq(), res);

    expect(res.setHeader).toHaveBeenCalledWith('Location', 'https://web.example/login?error=oauth_failed');
    expect(authService.handleCallback).not.toHaveBeenCalled();
  });

  it('state 불일치(OAuthCallbackError)는 /login?error로 리다이렉트한다', async () => {
    const authService = {
      webOrigin: 'https://web.example',
      handleCallback: jest.fn().mockRejectedValue(new OAuthCallbackError('state 불일치')),
    } as unknown as AuthService;
    const controller = new AuthController(authService);
    const res = createRes();

    await controller.callback('kakao', 'code-1', 'wrong-state', undefined, createReq('oauth_state=cookie-val'), res);

    expect(res.setHeader).toHaveBeenCalledWith('Location', 'https://web.example/login?error=oauth_failed');
  });
});

describe('AuthController.refresh', () => {
  it('리프레시 토큰 쿠키가 없으면 UnauthorizedException을 던진다', async () => {
    const authService = { refresh: jest.fn() } as unknown as AuthService;
    const controller = new AuthController(authService);

    await expect(controller.refresh(createReq(), createRes())).rejects.toThrow(UnauthorizedException);
  });

  it('회전 성공 시 새 세션 쿠키를 설정하고 accessToken을 반환한다', async () => {
    const authService = {
      refresh: jest.fn().mockResolvedValue({ accessToken: 'new-at', refreshToken: 'new-rt', userId: 'u1' }),
    } as unknown as AuthService;
    const controller = new AuthController(authService);
    const res = createRes();

    const result = await controller.refresh(createReq('refresh_token=old-rt'), res);

    expect(result).toEqual({ accessToken: 'new-at' });
    expect(res.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.arrayContaining([expect.stringContaining('refresh_token=new-rt')]),
    );
  });

  it('재사용 감지(RefreshTokenError) 시 쿠키를 만료시키고 401을 던진다', async () => {
    const authService = { refresh: jest.fn().mockRejectedValue(new RefreshTokenError('재사용 감지')) } as unknown as AuthService;
    const controller = new AuthController(authService);
    const res = createRes();

    await expect(controller.refresh(createReq('refresh_token=old-rt'), res)).rejects.toThrow(UnauthorizedException);
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.arrayContaining([expect.stringContaining('Max-Age=0')]));
  });
});

describe('AuthController.logout', () => {
  it('쿠키를 만료시키고 성공을 반환한다', async () => {
    const authService = { logout: jest.fn().mockResolvedValue(undefined) } as unknown as AuthService;
    const controller = new AuthController(authService);
    const res = createRes();

    const result = await controller.logout(createReq('refresh_token=rt-1'), res);

    expect(result).toEqual({ success: true });
    expect(authService.logout).toHaveBeenCalledWith('rt-1');
  });
});

describe('AuthController.me', () => {
  it('req.user가 없으면 UnauthorizedException을 던진다', async () => {
    const authService = { me: jest.fn() } as unknown as AuthService;
    const controller = new AuthController(authService);

    await expect(controller.me({ headers: {} } as never)).rejects.toThrow(UnauthorizedException);
  });

  it('사용자 정보를 반환한다', async () => {
    const authService = { me: jest.fn().mockResolvedValue({ id: 'u1', nickname: '홍길동', provider: 'kakao' }) } as unknown as AuthService;
    const controller = new AuthController(authService);

    const result = await controller.me({ headers: {}, user: { id: 'u1' } } as never);

    expect(result).toEqual({ id: 'u1', nickname: '홍길동', provider: 'kakao' });
  });
});
