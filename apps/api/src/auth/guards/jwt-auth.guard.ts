// JWT 인증 가드 — Authorization 헤더(Bearer)와 httpOnly 쿠키(access_token) 양쪽을 수용한다 (WP-08 §1-4)
import type { IncomingMessage } from 'node:http';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { parseCookies } from '../util/cookie.util';
import { JwtService } from '../token/jwt.service';

export const ACCESS_TOKEN_COOKIE_NAME = 'access_token';

export interface AuthenticatedRequest extends IncomingMessage {
  user?: { id: string };
}

function extractBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (!authorizationHeader) {
    return undefined;
  }
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return undefined;
  }
  return token;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const bearerToken = extractBearerToken(req.headers.authorization);
    const cookieToken = parseCookies(req.headers.cookie)[ACCESS_TOKEN_COOKIE_NAME];
    const token = bearerToken ?? cookieToken;

    if (!token) {
      throw new UnauthorizedException('로그인이 필요해요');
    }

    try {
      const { sub } = await this.jwtService.verifyAccessToken(token);
      req.user = { id: sub };
      return true;
    } catch {
      throw new UnauthorizedException('로그인이 만료됐거나 유효하지 않아요');
    }
  }
}
