// 룰 역채점 화면 (WP-11 §4-20~22) — **내부 확인용**이다.
//
// 표본이 작고 해석에 전제가 많아 사용자 화면에 쓸 수치가 아니다. API도 프로덕션에서는
// 열리지 않는다. 매주 열어 두 낙찰률의 간격이 유지되는지 보는 것이 이 화면의 용도다.
import type { Metadata } from 'next';
import { NOINDEX } from '../../seo';
import { TrendChart } from './TrendChart';
import type { Backtest, BacktestGroup, BacktestTrend } from './types';
import styles from './page.module.css';

export const metadata: Metadata = { title: '룰 역채점 (내부)', robots: NOINDEX };

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

async function fetchBacktest(): Promise<Backtest | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/backtest`, { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as Backtest;
  } catch {
    return null;
  }
}

function GroupTable({ rows, showPriceRate = false }: { rows: BacktestGroup[]; showPriceRate?: boolean }) {
  if (rows.length === 0) return <p className={styles.empty}>표본이 없어요.</p>;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">구분</th>
            <th scope="col">매각단위</th>
            <th scope="col">낙찰</th>
            <th scope="col">낙찰률</th>
            {showPriceRate ? <th scope="col">낙찰가율</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            // 10단위 미만은 우연으로 흔들린다 — 눌러서 표시하고 읽지 말라고 알린다
            <tr key={row.label} className={row.units < 10 ? styles.thin : undefined}>
              <th scope="row">{row.label}</th>
              <td>{row.units}</td>
              <td>{row.sold}</td>
              <td className={styles.rate}>{row.soldRate === null ? '—' : `${row.soldRate}%`}</td>
              {showPriceRate ? (
                <td className={styles.rate}>
                  {row.salePriceRate === null ? '—' : `${row.salePriceRate}%`}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 추이는 한 줄에 두 그룹의 낙찰률과 그 간격을 나란히 둔다 — 간격이 이 표의 요점이다. */
function TrendTable({ trend }: { trend: BacktestTrend[] }) {
  if (trend.length === 0) return <p className={styles.empty}>표본이 없어요.</p>;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">기준일</th>
            <th scope="col">부담없음</th>
            <th scope="col">낙찰률</th>
            <th scope="col">부담있음</th>
            <th scope="col">낙찰률</th>
            <th scope="col">간격</th>
          </tr>
        </thead>
        <tbody>
          {trend.map((row) => {
            const gap =
              row.noBurdenRate === null || row.burdenRate === null
                ? null
                : Math.round((row.noBurdenRate - row.burdenRate) * 10) / 10;
            return (
              <tr key={row.asOf}>
                <th scope="row">{row.asOf}</th>
                <td>{row.noBurdenUnits}</td>
                <td className={styles.rate}>
                  {row.noBurdenRate === null ? '—' : `${row.noBurdenRate}%`}
                </td>
                <td>{row.burdenUnits}</td>
                <td className={styles.rate}>
                  {row.burdenRate === null ? '—' : `${row.burdenRate}%`}
                </td>
                <td className={styles.rate}>{gap === null ? '—' : `${gap}%p`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function BacktestPage() {
  const data = await fetchBacktest();

  if (data === null) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>룰 역채점</h1>
        <p className={styles.empty}>
          집계를 불러오지 못했어요. API 서버(기본 http://localhost:4000)가 떠 있는지, 그리고
          NODE_ENV가 production이 아닌지 확인해주세요 — 이 경로는 배포 환경에서 닫혀 있어요.
        </p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>룰 역채점</h1>
      <p className={styles.note}>
        내부 확인용이에요. <strong>{data.observedFrom}</strong>부터의 기일만 셉니다 — 그 전은
        팔린 사건이 공고 목록에서 빠져 유찰만 남는 생존 편향이 있어요. 일괄매각은 사건당 1건,
        아니면 목적물당 1건으로 셉니다.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>주차별 추이</h2>
        <TrendChart trend={data.trend} />
        <TrendTable trend={data.trend} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>인수 부담 유무</h2>
        <GroupTable rows={data.burden} showPriceRate />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>인수 부담 × 최저가율</h2>
        <GroupTable rows={data.cross} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>임차인 존재 (H3)</h2>
        <p className={styles.caption}>
          점유자 표 기준이에요. &ldquo;없음&rdquo;은 스캔이 행 0건 + 버림 0건으로 확정한 물건만
          셉니다 — 확정 표시는 2026-08-07부터 쌓여서, 없음 줄은 그 뒤 기일(8/10~)이 지나야
          채워져요.
        </p>
        <GroupTable rows={data.tenant} showPriceRate />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>관심등록 증가 (H8)</h2>
        <p className={styles.caption}>
          스냅샷 처음·마지막 차이를 관측 일수로 나눈 일일 증가예요. 누적 절대값은 노출
          기간(유찰)의 대리변수라 쓰지 않고, 관측 3일 미만 물건은 뺐어요.
        </p>
        <GroupTable rows={data.interestGrowth} showPriceRate />
        <p className={styles.caption}>유찰 구간을 나눠도 유지되는지 — 통제 교차표예요.</p>
        <GroupTable rows={data.interestByFailedCount} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>유찰 횟수</h2>
        <p className={styles.caption}>
          가설과 달리 평평해요 — 유찰 횟수는 낙찰률을 예측하지 못합니다 (§4-20).
        </p>
        <GroupTable rows={data.byFailedCount} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>용도별</h2>
        <GroupTable rows={data.byUsage} />
      </section>
    </main>
  );
}
