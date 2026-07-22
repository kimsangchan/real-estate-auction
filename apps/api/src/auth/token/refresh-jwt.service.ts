// 리프레시 토큰 발급 — JWT_REFRESH_SECRET(액세스와 분리된 키)으로 서명한 JWT를 발급한다.
// 최종 유효성(폐기·회전·재사용) 판단은 DB의 token_hash 조회가 맡고, 서명 검증은 위조된 토큰을
// DB 조회 전에 걸러내는 1차 방어선이다 (WP-08 §1-3,7)
import { randomUUID } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';

export class RefreshTokenInvalidError extends Error {}

export const REFRESH_TOKEN_TTL_SECONDS = 14 * 24 * 60 * 60;
const REFRESH_TOKEN_ISSUER = 'auction-api';
const REFRESH_TOKEN_AUDIENCE = 'auction-client';

export interface RefreshTokenClaims {
  sub: string;
  familyId: string;
}

export class RefreshJwtService {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly now: () => number = Date.now,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async issue(userId: string, familyId: string): Promise<string> {
    const issuedAtSeconds = Math.floor(this.now() / 1000);
    return new SignJWT({ sub: userId, familyId })
      .setProtectedHeader({ alg: 'HS256' })
      .setJti(randomUUID())
      .setIssuer(REFRESH_TOKEN_ISSUER)
      .setAudience(REFRESH_TOKEN_AUDIENCE)
      .setIssuedAt(issuedAtSeconds)
      .setExpirationTime(issuedAtSeconds + REFRESH_TOKEN_TTL_SECONDS)
      .sign(this.key);
  }

  /** 서명·형식·만료만 검사한다 — 폐기·재사용 여부는 DB(token_hash)가 최종 판단한다 */
  async verifySignature(token: string): Promise<RefreshTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ['HS256'],
        issuer: REFRESH_TOKEN_ISSUER,
        audience: REFRESH_TOKEN_AUDIENCE,
        currentDate: new Date(this.now()),
      });
      if (typeof payload.sub !== 'string' || typeof payload.familyId !== 'string') {
        throw new RefreshTokenInvalidError('리프레시 토큰 클레임이 올바르지 않아요');
      }
      return { sub: payload.sub, familyId: payload.familyId };
    } catch (cause) {
      if (cause instanceof RefreshTokenInvalidError) {
        throw cause;
      }
      throw new RefreshTokenInvalidError('리프레시 토큰이 유효하지 않아요');
    }
  }
}
