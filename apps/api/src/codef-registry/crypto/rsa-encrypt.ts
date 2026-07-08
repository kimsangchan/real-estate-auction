// CODEF 공개키(RSA, PKCS#1 v1.5)로 비밀번호 필드를 암호화한다 (WP-04 요구사항 2).
// CODEF_PUBLIC_KEY는 PEM 헤더 없는 base64 SPKI DER 문자열이다 (.env.example 주석 참고).
// 패딩 방식은 실 데모 API로 검증 완료(2026-07-08): OAEP는 "비밀번호 복호화 문제"로 즉시 실패하지만
// PKCS#1 v1.5는 복호화에 성공해 다음 단계(비밀번호 값 검증)로 진행됨을 확인했다.
import { constants, createPublicKey, publicEncrypt } from 'node:crypto';

export class CodefPublicKeyError extends Error {
  constructor(cause: unknown) {
    super(`CODEF 공개키를 해석할 수 없습니다: ${(cause as Error).message}`);
  }
}

export function encryptWithCodefPublicKey(plainText: string, publicKeyBase64: string): string {
  let publicKey;
  try {
    publicKey = createPublicKey({
      key: Buffer.from(publicKeyBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });
  } catch (cause) {
    throw new CodefPublicKeyError(cause);
  }

  const encrypted = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(plainText, 'utf-8'),
  );

  return encrypted.toString('base64');
}
