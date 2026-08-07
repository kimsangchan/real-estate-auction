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
  trend: BacktestTrend[];
}
