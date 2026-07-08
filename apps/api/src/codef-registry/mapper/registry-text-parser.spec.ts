import { extractMaxClaimAmount, extractReceivedDate } from './registry-text-parser';

// 아래 예시 텍스트는 2026-07-08 실호출로 캡처한 실제 등기부 응답의 "접수정보"/"주요등기사항" 컬럼
// 값 형태를 그대로 반영한다(서울중앙지방법원 가압류·강제경매개시결정 등기 사례 기준).
describe('extractReceivedDate', () => {
  it('실제 접수정보 컬럼 값(줄바꿈으로 접수번호와 구분)에서 날짜를 추출한다', () => {
    expect(extractReceivedDate('2022년10월18일\n제35763호')).toBe('2022-10-18');
  });

  it('띄어쓰기가 있어도 추출한다', () => {
    expect(extractReceivedDate('2024년 1월 10일')).toBe('2024-01-10');
  });

  it('일·월이 두 자리인 경우도 zero-pad를 유지한다', () => {
    expect(extractReceivedDate('2024년12월25일\n제9999호')).toBe('2024-12-25');
  });

  it('날짜 형식이 없으면 null을 반환한다', () => {
    expect(extractReceivedDate('해제')).toBeNull();
  });
});

describe('extractMaxClaimAmount', () => {
  it('근저당권의 채권최고액 문구에서 금액을 콤마 없이 추출한다', () => {
    expect(extractMaxClaimAmount('채권최고액 금500,000,000원 채무자 홍길동')).toBe(500_000_000);
  });

  it('가압류·강제경매의 청구금액 문구에서도 금액을 추출한다', () => {
    expect(extractMaxClaimAmount('청구금액 금393,374,335 원\n채권자 박정우')).toBe(393_374_335);
  });

  it('금액 문구가 없으면 null을 반환한다', () => {
    expect(extractMaxClaimAmount('채권자 최다슬\n서울 중구 동호로33길 15')).toBeNull();
  });
});
