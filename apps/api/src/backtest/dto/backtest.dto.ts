// 룰 역채점 집계 응답 (WP-11 §4-20~22). 내부 확인용이라 사용자 화면에 쓰지 않는다.
export interface BacktestGroupDto {
  label: string;
  /** 매각단위 수 — 일괄매각은 사건당 1, 아니면 목적물당 1 */
  units: number;
  sold: number;
  /** 낙찰률(%) */
  soldRate: number | null;
  /** 낙찰가율(%) — 낙찰된 건의 평균. 낙찰이 없으면 null */
  salePriceRate: number | null;
}

export interface BacktestTrendDto {
  asOf: string;
  noBurdenUnits: number;
  noBurdenRate: number | null;
  burdenUnits: number;
  burdenRate: number | null;
}

export interface BacktestDto {
  /** 관측 시작일. 이 전 기일은 생존 편향으로 제외한다 */
  observedFrom: string;
  burden: BacktestGroupDto[];
  byFailedCount: BacktestGroupDto[];
  cross: BacktestGroupDto[];
  byUsage: BacktestGroupDto[];
  /** H3 — 임차인 존재. "없음"은 스캔이 행 0 + 버림 0으로 확정한 물건만 (WP-11 §4-7) */
  tenant: BacktestGroupDto[];
  /** H8 — 관심등록 일일 증가 구간별. 절대값은 노출 기간의 대리변수라 쓰지 않는다 (§4-1) */
  interestGrowth: BacktestGroupDto[];
  /** H8 유찰 통제 — 증가 유무 x 유찰 구간 */
  interestByFailedCount: BacktestGroupDto[];
  trend: BacktestTrendDto[];
}
