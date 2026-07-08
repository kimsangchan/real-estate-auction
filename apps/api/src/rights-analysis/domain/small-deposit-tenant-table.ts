// 소액임차인 최우선변제 기준 — 주택임대차보호법 시행령 개정 이력 (1984~2026 현행) seed 데이터.
//
// 기준 시점(최초 담보물권 설정일)에 시행 중이던 시행령을 적용한다 — 각 개정 부칙의
// "이 영 시행 전 담보물권을 취득한 채권자는 종전 규정에 따른다" 경과규정과 일치.
//
// 지역구분은 자치구 단위가 아닌 4단계 티어로 단순화했다 — 주소→티어 해석(예: 특정 시군구가
// 어느 티어인지)은 이 모듈의 범위 밖이며 호출자가 RegionTier를 직접 판단해 넘긴다.
// SEOUL: 서울특별시 / OVERCONCENTRATION: 수도권 과밀억제권역(서울 제외) / METRO: 광역시 등
// 특정도시 / OTHER: 그 밖의 지역. 2010년 시행령 이전에는 서울이 OVERCONCENTRATION과
// 동일 값(당시 서울은 별도 구분 없이 과밀억제권역·특별시로 묶여 있었음).
//
// 출처(2026-07-08 교차검증): 대한법률구조공단 https://support.klac.or.kr/front/contents/07/006.do,
// 국가법령정보센터 연혁(U-LEX) https://www.ulex.co.kr/법률/88530-004950-주택임대차보호법시행령,
// 법제처 찾기쉬운 생활법령정보(현행) https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=629&ccfNo=5&cciNo=2&cnpClsNo=2
//
// 주의(불확실): 2010~2016년 개정의 METRO 티어에 포함되는 정확한 시·군 목록은 출처마다
// "광역시 및 특정도시"로만 서술되어 세부 목록이 엇갈린다. 금액 자체는 다수 출처가 일치해
// 신뢰도가 높지만, 이 구간의 지역 경계를 다루는 케이스는 law.go.kr 원문 재확인 후 반영할 것.
import type { RegionTier } from './types';

export interface SmallDepositTenantRule {
  /** 시행일 (YYYY-MM-DD) — 이 날짜를 포함해 이후 설정된 담보물권에 적용한다 */
  effectiveDate: string;
  /** 소액임차인으로 인정되는 보증금 상한액(원) */
  depositCapByRegion: Record<RegionTier, number>;
  /** 최우선변제 상한액(원) */
  priorityRepaymentCapByRegion: Record<RegionTier, number>;
}

export const SMALL_DEPOSIT_TENANT_RULES: SmallDepositTenantRule[] = [
  {
    effectiveDate: '1984-06-14',
    depositCapByRegion: { SEOUL: 3_000_000, OVERCONCENTRATION: 3_000_000, METRO: 3_000_000, OTHER: 2_000_000 },
    priorityRepaymentCapByRegion: { SEOUL: 3_000_000, OVERCONCENTRATION: 3_000_000, METRO: 3_000_000, OTHER: 2_000_000 },
  },
  {
    effectiveDate: '1987-12-01',
    depositCapByRegion: { SEOUL: 5_000_000, OVERCONCENTRATION: 5_000_000, METRO: 5_000_000, OTHER: 4_000_000 },
    priorityRepaymentCapByRegion: { SEOUL: 5_000_000, OVERCONCENTRATION: 5_000_000, METRO: 5_000_000, OTHER: 4_000_000 },
  },
  {
    effectiveDate: '1990-02-19',
    depositCapByRegion: { SEOUL: 20_000_000, OVERCONCENTRATION: 20_000_000, METRO: 20_000_000, OTHER: 15_000_000 },
    priorityRepaymentCapByRegion: { SEOUL: 7_000_000, OVERCONCENTRATION: 7_000_000, METRO: 7_000_000, OTHER: 5_000_000 },
  },
  {
    effectiveDate: '1995-10-19',
    depositCapByRegion: { SEOUL: 30_000_000, OVERCONCENTRATION: 30_000_000, METRO: 30_000_000, OTHER: 20_000_000 },
    priorityRepaymentCapByRegion: { SEOUL: 12_000_000, OVERCONCENTRATION: 12_000_000, METRO: 12_000_000, OTHER: 8_000_000 },
  },
  {
    effectiveDate: '2001-09-15',
    depositCapByRegion: { SEOUL: 40_000_000, OVERCONCENTRATION: 40_000_000, METRO: 35_000_000, OTHER: 30_000_000 },
    priorityRepaymentCapByRegion: { SEOUL: 16_000_000, OVERCONCENTRATION: 16_000_000, METRO: 14_000_000, OTHER: 12_000_000 },
  },
  {
    effectiveDate: '2008-08-21',
    depositCapByRegion: { SEOUL: 60_000_000, OVERCONCENTRATION: 60_000_000, METRO: 50_000_000, OTHER: 40_000_000 },
    priorityRepaymentCapByRegion: { SEOUL: 20_000_000, OVERCONCENTRATION: 20_000_000, METRO: 17_000_000, OTHER: 14_000_000 },
  },
  {
    effectiveDate: '2010-07-26',
    depositCapByRegion: { SEOUL: 75_000_000, OVERCONCENTRATION: 65_000_000, METRO: 55_000_000, OTHER: 40_000_000 },
    priorityRepaymentCapByRegion: { SEOUL: 25_000_000, OVERCONCENTRATION: 22_000_000, METRO: 19_000_000, OTHER: 14_000_000 },
  },
  {
    effectiveDate: '2014-01-01',
    depositCapByRegion: { SEOUL: 95_000_000, OVERCONCENTRATION: 80_000_000, METRO: 60_000_000, OTHER: 45_000_000 },
    priorityRepaymentCapByRegion: { SEOUL: 32_000_000, OVERCONCENTRATION: 27_000_000, METRO: 20_000_000, OTHER: 15_000_000 },
  },
  {
    effectiveDate: '2016-03-31',
    depositCapByRegion: { SEOUL: 100_000_000, OVERCONCENTRATION: 80_000_000, METRO: 60_000_000, OTHER: 50_000_000 },
    priorityRepaymentCapByRegion: { SEOUL: 34_000_000, OVERCONCENTRATION: 27_000_000, METRO: 20_000_000, OTHER: 17_000_000 },
  },
  {
    effectiveDate: '2018-09-18',
    depositCapByRegion: { SEOUL: 110_000_000, OVERCONCENTRATION: 100_000_000, METRO: 60_000_000, OTHER: 50_000_000 },
    priorityRepaymentCapByRegion: { SEOUL: 37_000_000, OVERCONCENTRATION: 34_000_000, METRO: 20_000_000, OTHER: 17_000_000 },
  },
  {
    effectiveDate: '2021-05-11',
    depositCapByRegion: { SEOUL: 150_000_000, OVERCONCENTRATION: 130_000_000, METRO: 70_000_000, OTHER: 60_000_000 },
    priorityRepaymentCapByRegion: { SEOUL: 50_000_000, OVERCONCENTRATION: 43_000_000, METRO: 23_000_000, OTHER: 20_000_000 },
  },
  {
    // 2026-07-08 현재 최신 개정 — 법제처 공식 확인
    effectiveDate: '2023-02-21',
    depositCapByRegion: { SEOUL: 165_000_000, OVERCONCENTRATION: 145_000_000, METRO: 85_000_000, OTHER: 75_000_000 },
    priorityRepaymentCapByRegion: { SEOUL: 55_000_000, OVERCONCENTRATION: 48_000_000, METRO: 28_000_000, OTHER: 25_000_000 },
  },
];

export class NoSmallDepositTenantRuleError extends Error {
  constructor(mortgageSettingDate: string) {
    super(`담보물권 설정일(${mortgageSettingDate})에 적용 가능한 소액임차인 기준이 없습니다`);
  }
}

/** 담보물권 설정일 기준으로 적용할 시행령을 찾는다 (시행일 포함 이후 중 가장 최신 것). */
export function findApplicableSmallDepositRule(mortgageSettingDate: string): SmallDepositTenantRule {
  const applicable = SMALL_DEPOSIT_TENANT_RULES.filter(
    (rule) => rule.effectiveDate <= mortgageSettingDate,
  );

  if (applicable.length === 0) {
    throw new NoSmallDepositTenantRuleError(mortgageSettingDate);
  }

  return applicable.reduce((latest, current) =>
    current.effectiveDate > latest.effectiveDate ? current : latest,
  );
}
