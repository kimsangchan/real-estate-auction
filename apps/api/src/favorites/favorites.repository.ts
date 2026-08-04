// 관심 물건 리포지토리 — favorite 테이블을 pg 드라이버로 직접 다룬다 (ORM 미사용, 기존 패턴 준수)
// findByUser는 auction_item/auction_case와 조인해 웹 ItemCard가 쓰는 필드까지 채운다 (WP-08 §1-8,
// auction-items.repository.ts의 SELECT_AND_FROM 패턴을 그대로 재사용)
import { Inject, Injectable } from '@nestjs/common';
import type { Pool, QueryResultRow } from 'pg';
import type { AuctionItemDto } from '../auction-items/dto/auction-item.dto';

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
  address: string | null;
  appraisalAmount: string | null;
  minimumSalePrice: string | null;
  failedBidCount: number | null;
  bidDatetime: Date | null;
  assumedRightsKind: string | null;
  riskFlags: string[] | null;
  tenantCount: string | null;
  lng: number | null;
  lat: number | null;
  favoritedAt: Date;
}

function toRecord(row: FavoriteRow): FavoriteRecord {
  return {
    ...row,
    appraisalAmount: row.appraisalAmount === null ? null : Number(row.appraisalAmount),
    minimumSalePrice: row.minimumSalePrice === null ? null : Number(row.minimumSalePrice),
    bidDatetime: row.bidDatetime === null ? null : row.bidDatetime.toISOString(),
    // 명세서가 없는 물건은 "위험 없음"이 아니라 "확인 못 함"이다 (auction-items.repository와 동일 규칙)
    riskFlags: row.riskFlags ?? [],
    tenantCount: row.tenantCount == null ? null : Number(row.tenantCount),
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
    ai.address AS "address",
    ai.appraisal_amount AS "appraisalAmount",
    ai.minimum_sale_price AS "minimumSalePrice",
    ai.failed_bid_count AS "failedBidCount",
    sch.bid_datetime AS "bidDatetime",
    ntc.assumed_rights_kind AS "assumedRightsKind",
    ntc.risk_flags AS "riskFlags",
    ntc.tenant_count AS "tenantCount",
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
    return result.rows.map(toRecord);
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
