// 액세스 토큰 발급·검증 — RFC 8725 준거: alg 고정(HS256), iss/aud 고정 검증, 만료 15분 (WP-08 §1-3)
import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';

export class TokenExpiredError extends Error {}
export class TokenInvalidError extends Error {}

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const ACCESS_TOKEN_ISSUER = 'auction-api';
export const ACCESS_TOKEN_AUDIENCE = 'auction-client';

export interface AccessTokenPayload {
  sub: string;
}

export class JwtService {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly now: () => number = Date.now,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async issueAccessToken(userId: string): Promise<string> {
    const issuedAtSeconds = Math.floor(this.now() / 1000);
    return new SignJWT({ sub: userId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(ACCESS_TOKEN_ISSUER)
      .setAudience(ACCESS_TOKEN_AUDIENCE)
      .setIssuedAt(issuedAtSeconds)
      .setExpirationTime(issuedAtSeconds + ACCESS_TOKEN_TTL_SECONDS)
      .sign(this.key);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ['HS256'],
        issuer: ACCESS_TOKEN_ISSUER,
        audience: ACCESS_TOKEN_AUDIENCE,
        currentDate: new Date(this.now()),
      });
      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        throw new TokenInvalidError('액세스 토큰에 sub 클레임이 없어요');
      }
      return { sub: payload.sub };
    } catch (cause) {
      if (cause instanceof TokenInvalidError) {
        throw cause;
      }
      if (cause instanceof joseErrors.JWTExpired) {
        throw new TokenExpiredError('액세스 토큰이 만료됐어요');
      }
      throw new TokenInvalidError('액세스 토큰이 유효하지 않아요');
    }
  }
}
