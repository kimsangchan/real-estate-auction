import type { IncomingMessage, ServerResponse } from 'node:http';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService, OAuthCallbackError, RefreshTokenError } from './auth.service';
import { OAuthProviderError } from './providers/provider.types';
import { MobileExchangeError } from './token/mobile-exchange.service';

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
      webOrigin: 'http://localhost:3000',
      startLogin: jest.fn().mockResolvedValue({ url: 'https://kauth.kakao.com/authorize?x=1', stateCookieValue: 'signed-state' }),
    } as unknown as AuthService;
    const controller = new AuthController(authService);
    const res = createRes();

    await controller.startLogin('kakao', '/items/1', undefined, undefined, res);

    expect(authService.startLogin).toHaveBeenCalledWith('kakao', '/items/1', undefined);
    expect(res.statusCode).toBe(302);
    expect(res.setHeader).toHaveBeenCalledWith('Location', 'https://kauth.kakao.com/authorize?x=1');
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', [expect.stringContaining('oauth_state=signed-state')]);
  });

  it('지원하지 않는 provider는 BadRequestException을 던진다', async () => {
    const authService = { startLogin: jest.fn() } as unknown as AuthService;
    const controller = new AuthController(authService);

    await expect(controller.startLogin('apple', undefined, undefined, undefined, createRes())).rejects.toThrow();
    expect(authService.startLogin).not.toHaveBeenCalled();
  });

  it('returnTo가 //나 /\\로 시작하면(오픈 리다이렉트 방지) 기본값 /로 대체한다', async () => {
    const authService = {
      webOrigin: 'http://localhost:3000',
      startLogin: jest.fn().mockResolvedValue({ url: 'https://kauth.kakao.com/authorize', stateCookieValue: 's' }),
    } as unknown as AuthService;
    const controller = new AuthController(authService);

    await controller.startLogin('kakao', '//evil.example', undefined, undefined, createRes());
    expect(authService.startLogin).toHaveBeenCalledWith('kakao', '/', undefined);

    await controller.startLogin('kakao', '/\\evil.example', undefined, undefined, createRes());
    expect(authService.startLogin).toHaveBeenLastCalledWith('kakao', '/', undefined);
  });

  it('client=mobile이면 codeChallenge를 서비스로 전달한다 (WP-08b §1-1)', async () => {
    const authService = {
      webOrigin: 'http://localhost:3000',
      startLogin: jest.fn().mockResolvedValue({ url: 'https://kauth.kakao.com/authorize', stateCookieValue: 's' }),
    } as unknown as AuthService;
    const controller = new AuthController(authService);
    const challenge = 'c'.repeat(43);

    await controller.startLogin('kakao', undefined, 'mobile', challenge, createRes());

    expect(authService.startLogin).toHaveBeenCalledWith('kakao', '/', { codeChallenge: challenge });
  });

  it('client=mobile인데 codeChallenge가 없거나 형식이 틀리면 400을 던진다', async () => {
    const authService = { startLogin: jest.fn() } as unknown as AuthService;
    const controller = new AuthController(authService);

    await expect(controller.startLogin('kakao', undefined, 'mobile', undefined, createRes())).rejects.toThrow(
      BadRequestException,
    );
    await expect(controller.startLogin('kakao', undefined, 'mobile', 'short', createRes())).rejects.toThrow(
      BadRequestException,
    );
    expect(authService.startLogin).not.toHaveBeenCalled();
  });

  it('client 값이 mobile이 아니면 400을 던진다', async () => {
    const authService = { startLogin: jest.fn() } as unknown as AuthService;
    const controller = new AuthController(authService);

    await expect(controller.startLogin('kakao', undefined, 'web-ish', undefined, createRes())).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('AuthController.callback', () => {
  it('성공하면 세션 쿠키를 설정하고 returnTo로 리다이렉트한다', async () => {
    const authService = {
      webOrigin: 'https://web.example',
      handleCallback: jest.fn().mockResolvedValue({
        kind: 'web',
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

  it('모바일 결과면 쿠키 세션 없이 딥링크 중간 페이지로 응답한다 (WP-08b §1-1, §3-2)', async () => {
    const authService = {
      webOrigin: 'https://web.example',
      handleCallback: jest.fn().mockResolvedValue({ kind: 'mobile', exchangeCode: 'xc-1' }),
    } as unknown as AuthService;
    const controller = new AuthController(authService);
    const res = createRes();

    await controller.callback('kakao', 'code-1', 'state-1', undefined, createReq('oauth_state=cookie-val'), res);

    expect(res.statusCode).toBe(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
    const html = (res.end as jest.Mock).mock.calls[0][0] as string;
    expect(html).toContain('auction://auth/callback?code=xc-1');
    // 세션 쿠키가 설정되면 안 된다 — state 쿠키 만료만 허용
    const setCookieCall = (res.setHeader as jest.Mock).mock.calls.find((call) => call[0] === 'Set-Cookie');
    expect(setCookieCall[1].some((c: string) => c.startsWith('access_token=') || c.startsWith('refresh_token='))).toBe(
      false,
    );
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

  it('provider 인증 실패(OAuthProviderError 계열)도 500이 아니라 /login?error로 리다이렉트한다', async () => {
    const authService = {
      webOrigin: 'https://web.example',
      handleCallback: jest.fn().mockRejectedValue(new OAuthProviderError('토큰 교환 실패')),
    } as unknown as AuthService;
    const controller = new AuthController(authService);
    const res = createRes();

    await controller.callback('kakao', 'code-1', 'state-1', undefined, createReq('oauth_state=cookie-val'), res);

    expect(res.setHeader).toHaveBeenCalledWith('Location', 'https://web.example/login?error=oauth_failed');
  });

  it('예상외 서버 오류(DB 등)는 삼키지 않고 그대로 던진다', async () => {
    const authService = {
      webOrigin: 'https://web.example',
      handleCallback: jest.fn().mockRejectedValue(new Error('DB 연결 끊김')),
    } as unknown as AuthService;
    const controller = new AuthController(authService);

    await expect(
      controller.callback('kakao', 'code-1', 'state-1', undefined, createReq('oauth_state=cookie-val'), createRes()),
    ).rejects.toThrow('DB 연결 끊김');
  });
});

describe('AuthController.refresh', () => {
  it('쿠키도 body도 없으면 UnauthorizedException을 던진다', async () => {
    const authService = { refresh: jest.fn() } as unknown as AuthService;
    const controller = new AuthController(authService);

    await expect(controller.refresh({}, createReq(), createRes())).rejects.toThrow(UnauthorizedException);
  });

  it('쿠키 회전 성공 시 새 세션 쿠키를 설정하고 accessToken만 반환한다', async () => {
    const authService = {
      webOrigin: 'http://localhost:3000',
      refresh: jest.fn().mockResolvedValue({ accessToken: 'new-at', refreshToken: 'new-rt', userId: 'u1' }),
    } as unknown as AuthService;
    const controller = new AuthController(authService);
    const res = createRes();

    const result = await controller.refresh({}, createReq('refresh_token=old-rt'), res);

    expect(result).toEqual({ accessToken: 'new-at' });
    expect(res.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.arrayContaining([expect.stringContaining('refresh_token=new-rt')]),
    );
  });

  it('body 방식(모바일)은 쿠키 없이 토큰 쌍을 JSON으로 반환한다 (WP-08b §1-5)', async () => {
    const authService = {
      webOrigin: 'http://localhost:3000',
      refresh: jest.fn().mockResolvedValue({ accessToken: 'new-at', refreshToken: 'new-rt', userId: 'u1' }),
    } as unknown as AuthService;
    const controller = new AuthController(authService);
    const res = createRes();

    const result = await controller.refresh({ refreshToken: 'old-rt' }, createReq(), res);

    expect(result).toEqual({ accessToken: 'new-at', refreshToken: 'new-rt' });
    expect(authService.refresh).toHaveBeenCalledWith('old-rt');
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('쿠키가 있으면 body보다 쿠키를 우선한다 (웹 동작 무변경)', async () => {
    const authService = {
      webOrigin: 'http://localhost:3000',
      refresh: jest.fn().mockResolvedValue({ accessToken: 'new-at', refreshToken: 'new-rt', userId: 'u1' }),
    } as unknown as AuthService;
    const controller = new AuthController(authService);

    const result = await controller.refresh({ refreshToken: 'body-rt' }, createReq('refresh_token=cookie-rt'), createRes());

    expect(authService.refresh).toHaveBeenCalledWith('cookie-rt');
    expect(result).toEqual({ accessToken: 'new-at' });
  });

  it('쿠키 방식 재사용 감지(RefreshTokenError) 시 쿠키를 만료시키고 401을 던진다', async () => {
    const authService = { refresh: jest.fn().mockRejectedValue(new RefreshTokenError('재사용 감지')) } as unknown as AuthService;
    const controller = new AuthController(authService);
    const res = createRes();

    await expect(controller.refresh({}, createReq('refresh_token=old-rt'), res)).rejects.toThrow(UnauthorizedException);
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.arrayContaining([expect.stringContaining('Max-Age=0')]));
  });

  it('body 방식 실패 시 쿠키를 건드리지 않고 401을 던진다', async () => {
    const authService = { refresh: jest.fn().mockRejectedValue(new RefreshTokenError('만료')) } as unknown as AuthService;
    const controller = new AuthController(authService);
    const res = createRes();

    await expect(controller.refresh({ refreshToken: 'old-rt' }, createReq(), res)).rejects.toThrow(UnauthorizedException);
    expect(res.setHeader).not.toHaveBeenCalled();
  });
});

describe('AuthController.mobileToken', () => {
  it('교환 성공 시 토큰 쌍을 반환한다', async () => {
    const authService = {
      exchangeMobileCode: jest.fn().mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' }),
    } as unknown as AuthService;
    const controller = new AuthController(authService);

    const result = await controller.mobileToken({ code: 'xc-1', codeVerifier: 'v'.repeat(43) });

    expect(result).toEqual({ accessToken: 'at', refreshToken: 'rt' });
    expect(authService.exchangeMobileCode).toHaveBeenCalledWith('xc-1', 'v'.repeat(43));
  });

  it('교환 실패(MobileExchangeError)는 사유를 감추고 401로 통일한다 (규칙 8)', async () => {
    const authService = {
      exchangeMobileCode: jest.fn().mockRejectedValue(new MobileExchangeError('이미 사용된 교환 코드예요')),
    } as unknown as AuthService;
    const controller = new AuthController(authService);

    await expect(controller.mobileToken({ code: 'xc-1', codeVerifier: 'v'.repeat(43) })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('예상외 서버 오류는 그대로 던진다', async () => {
    const authService = {
      exchangeMobileCode: jest.fn().mockRejectedValue(new Error('DB 연결 끊김')),
    } as unknown as AuthService;
    const controller = new AuthController(authService);

    await expect(controller.mobileToken({ code: 'xc-1', codeVerifier: 'v'.repeat(43) })).rejects.toThrow('DB 연결 끊김');
  });
});

describe('AuthController.logout', () => {
  it('쿠키를 만료시키고 성공을 반환한다', async () => {
    const authService = { logout: jest.fn().mockResolvedValue(undefined) } as unknown as AuthService;
    const controller = new AuthController(authService);
    const res = createRes();

    const result = await controller.logout({}, createReq('refresh_token=rt-1'), res);

    expect(result).toEqual({ success: true });
    expect(authService.logout).toHaveBeenCalledWith('rt-1');
  });

  it('body의 리프레시 토큰(모바일)도 폐기한다', async () => {
    const authService = { logout: jest.fn().mockResolvedValue(undefined) } as unknown as AuthService;
    const controller = new AuthController(authService);

    await controller.logout({ refreshToken: 'body-rt' }, createReq(), createRes());

    expect(authService.logout).toHaveBeenCalledWith('body-rt');
  });
});

describe('AuthController.deleteMe', () => {
  it('계정을 삭제하고 세션 쿠키를 만료시킨다 (WP-08b §1-5)', async () => {
    const authService = { deleteAccount: jest.fn().mockResolvedValue(undefined) } as unknown as AuthService;
    const controller = new AuthController(authService);
    const res = createRes();

    const result = await controller.deleteMe({ headers: {}, user: { id: 'u1' } } as never, res);

    expect(result).toEqual({ success: true });
    expect(authService.deleteAccount).toHaveBeenCalledWith('u1');
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.arrayContaining([expect.stringContaining('Max-Age=0')]));
  });

  it('req.user가 없으면 UnauthorizedException을 던진다', async () => {
    const authService = { deleteAccount: jest.fn() } as unknown as AuthService;
    const controller = new AuthController(authService);

    await expect(controller.deleteMe({ headers: {} } as never, createRes())).rejects.toThrow(UnauthorizedException);
    expect(authService.deleteAccount).not.toHaveBeenCalled();
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
