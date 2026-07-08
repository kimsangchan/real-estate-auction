import { constants, generateKeyPairSync, privateDecrypt } from 'node:crypto';
import { buildRegistryLookupRequest, type RegistryLookupCredentials } from './registry-lookup-request';

function generateTestKeyPair(): { publicKeyBase64: string; privateKeyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });

  return { publicKeyBase64: (publicKey as Buffer).toString('base64'), privateKeyPem: privateKey as string };
}

const credentials: RegistryLookupCredentials = {
  applicantPhoneNo: '01012345678',
  retrievalPin: '1234',
};

describe('buildRegistryLookupRequest', () => {
  it('고유번호로 조회하면 uniqueNo를 채우고 주소 필드는 비워둔다', () => {
    const { publicKeyBase64 } = generateTestKeyPair();

    const request = buildRegistryLookupRequest(
      { kind: 'UNIQUE_NO', uniqueNo: '1234-2024-000001' },
      credentials,
      publicKeyBase64,
    );

    expect(request.organization).toBe('0002');
    expect(request.uniqueNo).toBe('1234-2024-000001');
    expect(request.addr_sido).toBeNull();
    expect(request.addr_sigungu).toBeNull();
  });

  it('주소로 조회하면 addr_* 필드를 채우고 uniqueNo는 null이다', () => {
    const { publicKeyBase64 } = generateTestKeyPair();

    const request = buildRegistryLookupRequest(
      {
        kind: 'ADDRESS',
        address: {
          sido: '서울특별시',
          sigungu: '노원구',
          buildingName: '한글아파트',
          unitDong: '801',
          unitHo: '804',
          buildingNumber: '62',
        },
      },
      credentials,
      publicKeyBase64,
    );

    expect(request.uniqueNo).toBeNull();
    expect(request.addr_sido).toBe('서울특별시');
    expect(request.addr_sigungu).toBe('노원구');
    expect(request.dong).toBe('801');
    expect(request.ho).toBe('804');
    expect(request.addr_buildingNumber).toBe('62');
  });

  it('재열람용 PIN은 평문 그대로 노출되지 않고 RSA로 암호화된다', () => {
    const { publicKeyBase64, privateKeyPem } = generateTestKeyPair();

    const request = buildRegistryLookupRequest(
      { kind: 'UNIQUE_NO', uniqueNo: '1234-2024-000001' },
      credentials,
      publicKeyBase64,
    );

    const encryptedPassword = request.password as string;
    expect(encryptedPassword).not.toBe(credentials.retrievalPin);

    const decrypted = privateDecrypt(
      { key: privateKeyPem, padding: constants.RSA_PKCS1_PADDING },
      Buffer.from(encryptedPassword, 'base64'),
    );
    expect(decrypted.toString('utf-8')).toBe(credentials.retrievalPin);
  });

  it('전자민원캐시 정보를 전달하면 ePrepayNo/ePrepayPass에 반영되고, pass는 암호화하지 않는다', () => {
    const { publicKeyBase64 } = generateTestKeyPair();

    const request = buildRegistryLookupRequest(
      { kind: 'UNIQUE_NO', uniqueNo: '1234-2024-000001' },
      { ...credentials, ePrepay: { no: 'V7411736001', pass: '1234' } },
      publicKeyBase64,
    );

    expect(request.ePrepayNo).toBe('V7411736001');
    // 실호출로 확정: ePrepayPass를 RSA 암호화하면 CF-13334(자리수 오류)가 발생한다 — 평문 그대로 보내야 한다
    expect(request.ePrepayPass).toBe('1234');
  });
});
