// PKCE(RFC 7636) 코드 검증자·챌린지 생성 — RN에는 Web Crypto가 없어 난수는 폴리필
// (react-native-get-random-values, index.js에서 선주입), 해시는 순수 JS 구현을 쓴다.
import { sha256 } from '@noble/hashes/sha2.js';

// 폴리필이 주입하는 전역 — react-native-get-random-values가 타입을 제공하지 않아 여기서 선언한다.
declare const crypto: {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
};

// 32바이트 → base64url 43자. RFC 7636 §4.1의 권장 최소 길이다.
const VERIFIER_BYTES = 32;
const B64URL =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// base64 인코딩은 비트 연산이 본질이라 no-bitwise를 이 함수에서만 끈다.
/* eslint-disable no-bitwise */
function base64UrlEncode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] as number;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];

    out += B64URL[b0 >> 2];
    out += B64URL[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    if (b1 === undefined) break;
    out += B64URL[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    if (b2 === undefined) break;
    out += B64URL[b2 & 0x3f];
  }
  return out;
}

// 검증자는 base64url ASCII라 문자 코드가 그대로 바이트다 (TextEncoder는 RN에 없을 수 있어 쓰지 않는다).
function asciiBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) {
    bytes[i] = value.charCodeAt(i) & 0xff;
  }
  return bytes;
}
/* eslint-enable no-bitwise */

export function createCodeVerifier(): string {
  const bytes = new Uint8Array(VERIFIER_BYTES);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export function createCodeChallenge(codeVerifier: string): string {
  return base64UrlEncode(sha256(asciiBytes(codeVerifier)));
}
