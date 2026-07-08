// 등기목적 한글 문구 → WP-03 RegisteredRightType 매핑.
// 부동산등기법 시행규칙 별지 서식이 정한 전국 공통 용어를 기준으로 한다 — CODEF 고유 코드가 아니라
// 등기부등본 자체에 쓰이는 범용 법률 용어이므로 CODEF API 추정 구현 금지 원칙과는 무관하다.
// 다만 CODEF 응답의 resType2가 이 문구를 그대로 담고 있는지는 실제 응답 샘플로 아직 검증하지 못했다 (Known Gap).
import type { RegisteredRightType } from '../../rights-analysis/domain/types';

const REGISTRATION_PURPOSE_KEYWORDS: [string, RegisteredRightType][] = [
  ['근저당권설정', 'MORTGAGE'],
  ['저당권설정', 'MORTGAGE'],
  ['가압류', 'PROVISIONAL_SEIZURE'],
  ['압류', 'SEIZURE'],
  ['담보가등기', 'COLLATERAL_PROVISIONAL_REGISTRATION'],
  ['경매개시결정', 'AUCTION_COMMENCEMENT'],
  ['전세권설정', 'LEASEHOLD'],
  ['지상권설정', 'SUPERFICIES'],
  ['지역권설정', 'EASEMENT'],
  ['가등기', 'PROVISIONAL_REGISTRATION'],
  ['가처분', 'PROVISIONAL_DISPOSITION'],
];

/** 등기목적 문구에서 WP-03 권리 타입을 찾는다 — 매칭되는 키워드가 없으면 null(소유권이전 등 범위 밖 등기). */
export function resolveRegistrationPurposeType(purposeText: string): RegisteredRightType | null {
  const match = REGISTRATION_PURPOSE_KEYWORDS.find(([keyword]) => purposeText.includes(keyword));
  return match ? match[1] : null;
}
