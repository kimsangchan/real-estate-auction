// 낙찰률 추이 선 그래프 — 차트 라이브러리가 없어 SVG를 직접 그린다(package.json 확인함).
// 관건은 절대 수치가 아니라 **두 선의 간격이 표본이 늘어도 유지되는지**다.
import type { BacktestTrend } from './types';
import styles from './page.module.css';

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 40 };
const MAX_RATE = 50; // 실측 낙찰률이 30%를 넘은 적이 없어 50%면 충분하다

function points(trend: BacktestTrend[], pick: (row: BacktestTrend) => number | null): string {
  const inner = WIDTH - PAD.left - PAD.right;
  const step = trend.length > 1 ? inner / (trend.length - 1) : 0;
  return trend
    .map((row, index) => {
      const value = pick(row);
      if (value === null) return null;
      const x = PAD.left + index * step;
      const y = PAD.top + (1 - value / MAX_RATE) * (HEIGHT - PAD.top - PAD.bottom);
      return `${x},${y}`;
    })
    .filter((point): point is string => point !== null)
    .join(' ');
}

export function TrendChart({ trend }: { trend: BacktestTrend[] }) {
  if (trend.length === 0) {
    return <p className={styles.empty}>아직 관측 창 안에 결과가 없어요.</p>;
  }

  // 점이 하나면 선이 안 그려진다 — 주차가 쌓일 때까지 표로만 읽는다
  const singlePoint = trend.length === 1;
  const gridRates = [0, 10, 20, 30, 40, 50];

  return (
    <figure className={styles.chartFigure}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={styles.chart} role="img"
           aria-label="주차별 낙찰률 추이">
        {gridRates.map((value) => {
          const y = PAD.top + (1 - value / MAX_RATE) * (HEIGHT - PAD.top - PAD.bottom);
          return (
            <g key={value}>
              <line x1={PAD.left} y1={y} x2={WIDTH - PAD.right} y2={y} className={styles.gridLine} />
              <text x={PAD.left - 6} y={y + 4} className={styles.axisLabel} textAnchor="end">
                {value}%
              </text>
            </g>
          );
        })}

        {singlePoint ? null : (
          <>
            <polyline points={points(trend, (row) => row.noBurdenRate)} className={styles.lineNoBurden} />
            <polyline points={points(trend, (row) => row.burdenRate)} className={styles.lineBurden} />
          </>
        )}

        {trend.map((row, index) => {
          const inner = WIDTH - PAD.left - PAD.right;
          const step = trend.length > 1 ? inner / (trend.length - 1) : 0;
          const x = PAD.left + index * step;
          const y = (value: number | null) =>
            value === null ? null : PAD.top + (1 - value / MAX_RATE) * (HEIGHT - PAD.top - PAD.bottom);
          const yNo = y(row.noBurdenRate);
          const yYes = y(row.burdenRate);
          return (
            <g key={row.asOf}>
              {yNo !== null ? <circle cx={x} cy={yNo} r={3.5} className={styles.dotNoBurden} /> : null}
              {yYes !== null ? <circle cx={x} cy={yYes} r={3.5} className={styles.dotBurden} /> : null}
              <text x={x} y={HEIGHT - 8} className={styles.axisLabel} textAnchor="middle">
                {row.asOf.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className={styles.legend}>
        <span className={styles.legendNoBurden}>인수 부담 없음</span>
        <span className={styles.legendBurden}>인수 부담 있음</span>
        {singlePoint ? <span className={styles.legendNote}>주차가 하나라 선은 다음 주부터 그려져요</span> : null}
      </figcaption>
    </figure>
  );
}
