// 관심 물건 리포지토리 — favorite 테이블을 pg 드라이버로 직접 다룬다 (ORM 미사용, 기존 패턴 준수)
// findByUser는 auction_item/auction_case와 조인해 웹 ItemCard가 쓰는 필드까지 채운다 (WP-08 §1-8,
// auction-items.repository.ts의 SELECT_AND_FROM 패턴을 그대로 재사용)
import { Inject, Injectable } from '@nestjs/common';
import type { Pool, QueryResultRow } from 'pg';
import type { AssumedDepositDto, AuctionItemDto } from '../auction-items/dto/auction-item.dto';
import { loadAssumedDeposits } from '../auction-items/auction-items.repository';

// 법원 convAddr 접두사 → 면적 종류 코드. 화면이 평당가 분모를 고르는 근거라 문자열을 그대로
// 흘리지 않고 코드로 고정한다.
const AREA_KIND: Record<string, 'AGGREGATE' | 'LAND' | 'BUILDING'> = {
  집합건물: 'AGGREGATE',
  토지: 'LAND',
  건물: 'BUILDING',
};

export const FAVORITES_PG_POOL = Symbol('FAVORITES_PG_POOL');

export interface FavoriteRecord extends AuctionItemDto {
  favoritedAt: string;
}

interface FavoriteRow extends QueryResultRow {
  courtOfficeCode: string;
  caseNo: string;
  itemNo: string;
  courtName: string | null;
  deptName: string | null;
  usageName: string | null;
  areaKind: string | null;
  areaM2: string | null;
  bulkSale: boolean;
  address: string | null;
  appraisalAmount: string | null;
  minimumSalePrice: string | null;
  failedBidCount: number | null;
  bidDatetime: Date | null;
  assumedRightsKind: string | null;
  riskFlags: string[] | null;
  tenantCount: string | null;
  // 인수 보증금 계산용 내부 값 — DTO로 내보내지 않는다 (auction-items.repository와 같은 규칙)
  noticeId: string | null;
  noticeBaselineDate: Date | string | null;
  noticeDistributionDemandDeadline: Date | string | null;
  lng: number | null;
  lat: number | null;
  favoritedAt: Date;
}

function toRecord(row: FavoriteRow, assumedDeposit: AssumedDepositDto | null): FavoriteRecord {
  const { noticeId, noticeBaselineDate, noticeDistributionDemandDeadline, ...rest } = row;
  void noticeId;
  void noticeBaselineDate;
  void noticeDistributionDemandDeadline;

  return {
    ...rest,
    appraisalAmount: row.appraisalAmount === null ? null : Number(row.appraisalAmount),
    minimumSalePrice: row.minimumSalePrice === null ? null : Number(row.minimumSalePrice),
    areaKind: AREA_KIND[row.areaKind ?? ''] ?? null,
    areaM2: row.areaM2 == null ? null : Number(row.areaM2),
    bidDatetime: row.bidDatetime === null ? null : row.bidDatetime.toISOString(),
    // 명세서가 없는 물건은 "위험 없음"이 아니라 "확인 못 함"이다 (auction-items.repository와 동일 규칙)
    riskFlags: row.riskFlags ?? [],
    tenantCount: row.tenantCount == null ? null : Number(row.tenantCount),
    assumedDeposit,
    favoritedAt: row.favoritedAt.toISOString(),
  };
}

const SELECT_FAVORITE_ITEMS = `
  SELECT
    ac.court_office_code AS "courtOfficeCode",
    ac.case_no AS "caseNo",
    ai.item_no AS "itemNo",
    ac.court_name AS "courtName",
    raw.payload->>'jpDeptNm' AS "deptName",
    raw.payload->>'dspslUsgNm' AS "usageName",
    -- 면적(㎡)과 그 종류. 종류마다 평당가의 분모가 다르므로 값만 주면 화면이 잘못 쓴다.
    --   집합건물(370) → 전유면적 / 토지(63) → 대지면적 / 건물(31) → 연면적(층별 합계)
    -- 업계도 같은 구분을 쓴다: 두인경매는 검색 파라미터가 landSqm·bldgSqm 두 스칼라이고,
    -- 마이옥션 요약란은 "토지면적 258.00㎡ / 건물면적 382.44㎡"로 나눠 적는다.
    -- 건물면적이 층별 합계라는 것은 실측 검산으로 확인했다(17.4 + 121.68×3 = 382.44).
    -- 템플릿 리터럴이라 백슬래시를 \\로 써야 Postgres까지 그대로 간다 (auction-items와 동일)
    (regexp_match(raw.payload->>'convAddr', '^\\[(집합건물|건물|토지)'))[1] AS "areaKind",
    -- 표기된 ㎡를 모두 더한다. 다층 건물은 연면적, 여러 필지는 토지 합계가 되어 업계 표기와 맞는다.
    -- 법원이 자유 텍스트로 주므로("철근콘크리트구조 47.52㎡", "1층 44.30㎡ 2층 44.30㎡") 정규식으로 뽑는다.
    (SELECT NULLIF(sum(replace(m[1], ',', '')::numeric), 0)
       FROM regexp_matches(
         COALESCE(NULLIF(raw.payload->>'areaList', ''), raw.payload->>'pjbBuldList', ''),
         '([0-9][0-9,]*\\.?[0-9]*)\\s*㎡', 'g') m) AS "areaM2",
    -- 일괄매각 여부 — auction-items.repository와 같은 이유(면적과 가격의 단위가 어긋난다)
    (COALESCE(raw.payload->>'mulBigo', '') LIKE '%일괄%') AS "bulkSale",
    ai.address AS "address",
    ai.appraisal_amount AS "appraisalAmount",
    ai.minimum_sale_price AS "minimumSalePrice",
    ai.failed_bid_count AS "failedBidCount",
    sch.bid_datetime AS "bidDatetime",
    ntc.assumed_rights_kind AS "assumedRightsKind",
    ntc.risk_flags AS "riskFlags",
    ntc.tenant_count AS "tenantCount",
    -- 인수 보증금은 SQL로 계산하지 않는다 — 판정 규칙이 갈라진다. 키와 기준일만 싣는다.
    ntc.notice_id AS "noticeId",
    ntc.baseline_date AS "noticeBaselineDate",
    ntc.distribution_demand_deadline AS "noticeDistributionDemandDeadline",
    ST_X(ai.geom) AS "lng",
    ST_Y(ai.geom) AS "lat",
    f.created_at AS "favoritedAt"
  FROM favorite f
  JOIN auction_case ac ON ac.court_office_code = f.court_office_code AND ac.case_no = f.case_no
  JOIN auction_item ai ON ai.auction_case_id = ac.id AND ai.item_no = f.item_no
  LEFT JOIN LATERAL (
    SELECT payload FROM auction_item_raw
    WHERE auction_item_id = ai.id
    ORDER BY observed_at DESC LIMIT 1
  ) raw ON true
  LEFT JOIN LATERAL (
    SELECT bid_datetime FROM auction_schedule
    WHERE auction_item_id = ai.id
    ORDER BY observed_at DESC LIMIT 1
  ) sch ON true
  LEFT JOIN LATERAL (
    SELECT
      n.id AS notice_id,
      n.baseline_date,
      n.distribution_demand_deadline,
      n.assumed_rights_kind,
      n.risk_flags,
      (SELECT count(DISTINCT t.tenant_seq)
         FROM auction_item_notice_tenant t WHERE t.notice_id = n.id) AS tenant_count
    FROM auction_item_notice n
    WHERE n.auction_item_id = ai.id
    ORDER BY n.document_date DESC NULLS LAST, n.id DESC LIMIT 1
  ) ntc ON true
`;

@Injectable()
export class FavoritesRepository {
  constructor(@Inject(FAVORITES_PG_POOL) private readonly pool: Pool) {}

  async findByUser(userId: string): Promise<FavoriteRecord[]> {
    const result = await this.pool.query<FavoriteRow>(
      `${SELECT_FAVORITE_ITEMS} WHERE f.user_id = $1 ORDER BY f.created_at DESC`,
      [userId],
    );
    // 목록 카드가 물건 목록과 같은 인수 보증금을 말해야 한다 — 같은 함수를 쓴다
    const deposits = await loadAssumedDeposits(this.pool, result.rows);
    return result.rows.map((row) =>
      toRecord(row, row.noticeId === null ? null : deposits.get(row.noticeId) ?? null),
    );
  }

  /** 이미 등록돼 있으면 아무 것도 하지 않는다 — 재등록이 안전하게 멱등하도록 (AGENTS.md 규칙 10) */
  async add(userId: string, courtOfficeCode: string, caseNo: string, itemNo: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO favorite (user_id, court_office_code, case_no, item_no)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, court_office_code, case_no, item_no) DO NOTHING`,
      [userId, courtOfficeCode, caseNo, itemNo],
    );
  }

  /** 없는 항목을 지워도 에러 없이 통과한다 — 해제도 멱등하게 */
  async remove(userId: string, courtOfficeCode: string, caseNo: string, itemNo: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM favorite WHERE user_id = $1 AND court_office_code = $2 AND case_no = $3 AND item_no = $4`,
      [userId, courtOfficeCode, caseNo, itemNo],
    );
  }
}
