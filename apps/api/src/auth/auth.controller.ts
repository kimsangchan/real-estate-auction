// 인증 컨트롤러 — 로그인 시작·콜백·리프레시·로그아웃·me. 응답 제어를 직접 하기 위해
// express 타입 대신 Node 내장 http 타입만 쓴다(express는 워크스페이스 직접 의존성이 아님, AGENTS.md 규칙 14)
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Controller, Get, HttpCode, Param, Post, Query, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService, OAuthCallbackError, RefreshTokenError } from './auth.service';
import { assertProvider } from './providers/provider.types';
import { expireCookie, parseCookies, serializeCookie } from './util/cookie.util';
import { AuthenticatedRequest, JwtAuthGuard } from './guards/jwt-auth.guard';

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const STATE_COOKIE = 'oauth_state';
const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60;
const REFRESH_TOKEN_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;
const STATE_COOKIE_MAX_AGE_SECONDS = 10 * 60;

function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

function isSafeReturnPath(value: string | undefined): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');
}

function redirectTo(res: ServerResponse, url: string): void {
  res.statusCode = 302;
  res.setHeader('Location', url);
  res.end();
}

function sessionCookies(accessToken: string, refreshToken: string): string[] {
  return [
    serializeCookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAgeSeconds: ACCESS_TOKEN_MAX_AGE_SECONDS,
      secure: isProductionEnv(),
    }),
    serializeCookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAgeSeconds: REFRESH_TOKEN_MAX_AGE_SECONDS,
      secure: isProductionEnv(),
    }),
  ];
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 정적 경로(me)는 동적 파라미터 경로(:provider)보다 먼저 선언해야 한다 — Express/Nest는 라우트를
  // 선언 순서대로 매칭하므로, :provider가 먼저면 GET /auth/me가 provider="me"로 삼켜진다
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: AuthenticatedRequest): Promise<{ id: string; nickname: string; provider: string }> {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    const user = await this.authService.me(userId);
    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없어요');
    }
    return user;
  }

  @Get(':provider')
  async startLogin(
    @Param('provider') providerParam: string,
    @Query('returnTo') returnToParam: string | undefined,
    @Res() res: ServerResponse,
  ): Promise<void> {
    const provider = assertProvider(providerParam);
    const returnTo = isSafeReturnPath(returnToParam) ? returnToParam : '/';

    const { url, stateCookieValue } = await this.authService.startLogin(provider, returnTo);

    res.setHeader('Set-Cookie', [
      serializeCookie(STATE_COOKIE, stateCookieValue, {
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
        maxAgeSeconds: STATE_COOKIE_MAX_AGE_SECONDS,
        secure: isProductionEnv(),
      }),
    ]);
    redirectTo(res, url);
  }

  @Get(':provider/callback')
  async callback(
    @Param('provider') providerParam: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') providerError: string | undefined,
    @Req() req: IncomingMessage,
    @Res() res: ServerResponse,
  ): Promise<void> {
    const provider = assertProvider(providerParam);
    const webOrigin = this.authService.webOrigin;

    if (providerError || !code || !state) {
      redirectTo(res, `${webOrigin}/login?error=oauth_failed`);
      return;
    }

    const stateCookieValue = parseCookies(req.headers.cookie)[STATE_COOKIE];

    try {
      const session = await this.authService.handleCallback({ provider, code, state, stateCookieValue });
      res.setHeader('Set-Cookie', [...sessionCookies(session.accessToken, session.refreshToken), expireCookie(STATE_COOKIE)]);
      redirectTo(res, `${webOrigin}${session.returnTo}`);
    } catch (cause) {
      if (cause instanceof OAuthCallbackError) {
        res.setHeader('Set-Cookie', [expireCookie(STATE_COOKIE)]);
        redirectTo(res, `${webOrigin}/login?error=oauth_failed`);
        return;
      }
      throw cause;
    }
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: IncomingMessage, @Res({ passthrough: true }) res: ServerResponse): Promise<{ accessToken: string }> {
    const rawRefreshToken = parseCookies(req.headers.cookie)[REFRESH_TOKEN_COOKIE];
    if (!rawRefreshToken) {
      throw new UnauthorizedException('리프레시 토큰이 없어요');
    }

    try {
      const result = await this.authService.refresh(rawRefreshToken);
      res.setHeader('Set-Cookie', sessionCookies(result.accessToken, result.refreshToken));
      return { accessToken: result.accessToken };
    } catch (cause) {
      if (cause instanceof RefreshTokenError) {
        res.setHeader('Set-Cookie', [expireCookie(ACCESS_TOKEN_COOKIE), expireCookie(REFRESH_TOKEN_COOKIE)]);
        throw new UnauthorizedException(cause.message);
      }
      throw cause;
    }
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: IncomingMessage, @Res({ passthrough: true }) res: ServerResponse): Promise<{ success: true }> {
    const rawRefreshToken = parseCookies(req.headers.cookie)[REFRESH_TOKEN_COOKIE];
    if (rawRefreshToken) {
      await this.authService.logout(rawRefreshToken);
    }
    res.setHeader('Set-Cookie', [expireCookie(ACCESS_TOKEN_COOKIE), expireCookie(REFRESH_TOKEN_COOKIE)]);
    return { success: true };
  }
}
