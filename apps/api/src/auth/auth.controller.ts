// 인증 컨트롤러 — 로그인 시작·콜백·리프레시·로그아웃·me. 응답 제어를 직접 하기 위해
// express 타입 대신 Node 내장 http 타입만 쓴다(express는 워크스페이스 직접 의존성이 아님, AGENTS.md 규칙 14)
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService, OAuthCallbackError, RefreshTokenError } from './auth.service';
import { MobileTokenRequestDto } from './dto/mobile-token-request.dto';
import { RefreshTokenBodyDto } from './dto/refresh-token-body.dto';
import { assertProvider, OAuthProviderError } from './providers/provider.types';
import { MobileExchangeError } from './token/mobile-exchange.service';
import { expireCookie, parseCookies, serializeCookie } from './util/cookie.util';
import { AuthenticatedRequest, JwtAuthGuard } from './guards/jwt-auth.guard';

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const STATE_COOKIE = 'oauth_state';
const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60;
const REFRESH_TOKEN_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;
const STATE_COOKIE_MAX_AGE_SECONDS = 10 * 60;

// 모바일 앱 딥링크 — AndroidManifest intent-filter와 일치해야 한다 (WP-08b §1-2)
const MOBILE_DEEP_LINK_BASE = 'auction://auth/callback';
// RFC 7636 §4.2 — code_challenge(S256 결과)의 문자 집합·길이
const CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;

// Secure 속성은 배포 오리진이 실제로 HTTPS일 때만 켠다 — NODE_ENV 주입 누락에 의존하지 않고
// AUTH_WEB_ORIGIN(부팅 시 스키마 검증됨)의 스킴으로 판단한다(dev localhost는 http라 자동 off).
function isSecureOrigin(webOrigin: string): boolean {
  return webOrigin.startsWith('https://');
}

// 로그인 후 되돌아갈 경로는 반드시 같은 사이트 내부 경로여야 한다 — `//`(프로토콜 상대)와
// `/\`(백슬래시로 시작하는 스킴 상대) 모두 외부 호스트로 새는 변형이라 차단한다(오픈 리다이렉트 방어).
function isSafeReturnPath(value: string | undefined): value is string {
  if (typeof value !== 'string' || !value.startsWith('/')) return false;
  return value === '/' || /^\/[^/\\]/.test(value);
}

function redirectTo(res: ServerResponse, url: string): void {
  res.statusCode = 302;
  res.setHeader('Location', url);
  res.end();
}

// Android Chrome 일부 버전은 302→커스텀 스킴을 차단한다 — 즉시 이동 스크립트 + 수동 링크(사용자
// 제스처 폴백)를 함께 담은 중간 페이지로 응답한다 (WP-08b §3-2). 교환 코드는 URL 인코딩돼 안전하다.
function mobileReturnHtml(deepLinkUrl: string): string {
  return `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>앱으로 돌아가기</title>
<body style="font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 80vh; text-align: center;">
<div>
<p>로그인이 완료됐어요. 앱으로 돌아가는 중이에요.</p>
<p><a href="${deepLinkUrl}">자동으로 이동하지 않으면 여기를 눌러 주세요</a></p>
</div>
<script>location.replace(${JSON.stringify(deepLinkUrl)});</script>
</body>
</html>`;
}

function sessionCookies(accessToken: string, refreshToken: string, secure: boolean): string[] {
  return [
    serializeCookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAgeSeconds: ACCESS_TOKEN_MAX_AGE_SECONDS,
      secure,
    }),
    serializeCookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAgeSeconds: REFRESH_TOKEN_MAX_AGE_SECONDS,
      secure,
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
    @Query('client') clientParam: string | undefined,
    @Query('codeChallenge') codeChallengeParam: string | undefined,
    @Res() res: ServerResponse,
  ): Promise<void> {
    const provider = assertProvider(providerParam);
    const returnTo = isSafeReturnPath(returnToParam) ? returnToParam : '/';

    // 모바일 시작은 client=mobile + PKCE 챌린지가 함께 와야 한다 (WP-08b §1-1)
    if (clientParam !== undefined && clientParam !== 'mobile') {
      throw new BadRequestException('client 값이 올바르지 않아요');
    }
    let mobile: { codeChallenge: string } | undefined;
    if (clientParam === 'mobile') {
      if (!codeChallengeParam || !CODE_CHALLENGE_PATTERN.test(codeChallengeParam)) {
        throw new BadRequestException('codeChallenge 형식이 올바르지 않아요');
      }
      mobile = { codeChallenge: codeChallengeParam };
    }

    const { url, stateCookieValue } = await this.authService.startLogin(provider, returnTo, mobile);

    res.setHeader('Set-Cookie', [
      serializeCookie(STATE_COOKIE, stateCookieValue, {
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
        maxAgeSeconds: STATE_COOKIE_MAX_AGE_SECONDS,
        secure: isSecureOrigin(this.authService.webOrigin),
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
      const result = await this.authService.handleCallback({ provider, code, state, stateCookieValue });

      if (result.kind === 'mobile') {
        // 모바일은 쿠키 세션 없이 일회성 교환 코드를 딥링크로 전달한다 (WP-08b §1-1, §3-2)
        res.setHeader('Set-Cookie', [expireCookie(STATE_COOKIE)]);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(mobileReturnHtml(`${MOBILE_DEEP_LINK_BASE}?code=${encodeURIComponent(result.exchangeCode)}`));
        return;
      }

      const secure = isSecureOrigin(webOrigin);
      res.setHeader('Set-Cookie', [...sessionCookies(result.accessToken, result.refreshToken, secure), expireCookie(STATE_COOKIE)]);
      redirectTo(res, `${webOrigin}${result.returnTo}`);
    } catch (cause) {
      // state 불일치(OAuthCallbackError)뿐 아니라 토큰 교환·프로필·id_token 검증 실패
      // (OAuthProviderError 계열)도 흔한 콜백 실패다 — 전부 안내 화면으로 보내 raw 500을 막는다.
      // DB 오류 등 진짜 서버 오류만 throw해 500+로그로 남긴다.
      if (cause instanceof OAuthCallbackError || cause instanceof OAuthProviderError) {
        res.setHeader('Set-Cookie', [expireCookie(STATE_COOKIE)]);
        redirectTo(res, `${webOrigin}/login?error=oauth_failed`);
        return;
      }
      throw cause;
    }
  }

  // 웹은 쿠키, 모바일은 body로 리프레시 토큰을 보낸다 — 쿠키가 있으면 쿠키 우선(웹 동작 무변경).
  // 회전된 리프레시 토큰은 body 방식일 때만 응답에 담는다(웹에 JSON으로 노출하면 httpOnly 보호가 무의미해짐).
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body() body: RefreshTokenBodyDto,
    @Req() req: IncomingMessage,
    @Res({ passthrough: true }) res: ServerResponse,
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    const cookieToken = parseCookies(req.headers.cookie)[REFRESH_TOKEN_COOKIE];
    const rawRefreshToken = cookieToken ?? body.refreshToken;
    const fromCookie = cookieToken !== undefined;
    if (!rawRefreshToken) {
      throw new UnauthorizedException('리프레시 토큰이 없어요');
    }

    try {
      const result = await this.authService.refresh(rawRefreshToken);
      if (!fromCookie) {
        return { accessToken: result.accessToken, refreshToken: result.refreshToken };
      }
      res.setHeader('Set-Cookie', sessionCookies(result.accessToken, result.refreshToken, isSecureOrigin(this.authService.webOrigin)));
      return { accessToken: result.accessToken };
    } catch (cause) {
      if (cause instanceof RefreshTokenError) {
        if (fromCookie) {
          res.setHeader('Set-Cookie', [expireCookie(ACCESS_TOKEN_COOKIE), expireCookie(REFRESH_TOKEN_COOKIE)]);
        }
        throw new UnauthorizedException(cause.message);
      }
      throw cause;
    }
  }

  // 딥링크로 받은 일회성 교환 코드 + PKCE verifier → 토큰 쌍 (WP-08b §1-1)
  @Post('mobile/token')
  @HttpCode(200)
  async mobileToken(@Body() body: MobileTokenRequestDto): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      return await this.authService.exchangeMobileCode(body.code, body.codeVerifier);
    } catch (cause) {
      if (cause instanceof MobileExchangeError) {
        // 구체 실패 사유(만료·재사용·verifier 불일치)는 응답에 담지 않는다 — 401 통일 (규칙 8)
        throw new UnauthorizedException('로그인 코드가 유효하지 않아요');
      }
      throw cause;
    }
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Body() body: RefreshTokenBodyDto,
    @Req() req: IncomingMessage,
    @Res({ passthrough: true }) res: ServerResponse,
  ): Promise<{ success: true }> {
    const rawRefreshToken = parseCookies(req.headers.cookie)[REFRESH_TOKEN_COOKIE] ?? body.refreshToken;
    if (rawRefreshToken) {
      await this.authService.logout(rawRefreshToken);
    }
    res.setHeader('Set-Cookie', [expireCookie(ACCESS_TOKEN_COOKIE), expireCookie(REFRESH_TOKEN_COOKIE)]);
    return { success: true };
  }

  // 회원 탈퇴 (스토어 심사 요건 — WP-08b §1-5). favorite·refresh_token은 FK CASCADE로 함께 삭제된다
  @Delete('me')
  @UseGuards(JwtAuthGuard)
  async deleteMe(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: ServerResponse,
  ): Promise<{ success: true }> {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    await this.authService.deleteAccount(userId);
    res.setHeader('Set-Cookie', [expireCookie(ACCESS_TOKEN_COOKIE), expireCookie(REFRESH_TOKEN_COOKIE)]);
    return { success: true };
  }
}
