// 부동산등기부등본 조회 요청 필드 — CODEF 공식 문서 확인(2026-07-08, 사용자 제공). 고유번호 또는 주소
// 중 하나로 조회한다.
//
// 실호출로 확정(2026-07-08): password는 인터넷등기소 로그인 비밀번호가 아니라, 이 조회 건 재열람용으로
// 요청 시점에 임의로 정하는 4자리 숫자 PIN이다(RSA 암호화해서 전송). ePrepayPass(전자민원캐시 비밀번호)는
// RSA 암호화하지 않고 평문 그대로 보낸다 — 암호화하면 "자리수 오류"(CF-13334)가 발생함을 실증했다.
import { encryptWithCodefPublicKey } from '../crypto/rsa-encrypt';

export interface RegistryLookupAddress {
  sido: string;
  sigungu: string;
  /** 행정동(addr_dong) — 집합건물의 동/호수(unitDong/unitHo)와 다른 개념이다 */
  administrativeDong?: string | null;
  lotNumber?: string | null;
  roadName?: string | null;
  buildingNumber?: string | null;
  buildingName?: string | null;
  /** 집합건물 동 (예: "801동") */
  unitDong?: string | null;
  /** 집합건물 호 (예: "804호") */
  unitHo?: string | null;
}

export type RegistryLookupTarget =
  | { kind: 'UNIQUE_NO'; uniqueNo: string }
  | { kind: 'ADDRESS'; address: RegistryLookupAddress };

export interface RegistryLookupCredentials {
  applicantPhoneNo: string;
  /**
   * 이 조회 건의 재열람용 4자리 숫자 PIN — 인터넷등기소 로그인 비밀번호가 아니라 요청 시점에
   * 임의로 정하는 값이다. buildRegistryLookupRequest가 RSA로 암호화한다.
   */
  retrievalPin: string;
  /** 전자민원캐시 — pass는 암호화하지 않고 평문으로 전송한다 */
  ePrepay?: { no: string; pass: string } | null;
}

export interface RegistryLookupOptions {
  issueType?: string;
  registerSummaryYN?: string;
}

export function buildRegistryLookupRequest(
  target: RegistryLookupTarget,
  credentials: RegistryLookupCredentials,
  codefPublicKeyBase64: string,
  options: RegistryLookupOptions = {},
): Record<string, unknown> {
  const address = target.kind === 'ADDRESS' ? target.address : null;

  return {
    organization: '0002',
    phoneNo: credentials.applicantPhoneNo,
    password: encryptWithCodefPublicKey(credentials.retrievalPin, codefPublicKeyBase64),
    inquiryType: '3',
    uniqueNo: target.kind === 'UNIQUE_NO' ? target.uniqueNo : null,
    realtyType: '1',
    addr_sido: address?.sido ?? null,
    address: null,
    recordStatus: '0',
    addr_dong: address?.administrativeDong ?? null,
    addr_lotNumber: address?.lotNumber ?? null,
    inputSelect: null,
    buildingName: address?.buildingName ?? null,
    dong: address?.unitDong ?? null,
    ho: address?.unitHo ?? null,
    addr_sigungu: address?.sigungu ?? null,
    addr_roadName: address?.roadName ?? '',
    addr_buildingNumber: address?.buildingNumber ?? null,
    jointMortgageJeonseYN: '1',
    tradingYN: '1',
    listNumber: null,
    electronicClosedYN: null,
    ePrepayNo: credentials.ePrepay?.no ?? null,
    ePrepayPass: credentials.ePrepay?.pass ?? null,
    issueType: options.issueType ?? '1',
    startPageNo: null,
    pageCount: null,
    originData: null,
    originDataYN: null,
    warningSkipYN: null,
    registerSummaryYN: options.registerSummaryYN ?? '1',
    applicationType: null,
    selectAddress: '',
    isIdentityViewYn: '',
    identityList: [{ reqIdentity: '' }],
  };
}
