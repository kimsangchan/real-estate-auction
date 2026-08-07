// 실부담 시나리오 응답 타입 (apps/api AffordabilityDto와 1:1) + 표시 헬퍼.
//
// 대비 기준은 감정가다 — 시세가 아니라는 사실을 화면이 반드시 밝힌다 (실거래가 API 연동 전).
// "유리하다" 류 평가어는 만들지 않는다 (D-011) — 숫자와 비율만 보여준다.
import { formatWonCompact } from './format';

export interface AmountRange {
  min: number;
  max: number;
}

export type ScenarioKind =
  | 'MINIMUM_PRICE'
  | 'COMPARABLE_P25'
  | 'COMPARABLE_MEDIAN'
  | 'COMPARABLE_P75'
  | 'CUSTOM';

export type BurdenExtraKind = 'ACQUISITION_TAX' | 'TRANSFER_COST' | 'EVICTION_COST';
export type BurdenUnknownKind = 'UNPAID_MAINTENANCE_FEE';

export interface BurdenExtraItem {
  kind: BurdenExtraKind;
  range: AmountRange;
}

export interface ComparableSaleStats {
  usage: string | null;
  sampleCount: number;
  rateP25: number | null;
  rateMedian: number | null;
  rateP75: number | null;
}

export interface AffordabilityScenario {
  kind: ScenarioKind;
  bidPrice: number;
  totalBurden: number;
  totalWithExtras: AmountRange;
  appraisalRatio: AmountRange | null;
  extras: BurdenExtraItem[];
  unknownItems: BurdenUnknownKind[];
}

export interface Affordability {
  appraisalAmount: number | null;
  minimumSalePrice: number | null;
  bulkSale: boolean;
  usageName: string | null;
  assumedTotal: number;
  assumedIsLowerBound: boolean;
  comparableSales: ComparableSaleStats;
  scenarios: AffordabilityScenario[];
  referencePrice: 'APPRAISAL';
  source: 'NOTICE_ONLY';
}

export const SCENARIO_LABELS: Record<ScenarioKind, string> = {
  MINIMUM_PRICE: '이번 최저가로 낙찰되면',
  COMPARABLE_P25: '유사 물건 낮은 가격대(하위 25%)면',
  COMPARABLE_MEDIAN: '유사 물건 중간 가격대면',
  COMPARABLE_P75: '유사 물건 높은 가격대(상위 25%)면',
  CUSTOM: '입력한 입찰가면',
};

export const EXTRA_LABELS: Record<BurdenExtraKind, string> = {
  ACQUISITION_TAX: '취득세',
  TRANSFER_COST: '등기 비용',
  EVICTION_COST: '명도 비용',
};

/**
 * 패널 요약에 쓸 대표 시나리오 — 유사 물건 중간 가격대가 있으면 그것, 없으면 최저가.
 * 최저가 가정은 경쟁이 붙는 물건에서 비현실적이라 중위를 우선한다.
 */
export function summaryScenario(affordability: Affordability): AffordabilityScenario | null {
  return (
    affordability.scenarios.find((s) => s.kind === 'COMPARABLE_MEDIAN') ??
    affordability.scenarios.find((s) => s.kind === 'MINIMUM_PRICE') ??
    null
  );
}

/** "2.2억~2.4억" — 두 끝이 같은 단위 문자열이면 하나로 줄인다 */
export function formatWonRangeCompact(range: AmountRange): string {
  const min = formatWonCompact(range.min);
  const max = formatWonCompact(range.max);
  return min === max ? min : `${min}~${max}`;
}

/** "감정가의 64~71%" — 정수로 반올림하고 두 끝이 같으면 하나로 줄인다 */
export function formatRatioRange(range: AmountRange): string {
  const min = Math.round(range.min);
  const max = Math.round(range.max);
  return min === max ? `${min}%` : `${min}~${max}%`;
}
