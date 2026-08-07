// 룰 역채점 집계 (WP-11 §4-20~22) — 화면이 매주 같은 수치를 보고 결론이 유지되는지 확인한다.
//
// SQL은 tools/backtest/backtest_report.sql과 같은 정의를 쓴다. 두 곳이 갈라지면 터미널과
// 화면이 다른 숫자를 말하게 되므로, 아래 두 상수를 고칠 때 그 파일도 함께 고친다.
import { Inject, Injectable } from '@nestjs/common';
import type { Pool, QueryResultRow } from 'pg';
import type { BacktestDto } from './dto/backtest.dto';

export const BACKTEST_PG_POOL = Symbol('BACKTEST_PG_POOL');

/**
 * 관측 시작일. 이 전 기일은 **생존 편향** 때문에 못 쓴다 — 팔린 사건은 공고 목록에서
 * 빠지므로 사건검색으로 과거를 훑으면 안 팔린 사건의 유찰만 남는다.
 * 실측: 2026-06 기일은 유찰 331건에 낙찰 0건, 2026-08(관측 후)은 낙찰 92 / 유찰 207.
 */
export const OBSERVED_FROM = '2026-07-31';

/**
 * 매각 단위. **일괄매각은 사건 하나가 한 번 팔린다** — 목적물마다 세면 낙찰 사건 4건이
 * 목적물 23건으로 부풀어 낙찰률이 30.3%로 나온다(실측). 일괄이면 사건당 1건,
 * 아니면 목적물당 1건으로 센다.
 */
const SALE_UNIT = `
  WITH raw AS (
    SELECT DISTINCT ON (auction_item_id) auction_item_id, payload
    FROM auction_item_raw ORDER BY auction_item_id, observed_at DESC
  ), latest_notice AS (
    SELECT DISTINCT ON (auction_item_id) id, auction_item_id, assumed_rights_kind, risk_flags,
           tenant_scanned_at, tenant_rows_rejected
    FROM auction_item_notice ORDER BY auction_item_id, document_date DESC NULLS LAST, id DESC
  ), tenant_count AS (
    SELECT notice_id, count(*) AS rows FROM auction_item_notice_tenant GROUP BY 1
  ), outcome AS (
    SELECT auction_item_id, bool_or(result_code = '001') AS sold, max(sale_amount) AS sale_amount
    FROM auction_sale_result WHERE dxdy_date >= $1::date GROUP BY 1
  ), base AS (
    SELECT i.id, c.case_no, o.sold, o.sale_amount, i.appraisal_amount, i.failed_bid_count,
           round(i.minimum_sale_price::numeric / NULLIF(i.appraisal_amount, 0) * 100) AS min_rate,
           split_part(r.payload->>'dspslUsgNm', ',', 1) AS usage,
           COALESCE(r.payload->>'mulBigo', '') LIKE '%일괄%' AS bulk,
           (n.assumed_rights_kind = 'NONE' OR 'HUG_PRIORITY_WAIVER' = ANY(n.risk_flags)) AS no_burden,
           (n.assumed_rights_kind IS NOT NULL OR 'HUG_PRIORITY_WAIVER' = ANY(n.risk_flags)) AS burden_known,
           COALESCE(tc.rows, 0) > 0 AS tenant_present,
           -- H3 표본 자격 (WP-11 §4-7): 임차인 행이 있거나 스캔이 "행 0 + 버림 0"으로 확정한
           -- 물건만. 게이트가 행을 버린 물건과 결함 파서 시절 스캔(013 백필 NULL)은
           -- "없음"을 믿을 수 없어 뺀다
           (COALESCE(tc.rows, 0) > 0
            OR (n.tenant_scanned_at IS NOT NULL AND n.tenant_rows_rejected = 0)) AS tenant_known
    FROM outcome o
    JOIN auction_item i ON i.id = o.auction_item_id
    JOIN auction_case c ON c.id = i.auction_case_id
    JOIN latest_notice n ON n.auction_item_id = i.id
    JOIN raw r ON r.auction_item_id = i.id
    LEFT JOIN tenant_count tc ON tc.notice_id = n.id
  ), sale_unit AS (
    SELECT DISTINCT ON (CASE WHEN bulk THEN case_no ELSE id::text END) *
    FROM base ORDER BY CASE WHEN bulk THEN case_no ELSE id::text END, sold DESC
  )
`;

interface CountRow extends QueryResultRow {
  label: string;
  units: string;
  sold: string;
  soldRate: string | null;
  salePriceRate: string | null;
}

interface TrendRowRaw extends QueryResultRow {
  asOf: Date | string;
  noBurdenUnits: string;
  noBurdenSold: string;
  burdenUnits: string;
  burdenSold: string;
}

function rate(sold: string, units: string): number | null {
  const total = Number(units);
  return total === 0 ? null : Math.round((Number(sold) / total) * 1000) / 10;
}

function isoDate(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

@Injectable()
export class BacktestRepository {
  constructor(@Inject(BACKTEST_PG_POOL) private readonly pool: Pool) {}

  async findScoring(): Promise<BacktestDto> {
    const [burden, byFailedCount, cross, byUsage, tenant, trend] = await Promise.all([
      this.groupBy(`CASE WHEN no_burden THEN '인수 부담 없음' ELSE '인수 부담 있음' END`, 'burden_known'),
      this.groupBy(`'유찰 ' || LEAST(failed_bid_count, 4)::text || CASE WHEN failed_bid_count >= 4 THEN '회+' ELSE '회' END`, 'failed_bid_count IS NOT NULL'),
      this.groupBy(
        `CASE WHEN no_burden THEN '부담없음' ELSE '부담있음' END || ' · ' ||
         CASE WHEN min_rate >= 70 THEN '최저가율 70%+' ELSE '최저가율 70%미만' END`,
        'burden_known AND min_rate IS NOT NULL',
      ),
      this.groupBy('usage', 'true', 10),
      this.groupBy(`CASE WHEN tenant_present THEN '임차인 있음' ELSE '임차인 없음' END`, 'tenant_known'),
      this.findTrend(),
    ]);

    return { observedFrom: OBSERVED_FROM, burden, byFailedCount, cross, byUsage, tenant, trend };
  }

  /** 매각단위를 어떤 식으로 묶든 같은 모양(라벨·건수·낙찰률)으로 돌려준다. */
  private async groupBy(labelExpr: string, where: string, minUnits = 1) {
    const result = await this.pool.query<CountRow>(
      `${SALE_UNIT}
       SELECT ${labelExpr} AS label,
              count(*) AS units,
              count(*) FILTER (WHERE sold) AS sold,
              round(100.0 * count(*) FILTER (WHERE sold) / count(*), 1) AS "soldRate",
              round(avg(100.0 * sale_amount / NULLIF(appraisal_amount, 0)) FILTER (WHERE sold), 1)
                AS "salePriceRate"
       FROM sale_unit WHERE ${where}
       GROUP BY 1 HAVING count(*) >= ${minUnits}
       ORDER BY 1`,
      [OBSERVED_FROM],
    );
    return result.rows.map((row) => ({
      label: row.label,
      units: Number(row.units),
      sold: Number(row.sold),
      soldRate: row.soldRate === null ? null : Number(row.soldRate),
      salePriceRate: row.salePriceRate === null ? null : Number(row.salePriceRate),
    }));
  }

  /** 주차별 누적 — 표본이 늘어도 두 낙찰률의 간격이 유지되는지 본다. */
  private async findTrend() {
    const result = await this.pool.query<TrendRowRaw>(
      `WITH weeks AS (
         SELECT generate_series($1::date + 3, date_trunc('week', now())::date + 6, interval '7 day')::date AS asof
       ), raw AS (
         SELECT DISTINCT ON (auction_item_id) auction_item_id, payload
         FROM auction_item_raw ORDER BY auction_item_id, observed_at DESC
       ), latest_notice AS (
         SELECT DISTINCT ON (auction_item_id) auction_item_id, assumed_rights_kind, risk_flags
         FROM auction_item_notice ORDER BY auction_item_id, document_date DESC NULLS LAST, id DESC
       ), per_week AS (
         SELECT DISTINCT ON (w.asof, CASE WHEN COALESCE(r.payload->>'mulBigo','') LIKE '%일괄%'
                                          THEN c.case_no ELSE i.id::text END)
                w.asof,
                (SELECT bool_or(s2.result_code = '001') FROM auction_sale_result s2
                  WHERE s2.auction_item_id = i.id AND s2.dxdy_date BETWEEN $1::date AND w.asof) AS sold,
                (n.assumed_rights_kind = 'NONE' OR 'HUG_PRIORITY_WAIVER' = ANY(n.risk_flags)) AS no_burden
         FROM weeks w
         JOIN auction_sale_result sr ON sr.dxdy_date BETWEEN $1::date AND w.asof
         JOIN auction_item i ON i.id = sr.auction_item_id
         JOIN auction_case c ON c.id = i.auction_case_id
         JOIN latest_notice n ON n.auction_item_id = i.id
         JOIN raw r ON r.auction_item_id = i.id
         WHERE n.assumed_rights_kind IS NOT NULL OR 'HUG_PRIORITY_WAIVER' = ANY(n.risk_flags)
         ORDER BY w.asof, CASE WHEN COALESCE(r.payload->>'mulBigo','') LIKE '%일괄%'
                               THEN c.case_no ELSE i.id::text END
       )
       SELECT asof AS "asOf",
              count(*) FILTER (WHERE no_burden) AS "noBurdenUnits",
              count(*) FILTER (WHERE no_burden AND sold) AS "noBurdenSold",
              count(*) FILTER (WHERE NOT no_burden) AS "burdenUnits",
              count(*) FILTER (WHERE NOT no_burden AND sold) AS "burdenSold"
       FROM per_week GROUP BY 1 ORDER BY 1`,
      [OBSERVED_FROM],
    );
    return result.rows.map((row) => ({
      asOf: isoDate(row.asOf),
      noBurdenUnits: Number(row.noBurdenUnits),
      noBurdenRate: rate(row.noBurdenSold, row.noBurdenUnits),
      burdenUnits: Number(row.burdenUnits),
      burdenRate: rate(row.burdenSold, row.burdenUnits),
    }));
  }
}
