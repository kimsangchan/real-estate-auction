// 총 부담액 계산기 — 확정 합계(입찰가+인수보증금) 위에 취득·인도 비용 구간을 얹는다 (UX-02)
//
// 사용자가 실제로 묻는 질문은 "결국 얼마 있어야 낙찰하고 인도까지 하나"다 (2026-08-04,
// 실물건 문의에서 확인). 취득세는 매수인 사정(주택 보유 수·전용면적)에 따라 1.1%~13.4%로
// 갈리고 명도비는 점유 상태에 따라 다르므로, 단일 값을 지어내지 않고 **구간(min~max)**으로
// 계산한다 — 금액과 계산식은 사실이되 판단은 하지 않는다 (D-011).
import type { RuleTag } from './types';

export const TOTAL_BURDEN_RULE: RuleTag = { ruleId: 'TOTAL_BURDEN', ruleVersion: 2 };

export interface AmountRange {
  min: number;
  max: number;
}

/** 주택 여부 — 취득세율 체계가 다르다. 모르면 null(두 체계를 아우르는 구간으로 계산) */
export type PropertyKind = 'HOUSING' | 'NON_HOUSING';

/**
 * 인도(명도) 전망 — 배당 결과에서 파생한다.
 * 보증금을 다 돌려받지 못하고 나가야 하는 점유자는 협의가 어려워 비용 구간이 높다.
 */
export type EvictionOutlook = 'NO_REPORTED_TENANT' | 'TENANT_FULLY_COVERED' | 'TENANT_WITH_LOSS';

export type BurdenExtraKind = 'ACQUISITION_TAX' | 'TRANSFER_COST' | 'EVICTION_COST';

/** 금액을 알 수 없어 합산에서 뺀 항목 — 화면은 "별도 확인 필요"로 보여줘야 한다 */
export type BurdenUnknownKind = 'UNPAID_MAINTENANCE_FEE';

export interface BurdenExtraItem {
  kind: BurdenExtraKind;
  range: AmountRange;
}

export interface TotalBurdenResult extends RuleTag {
  bidPrice: number;
  totalAssumedAmount: number;
  /** 입찰가 + 인수보증금 — 확정 합계 (v1과 동일한 정의) */
  totalBurden: number;
  /** 취득세·등기비·명도비 구간 항목 */
  extras: BurdenExtraItem[];
  /**
   * 체납관리비: 공용부분은 낙찰자가 인수한다(대법원 2001다8677 전합)는 사실은 확정이지만
   * 금액은 어느 수집 경로에도 없다 — 합산하지 않고 항목으로만 알린다.
   */
  unknownItems: BurdenUnknownKind[];
  /** totalBurden + extras 합 — 인도까지 필요한 총액의 추정 구간 */
  totalWithExtras: AmountRange;
}

// 비주택(오피스텔·상가·토지) 유상취득: 취득세 4% + 농어촌특별세 0.2% + 지방교육세 0.4% (지방세법 §11)
const NON_HOUSING_RATE = 0.046;
// 주택 최고 구간: 조정대상지역 3주택 이상 취득세 12% + 농특 1% + 교육세 0.4%
const HOUSING_MAX_RATE = 0.134;

/**
 * 1주택자 유상취득 표준세율 (지방세법 §11①8) — 6억 이하 1%, 9억 초과 3%,
 * 사이 구간은 (가액 × 2/3억 − 3)%의 선형 보간.
 */
function housingBasicRate(price: number): number {
  if (price <= 600_000_000) return 0.01;
  if (price >= 900_000_000) return 0.03;
  return ((price * 2) / 300_000_000 - 3) / 100;
}

function acquisitionTaxRange(bidPrice: number, kind: PropertyKind | null): AmountRange {
  const nonHousing = Math.round(bidPrice * NON_HOUSING_RATE);
  if (kind === 'NON_HOUSING') return { min: nonHousing, max: nonHousing };

  // min = 1주택·전용 85㎡ 이하 가정(농특 면제): 표준세율 + 지방교육세(표준세율 1/2의 20% = ×0.1)
  const basic = housingBasicRate(bidPrice);
  const housingMin = Math.round(bidPrice * basic * 1.1);
  const housingMax = Math.round(bidPrice * HOUSING_MAX_RATE);
  if (kind === 'HOUSING') return { min: housingMin, max: housingMax };

  // 주택 여부를 모르면 두 체계를 모두 아우르는 구간 — 좁혀 말하면 틀릴 수 있다
  return {
    min: Math.min(housingMin, nonHousing),
    max: Math.max(housingMax, nonHousing),
  };
}

// 소유권이전 부대비용(법무사 보수·국민주택채권 할인·인지 등) 추정 구간 — 낙찰가 대비 실무 통용
// 범위이며 법정 수치가 아니다. 정밀 계산(채권 매입액은 시가표준액·지역 기준)은 범위 밖.
const TRANSFER_MIN_RATE = 0.005;
const TRANSFER_MAX_RATE = 0.015;

// 명도비 추정 구간(원) — 실무 통용 범위이며 법정 수치가 아니다.
// 점유자 없음: 인도명령·소액 이사비 / 전액 회수: 협의 이사비 / 미회수: 강제집행(노무·보관)까지
const EVICTION_RANGES: Record<EvictionOutlook, AmountRange> = {
  NO_REPORTED_TENANT: { min: 0, max: 1_500_000 },
  TENANT_FULLY_COVERED: { min: 500_000, max: 3_000_000 },
  TENANT_WITH_LOSS: { min: 2_000_000, max: 7_000_000 },
};

export interface TotalBurdenExtras {
  propertyKind: PropertyKind | null;
  evictionOutlook: EvictionOutlook;
}

export function calculateTotalBurden(
  bidPrice: number,
  assumedAmounts: number[],
  extras: TotalBurdenExtras,
): TotalBurdenResult {
  const totalAssumedAmount = assumedAmounts.reduce((sum, amount) => sum + amount, 0);
  const totalBurden = bidPrice + totalAssumedAmount;

  const extraItems: BurdenExtraItem[] = [
    { kind: 'ACQUISITION_TAX', range: acquisitionTaxRange(bidPrice, extras.propertyKind) },
    {
      kind: 'TRANSFER_COST',
      range: {
        min: Math.round(bidPrice * TRANSFER_MIN_RATE),
        max: Math.round(bidPrice * TRANSFER_MAX_RATE),
      },
    },
    { kind: 'EVICTION_COST', range: EVICTION_RANGES[extras.evictionOutlook] },
  ];

  return {
    bidPrice,
    totalAssumedAmount,
    totalBurden,
    extras: extraItems,
    unknownItems: ['UNPAID_MAINTENANCE_FEE'],
    totalWithExtras: {
      min: totalBurden + extraItems.reduce((sum, item) => sum + item.range.min, 0),
      max: totalBurden + extraItems.reduce((sum, item) => sum + item.range.max, 0),
    },
    ...TOTAL_BURDEN_RULE,
  };
}
