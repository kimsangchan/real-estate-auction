import { constants, generateKeyPairSync, privateDecrypt } from 'node:crypto';
import { CodefPublicKeyError, encryptWithCodefPublicKey } from './rsa-encrypt';

function generateTestKeyPair(): { publicKeyBase64: string; privateKeyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });

  return { publicKeyBase64: (publicKey as Buffer).toString('base64'), privateKeyPem: privateKey as string };
}

describe('encryptWithCodefPublicKey', () => {
  it('공개키로 암호화한 값을 짝이 되는 개인키로 복호화하면 원문과 같다', () => {
    const { publicKeyBase64, privateKeyPem } = generateTestKeyPair();

    const encrypted = encryptWithCodefPublicKey('P@ssw0rd', publicKeyBase64);
    const decrypted = privateDecrypt(
      { key: privateKeyPem, padding: constants.RSA_PKCS1_PADDING },
      Buffer.from(encrypted, 'base64'),
    );

    expect(decrypted.toString('utf-8')).toBe('P@ssw0rd');
  });

  it('같은 평문도 매 호출마다 다른 암호문을 만든다 (PKCS#1 v1.5 랜덤 패딩)', () => {
    const { publicKeyBase64 } = generateTestKeyPair();

    const first = encryptWithCodefPublicKey('same-input', publicKeyBase64);
    const second = encryptWithCodefPublicKey('same-input', publicKeyBase64);

    expect(first).not.toBe(second);
  });

  it('잘못된 공개키는 명시적 오류로 감싼다', () => {
    expect(() => encryptWithCodefPublicKey('P@ssw0rd', 'not-a-valid-key')).toThrow(CodefPublicKeyError);
  });
});
