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
  trend: BacktestTrend[];
}
