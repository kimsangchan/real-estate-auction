// 실부담 시나리오 계산 — "이 물건을 낙찰받아 인도까지 마치면 결국 얼마가 드나"를
// 입찰가 시나리오별로 계산하고 감정가 대비 %로 내려보낸다.
//
// 대비 기준이 감정가인 것은 한계다 — 감정가는 시세가 아니다. 실거래가 API(로드맵 2-3)가
// 연동되면 기준을 시세로 바꾼다. 그 전까지 화면은 "감정가 기준"임을 반드시 밝혀야 한다.
// 평가어("유리하다" 등)는 만들지 않는다 — 숫자와 비율만 내려보낸다 (D-011).
import {
  calculateTotalBurden,
  type AmountRange,
  type EvictionOutlook,
  type PropertyKind,
} from '../rights-analysis/domain/total-burden';
import type { AnalyzedTenantDto } from './dto/notice-analysis.dto';
import type {
  AffordabilityDto,
  AffordabilityScenarioDto,
  ComparableSaleStatsDto,
  ScenarioKind,
} from './dto/affordability.dto';

// 용도 → 취득세 체계. 오피스텔은 주거용으로 써도 취득세는 건축물(4.6%) 기준이다.
// 목록에 없는 용도는 null — 두 체계를 아우르는 구간으로 계산된다 (좁혀 말하면 틀릴 수 있다)
const HOUSING_USAGES = new Set(['아파트', '다세대', '연립주택', '단독주택', '다가구주택', '단독주택다가구', '주택']);
const NON_HOUSING_USAGES = new Set(['오피스텔', '상가', '근린시설', '근린상가', '점포', '사무실', '공장', '창고', '숙박시설', '토지', '대지', '임야', '전', '답']);

export function propertyKindOfUsage(usage: string | null): PropertyKind | null {
  if (usage === null) return null;
  if (HOUSING_USAGES.has(usage)) return 'HOUSING';
  if (NON_HOUSING_USAGES.has(usage)) return 'NON_HOUSING';
  return null;
}

/**
 * 명세서 기반 인수액 합. 금액 미상(ASSUMED_AMOUNT_UNKNOWN 등)이 하나라도 있으면 하한이다 —
 * apps/web `assumedTotal`과 같은 정의를 쓴다 (두 곳이 갈라지면 화면과 API가 다른 값을 말한다).
 */
export function assumedTotalOf(tenants: readonly AnalyzedTenantDto[]): {
  amount: number;
  isLowerBound: boolean;
} {
  let amount = 0;
  let isLowerBound = false;
  for (const tenant of tenants) {
    if (tenant.assumption === 'ASSUMED_FULL' && tenant.assumedAmount !== null) {
      amount += tenant.assumedAmount;
    } else if (tenant.assumption === 'ASSUMED_AMOUNT_UNKNOWN' || tenant.assumption === 'UNKNOWN') {
      isLowerBound = true;
    } else if (tenant.assumption === 'ASSUMED_FULL') {
      isLowerBound = true;
    }
  }
  return { amount, isLowerBound };
}

/**
 * 명도 전망 — 등기부 없이 명세서만으로는 배당 회수액을 모르므로 보수적으로 판정한다.
 * 인수가 남거나 미확정인 점유자가 있으면 손실 측, 전원 소멸 확정이면 중간 구간.
 */
function evictionOutlookOf(tenants: readonly AnalyzedTenantDto[]): EvictionOutlook {
  if (tenants.length === 0) return 'NO_REPORTED_TENANT';
  const loss = tenants.some(
    (t) => t.assumption !== 'NOT_ASSUMED' || (t.assumedAmount ?? 0) > 0,
  );
  return loss ? 'TENANT_WITH_LOSS' : 'TENANT_FULLY_COVERED';
}

export interface AffordabilityInputs {
  appraisalAmount: number | null;
  minimumSalePrice: number | null;
  /** 일괄매각이면 최저가·낙찰가가 묶음 전체 값이라 목적물 단위 비율을 만들 수 없다 (§4-2) */
  bulkSale: boolean;
  usageName: string | null;
  tenants: readonly AnalyzedTenantDto[];
  comparableSales: ComparableSaleStatsDto;
  /** 사용자가 직접 입력한 입찰가 (선택) */
  customBidPrice: number | null;
}

function ratioRange(range: AmountRange, appraisal: number | null): AmountRange | null {
  if (appraisal === null || appraisal <= 0) return null;
  return {
    min: Math.round((range.min / appraisal) * 1000) / 10,
    max: Math.round((range.max / appraisal) * 1000) / 10,
  };
}

export function computeAffordability(inputs: AffordabilityInputs): AffordabilityDto {
  const assumed = assumedTotalOf(inputs.tenants);
  const propertyKind = propertyKindOfUsage(inputs.usageName);
  const evictionOutlook = evictionOutlookOf(inputs.tenants);

  const scenario = (kind: ScenarioKind, bidPrice: number): AffordabilityScenarioDto => {
    const burden = calculateTotalBurden(bidPrice, [assumed.amount], {
      propertyKind,
      evictionOutlook,
    });
    return {
      kind,
      bidPrice,
      totalBurden: burden.totalBurden,
      totalWithExtras: burden.totalWithExtras,
      appraisalRatio: ratioRange(burden.totalWithExtras, inputs.appraisalAmount),
      extras: burden.extras,
      unknownItems: burden.unknownItems,
    };
  };

  const scenarios: AffordabilityScenarioDto[] = [];
  // 일괄매각은 최저가가 묶음 전체 값이라 목적물 시나리오를 만들면 숫자가 그럴듯하게 틀린다 —
  // 아예 만들지 않는다 (직접 입력 제외)
  if (!inputs.bulkSale) {
    if (inputs.minimumSalePrice !== null && inputs.minimumSalePrice > 0) {
      scenarios.push(scenario('MINIMUM_PRICE', inputs.minimumSalePrice));
    }
    const { rateP25, rateMedian, rateP75, sampleCount } = inputs.comparableSales;
    if (inputs.appraisalAmount !== null && inputs.appraisalAmount > 0 && sampleCount > 0) {
      const byRate = (kind: ScenarioKind, rate: number | null) => {
        if (rate !== null) {
          scenarios.push(scenario(kind, Math.round((inputs.appraisalAmount as number) * (rate / 100))));
        }
      };
      byRate('COMPARABLE_P25', rateP25);
      byRate('COMPARABLE_MEDIAN', rateMedian);
      byRate('COMPARABLE_P75', rateP75);
    }
  }
  if (inputs.customBidPrice !== null && inputs.customBidPrice > 0) {
    scenarios.push(scenario('CUSTOM', inputs.customBidPrice));
  }

  return {
    appraisalAmount: inputs.appraisalAmount,
    minimumSalePrice: inputs.minimumSalePrice,
    bulkSale: inputs.bulkSale,
    usageName: inputs.usageName,
    assumedTotal: assumed.amount,
    assumedIsLowerBound: assumed.isLowerBound,
    comparableSales: inputs.comparableSales,
    scenarios,
    referencePrice: 'APPRAISAL',
    source: 'NOTICE_ONLY',
  };
}
