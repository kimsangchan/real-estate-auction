// 룰 역채점 집계 응답 타입 (apps/api BacktestDto와 1:1)
export interface BacktestGroup {
  label: string;
  units: number;
  sold: number;
  soldRate: number | null;
  salePriceRate: number | null;
}

export interface BacktestTrend {
  asOf: string;
  noBurdenUnits: number;
  noBurdenRate: number | null;
  burdenUnits: number;
  burdenRate: number | null;
}

export interface Backtest {
  observedFrom: string;
  burden: BacktestGroup[];
  byFailedCount: BacktestGroup[];
  cross: BacktestGroup[];
  byUsage: BacktestGroup[];
  /** H3 — 임차인 존재. "없음"은 스캔이 행 0 + 버림 0으로 확정한 물건만 */
  tenant: BacktestGroup[];
  /** H8 — 관심등록 일일 증가 구간별. 절대값은 노출 기간의 대리변수라 쓰지 않는다 */
  interestGrowth: BacktestGroup[];
  /** H8 유찰 통제 — 증가 유무 x 유찰 구간 */
  interestByFailedCount: BacktestGroup[];
  trend: BacktestTrend[];
}
