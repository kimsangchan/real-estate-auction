// 실부담 시나리오 응답 — "결국 얼마 들고, 그게 감정가 대비 몇 %인가" (UX-02 확장).
// 대비 기준은 감정가다(referencePrice: 'APPRAISAL') — 실거래 시세가 아니라는 것을 화면이
// 반드시 밝혀야 한다. 실거래가 API(로드맵 2-3) 연동 시 기준이 바뀐다.
import type {
  AmountRange,
  BurdenExtraItem,
  BurdenUnknownKind,
} from '../../rights-analysis/domain/total-burden';

export type ScenarioKind =
  /** 이번 기일 최저가로 낙찰받는 가정 */
  | 'MINIMUM_PRICE'
  /** 같은 용도 물건들의 실측 낙찰가율 사분위(25%)를 감정가에 적용한 가정 */
  | 'COMPARABLE_P25'
  | 'COMPARABLE_MEDIAN'
  | 'COMPARABLE_P75'
  /** 사용자가 직접 입력한 입찰가 */
  | 'CUSTOM';

/** 같은 용도 물건의 실측 낙찰가율 분포(감정가 대비 %). 표본이 작으면 화면이 밝혀야 한다 */
export interface ComparableSaleStatsDto {
  usage: string | null;
  sampleCount: number;
  rateP25: number | null;
  rateMedian: number | null;
  rateP75: number | null;
}

export interface AffordabilityScenarioDto {
  kind: ScenarioKind;
  bidPrice: number;
  /** 입찰가 + 인수보증금 — 확정 합계 */
  totalBurden: number;
  /** 확정 합계 + 취득세·등기·명도 구간 */
  totalWithExtras: AmountRange;
  /** totalWithExtras를 감정가로 나눈 % 구간. 감정가가 없으면 null */
  appraisalRatio: AmountRange | null;
  extras: BurdenExtraItem[];
  unknownItems: BurdenUnknownKind[];
}

export interface AffordabilityDto {
  appraisalAmount: number | null;
  minimumSalePrice: number | null;
  /** 일괄매각 — 최저가·낙찰가가 묶음 전체 값이라 시나리오를 만들지 않는다 (직접 입력 제외) */
  bulkSale: boolean;
  usageName: string | null;
  /** 명세서 기반 인수액 합 — assumedIsLowerBound면 이보다 클 수 있다 */
  assumedTotal: number;
  assumedIsLowerBound: boolean;
  comparableSales: ComparableSaleStatsDto;
  scenarios: AffordabilityScenarioDto[];
  /** 대비 기준 — 지금은 감정가뿐이다. 시세 연동 시 'MARKET' 추가 예정 */
  referencePrice: 'APPRAISAL';
  source: 'NOTICE_ONLY';
}
