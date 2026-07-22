// 토큰 관련 공용 유틸 — state·nonce용 불투명(opaque) 랜덤 값, 리프레시 토큰 해시, family id 생성 (WP-08 §1-2,3)
import { createHash, randomBytes, randomUUID } from 'node:crypto';

const OPAQUE_TOKEN_BYTES = 32;

/** CSRF state·카카오 OIDC nonce에 쓰는 불투명 랜덤 값 */
export function generateOpaqueToken(): string {
  return randomBytes(OPAQUE_TOKEN_BYTES).toString('base64url');
}

/** 리프레시 토큰(JWT) 문자열을 해시해 DB(token_hash)에 저장·조회용으로 쓴다 — 평문은 저장하지 않는다 */

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateFamilyId(): string {
  return randomUUID();
}
