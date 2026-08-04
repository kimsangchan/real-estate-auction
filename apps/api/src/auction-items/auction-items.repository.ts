// 물건 조회 리포지토리 — WP-02 수집기가 채운 auction_item/auction_case/auction_item_raw를 읽기 전용으로 조회.
// usageName/deptName/시도/시군구는 별도 컬럼이 없어 WP-02가 저장해 둔 원문 스냅샷(auction_item_raw.payload)에서 읽는다.
import { Inject, Injectable } from '@nestjs/common';
import type { Pool, QueryResultRow } from 'pg';
import type { AuctionCasePhotoDto } from './dto/auction-case-photo.dto';
import type { AuctionItemDto } from './dto/auction-item.dto';
import type { Bbox } from './dto/bbox.dto';
import type { RegionCountDto } from './dto/region-count.dto';

export const PG_POOL = Symbol('PG_POOL');

const JOIN_RAW_AND_SCHEDULE = `
  FROM auction_item ai
  JOIN auction_case ac ON ac.id = ai.auction_case_id
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
  -- 매각물건명세서는 기일마다 새로 작성되므로 가장 최근 것 하나만 쓴다 (수집기 §4-13).
  -- 점유자 수는 tenant_seq로 센다 — 같은 사람이 정보출처별로 여러 행에 나오기 때문이다 (§4-8).
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

const SELECT_AND_FROM = `
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
    ST_Y(ai.geom) AS "lat"
  ${JOIN_RAW_AND_SCHEDULE}
`;

interface AuctionItemRow extends QueryResultRow {
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
}

function toDto(row: AuctionItemRow): AuctionItemDto {
  return {
    ...row,
    appraisalAmount: row.appraisalAmount === null ? null : Number(row.appraisalAmount),
    minimumSalePrice: row.minimumSalePrice === null ? null : Number(row.minimumSalePrice),
    bidDatetime: row.bidDatetime === null ? null : row.bidDatetime.toISOString(),
    // 명세서가 없는 물건은 "위험 없음"이 아니라 "확인 못 함"이다 — 빈 배열과 null을 구분한다
    riskFlags: row.riskFlags ?? [],
    // ?? 로 받는다 — null만 검사하면 컬럼이 undefined일 때 Number(undefined)가 NaN이 된다
    tenantCount: row.tenantCount == null ? null : Number(row.tenantCount),
  };
}

interface RegionCountRow extends QueryResultRow {
  region: string;
  count: string;
}

interface CaseIdRow extends QueryResultRow {
  caseId: string;
}

// id는 BIGSERIAL이라 pg가 문자열로 돌려준다 — DTO 변환 시 숫자로 바꾼다
interface PhotoMetaRow extends QueryResultRow {
  id: string;
  source: string;
  seq: number;
  categoryName: string | null;
  caption: string | null;
  contentType: string | null;
  byteSize: number;
}

interface PhotoBytesRow extends QueryResultRow {
  contentType: string | null;
  bytes: Buffer;
}

@Injectable()
export class AuctionItemsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findOne(courtOfficeCode: string, caseNo: string, itemNo: string): Promise<AuctionItemDto | null> {
    const result = await this.pool.query<AuctionItemRow>(
      `${SELECT_AND_FROM} WHERE ac.court_office_code = $1 AND ac.case_no = $2 AND ai.item_no = $3`,
      [courtOfficeCode, caseNo, itemNo],
    );
    const row = result.rows[0];
    return row ? toDto(row) : null;
  }

  async findMany(
    limit: number,
    offset: number,
    filter: { sido?: string; sigungu?: string } = {},
  ): Promise<AuctionItemDto[]> {
    const result = await this.pool.query<AuctionItemRow>(
      `${SELECT_AND_FROM}
       WHERE ($3::text IS NULL OR raw.payload->>'hjguSido' = $3)
         AND ($4::text IS NULL OR raw.payload->>'hjguSigu' = $4)
       ORDER BY ai.updated_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset, filter.sido ?? null, filter.sigungu ?? null],
    );
    return result.rows.map(toDto);
  }

  async countBySido(): Promise<RegionCountDto[]> {
    const result = await this.pool.query<RegionCountRow>(
      `SELECT raw.payload->>'hjguSido' AS region, COUNT(*) AS count
       ${JOIN_RAW_AND_SCHEDULE}
       WHERE raw.payload->>'hjguSido' IS NOT NULL
       GROUP BY raw.payload->>'hjguSido'
       ORDER BY count DESC`,
    );
    return result.rows.map((row) => ({ name: row.region, count: Number(row.count) }));
  }

  async countBySigungu(sido: string): Promise<RegionCountDto[]> {
    const result = await this.pool.query<RegionCountRow>(
      `SELECT raw.payload->>'hjguSigu' AS region, COUNT(*) AS count
       ${JOIN_RAW_AND_SCHEDULE}
       WHERE raw.payload->>'hjguSido' = $1 AND raw.payload->>'hjguSigu' IS NOT NULL
       GROUP BY raw.payload->>'hjguSigu'
       ORDER BY count DESC`,
      [sido],
    );
    return result.rows.map((row) => ({ name: row.region, count: Number(row.count) }));
  }

  /**
   * 물건 → 사건으로 조인해 그 사건의 사진 메타를 돌려준다 (사진은 사건 단위 — 008_item_photos.sql).
   * 물건이 없으면 null, 사진이 없으면 빈 배열. 현장 전경(ITEM)이 먼저 보이도록 ITEM → APPRAISAL 순으로 정렬한다.
   */
  async findPhotos(
    courtOfficeCode: string,
    caseNo: string,
    itemNo: string,
  ): Promise<AuctionCasePhotoDto[] | null> {
    const itemResult = await this.pool.query<CaseIdRow>(
      `SELECT ac.id AS "caseId"
       FROM auction_item ai
       JOIN auction_case ac ON ac.id = ai.auction_case_id
       WHERE ac.court_office_code = $1 AND ac.case_no = $2 AND ai.item_no = $3`,
      [courtOfficeCode, caseNo, itemNo],
    );
    const caseId = itemResult.rows[0]?.caseId;
    if (caseId === undefined) return null;

    const photoResult = await this.pool.query<PhotoMetaRow>(
      `SELECT id, source, seq,
              category_name AS "categoryName",
              caption,
              content_type AS "contentType",
              byte_size AS "byteSize"
       FROM auction_case_photo
       WHERE auction_case_id = $1
       ORDER BY CASE WHEN source = 'ITEM' THEN 0 ELSE 1 END, seq`,
      [caseId],
    );
    return photoResult.rows.map((row) => ({ ...row, id: Number(row.id) }));
  }

  /** 사진 바이너리 단건 조회 — 이미지 응답용. 없으면 null */
  async findPhotoBytes(id: string): Promise<{ contentType: string | null; bytes: Buffer } | null> {
    const result = await this.pool.query<PhotoBytesRow>(
      `SELECT content_type AS "contentType", bytes FROM auction_case_photo WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? { contentType: row.contentType, bytes: row.bytes } : null;
  }

  /** 지도 뷰포트(경위도 사각형) 안의 물건을 찾는다 — 지도 홈(F-01, RN)의 팬/줌 갱신용 */
  async findItemsInBbox(bbox: Bbox, limit: number): Promise<AuctionItemDto[]> {
    const result = await this.pool.query<AuctionItemRow>(
      `${SELECT_AND_FROM}
       WHERE ai.geom IS NOT NULL
         AND ST_Intersects(ai.geom, ST_MakeEnvelope($1, $2, $3, $4, 4326))
       ORDER BY ai.updated_at DESC
       LIMIT $5`,
      [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat, limit],
    );
    return result.rows.map(toDto);
  }
}
