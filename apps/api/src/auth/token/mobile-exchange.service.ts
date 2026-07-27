// 모바일 일회성 교환 코드 — 콜백에서 발급해 딥링크로 전달하고, 앱이 PKCE verifier와 함께
// 토큰 쌍으로 교환한다 (WP-08b §1-1, RFC 8252 §8.1·RFC 7636). 서명 키는 state와 같은
// OAUTH_STATE_SECRET(같은 로그인 핸드셰이크 신뢰 도메인, typ으로 판별)을 쓴다.
import { createHash, randomUUID } from 'node:crypto';
import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';

export class MobileExchangeError extends Error {}

const EXCHANGE_TOKEN_TTL_SECONDS = 60;
const EXCHANGE_TOKEN_TYPE = 'mobile_exchange';

/** RFC 7636 §4.2 — code_verifier의 S256 변환 */
export function s256CodeChallenge(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier, 'ascii').digest('base64url');
}

export class MobileExchangeService {
  private readonly key: Uint8Array;
  /** 소모된 jti → 만료 시각(ms). 단일 인스턴스 MVP라 인메모리로 충분 — 재기동 시 진행 중 로그인만 무효 (WP-08b §1-1) */
  private readonly consumedJtis = new Map<string, number>();

  constructor(
    secret: string,
    private readonly now: () => number = Date.now,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async issue(userId: string, codeChallenge: string): Promise<string> {
    const issuedAtSeconds = Math.floor(this.now() / 1000);
    return new SignJWT({ typ: EXCHANGE_TOKEN_TYPE, sub: userId, codeChallenge })
      .setProtectedHeader({ alg: 'HS256' })
      .setJti(randomUUID())
      .setIssuedAt(issuedAtSeconds)
      .setExpirationTime(issuedAtSeconds + EXCHANGE_TOKEN_TTL_SECONDS)
      .sign(this.key);
  }

  /**
   * 검증 + 소모(1회용). 구조가 유효한 코드는 verifier 불일치라도 소모 처리한다 —
   * 같은 코드로 verifier를 반복 대입하는 브루트포스를 차단 (인가 코드 1회성 원칙).
   */
  async consume(code: string, codeVerifier: string): Promise<{ userId: string }> {
    let payload;
    try {
      ({ payload } = await jwtVerify(code, this.key, {
        algorithms: ['HS256'],
        currentDate: new Date(this.now()),
      }));
    } catch (cause) {
      if (cause instanceof joseErrors.JWTExpired) {
        throw new MobileExchangeError('교환 코드가 만료됐어요');
      }
      throw new MobileExchangeError('교환 코드가 유효하지 않아요');
    }

    if (
      payload.typ !== EXCHANGE_TOKEN_TYPE ||
      typeof payload.sub !== 'string' ||
      typeof payload.jti !== 'string' ||
      typeof payload.codeChallenge !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      throw new MobileExchangeError('교환 코드 클레임이 올바르지 않아요');
    }

    this.sweepExpired();
    if (this.consumedJtis.has(payload.jti)) {
      throw new MobileExchangeError('이미 사용된 교환 코드예요');
    }
    this.consumedJtis.set(payload.jti, payload.exp * 1000);

    if (s256CodeChallenge(codeVerifier) !== payload.codeChallenge) {
      throw new MobileExchangeError('코드 검증값이 일치하지 않아요');
    }

    return { userId: payload.sub };
  }

  /** 만료 시각이 지난 소모 기록은 재사용 검사에 더 필요 없다 — 무한 증가 방지 */
  private sweepExpired(): void {
    const nowMs = this.now();
    for (const [jti, expiresAtMs] of this.consumedJtis) {
      if (expiresAtMs <= nowMs) {
        this.consumedJtis.delete(jti);
      }
    }
  }
}
