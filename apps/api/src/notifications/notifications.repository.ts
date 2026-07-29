// 알림 리포지토리 — 기기 토큰, 변동 감지, 발송 멱등 기록, 잡 커서를 pg 드라이버로 직접 다룬다
// (ORM 미사용, favorites.repository.ts의 자연키 조인 패턴 재사용, WP-09 §1)
import { Inject, Injectable } from '@nestjs/common';
import type { Pool, QueryResultRow } from 'pg';

export const NOTIFICATIONS_PG_POOL = Symbol('NOTIFICATIONS_PG_POOL');

export interface DeviceTokenRecord {
  userId: string;
  token: string;
}

export interface ScheduleChangeRow extends QueryResultRow {
  scheduleId: string;
  auctionItemId: string;
  courtOfficeCode: string;
  caseNo: string;
  itemNo: string;
  address: string | null;
  bidDatetime: Date | null;
  minimumSalePrice: string | null;
  failedBidCount: number | null;
  prevBidDatetime: Date | null;
  prevMinimumSalePrice: string | null;
  prevFailedBidCount: number | null;
}

export interface ReminderCandidateRow extends QueryResultRow {
  auctionItemId: string;
  courtOfficeCode: string;
  caseNo: string;
  itemNo: string;
  address: string | null;
  bidDatetime: Date;
}

// 관심 등록자가 있는 물건의 신규 관측만 본다 — 아무도 등록하지 않은 물건은 알릴 대상이 아니다 (F-06).
const SELECT_SCHEDULE_CHANGES = `
  SELECT
    s.id AS "scheduleId",
    s.auction_item_id AS "auctionItemId",
    ac.court_office_code AS "courtOfficeCode",
    ac.case_no AS "caseNo",
    ai.item_no AS "itemNo",
    ai.address AS "address",
    s.bid_datetime AS "bidDatetime",
    s.minimum_sale_price AS "minimumSalePrice",
    s.failed_bid_count AS "failedBidCount",
    prev.bid_datetime AS "prevBidDatetime",
    prev.minimum_sale_price AS "prevMinimumSalePrice",
    prev.failed_bid_count AS "prevFailedBidCount"
  FROM auction_schedule s
  JOIN auction_item ai ON ai.id = s.auction_item_id
  JOIN auction_case ac ON ac.id = ai.auction_case_id
  LEFT JOIN LATERAL (
    SELECT p.bid_datetime, p.minimum_sale_price, p.failed_bid_count
    FROM auction_schedule p
    WHERE p.auction_item_id = s.auction_item_id AND p.observed_at < s.observed_at
    ORDER BY p.observed_at DESC
    LIMIT 1
  ) prev ON true
  WHERE s.observed_at > $1 AND s.observed_at <= $2
    AND EXISTS (
      SELECT 1 FROM favorite f
      WHERE f.court_office_code = ac.court_office_code
        AND f.case_no = ac.case_no
        AND f.item_no = ai.item_no
    )
  ORDER BY s.observed_at
`;

// 리마인더 후보 — D-n 판정은 KST 달력 기준이라 SQL에서 하지 않고 넉넉한 창만 가져와 TS에서 거른다 (§3-4).
const SELECT_REMINDER_CANDIDATES = `
  SELECT DISTINCT
    ai.id AS "auctionItemId",
    ac.court_office_code AS "courtOfficeCode",
    ac.case_no AS "caseNo",
    ai.item_no AS "itemNo",
    ai.address AS "address",
    sch.bid_datetime AS "bidDatetime"
  FROM favorite f
  JOIN auction_case ac ON ac.court_office_code = f.court_office_code AND ac.case_no = f.case_no
  JOIN auction_item ai ON ai.auction_case_id = ac.id AND ai.item_no = f.item_no
  JOIN LATERAL (
    SELECT bid_datetime FROM auction_schedule
    WHERE auction_item_id = ai.id
    ORDER BY observed_at DESC LIMIT 1
  ) sch ON true
  WHERE sch.bid_datetime IS NOT NULL
    AND sch.bid_datetime > $1
    AND sch.bid_datetime < $2
`;

@Injectable()
export class NotificationsRepository {
  constructor(@Inject(NOTIFICATIONS_PG_POOL) private readonly pool: Pool) {}

  /** 같은 토큰이 다른 계정으로 재등록될 수 있다(기기 공유) — 소유자를 갱신한다 */
  async upsertDeviceToken(userId: string, token: string, platform: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO device_token (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (token)
       DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, last_seen_at = now()`,
      [userId, token, platform],
    );
  }

  async deleteDeviceToken(token: string): Promise<void> {
    await this.pool.query(`DELETE FROM device_token WHERE token = $1`, [token]);
  }

  async findTokensForFavorite(
    courtOfficeCode: string,
    caseNo: string,
    itemNo: string,
  ): Promise<DeviceTokenRecord[]> {
    const result = await this.pool.query<{ userId: string; token: string } & QueryResultRow>(
      `SELECT d.user_id AS "userId", d.token AS "token"
       FROM favorite f
       JOIN device_token d ON d.user_id = f.user_id
       WHERE f.court_office_code = $1 AND f.case_no = $2 AND f.item_no = $3`,
      [courtOfficeCode, caseNo, itemNo],
    );
    return result.rows;
  }

  async findScheduleChanges(since: Date, through: Date): Promise<ScheduleChangeRow[]> {
    const result = await this.pool.query<ScheduleChangeRow>(SELECT_SCHEDULE_CHANGES, [since, through]);
    return result.rows;
  }

  async findReminderCandidates(from: Date, to: Date): Promise<ReminderCandidateRow[]> {
    const result = await this.pool.query<ReminderCandidateRow>(SELECT_REMINDER_CANDIDATES, [from, to]);
    return result.rows;
  }

  /**
   * 발송 기록을 먼저 남긴다 — 이미 있으면 false를 돌려 보내지 않는다.
   * (user_id, dedupe_key) UNIQUE라 잡이 중복 실행돼도 같은 알림이 두 번 나가지 않는다 (규칙 10).
   */
  async claimDelivery(
    userId: string,
    dedupeKey: string,
    auctionItemId: string,
    kind: string,
  ): Promise<boolean> {
    const result = await this.pool.query(
      `INSERT INTO notification_delivery (user_id, dedupe_key, auction_item_id, kind)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, dedupe_key) DO NOTHING
       RETURNING id`,
      [userId, dedupeKey, auctionItemId, kind],
    );
    return result.rows.length > 0;
  }

  /** 발송이 끝내 실패하면 기록을 지워 다음 실행에서 다시 시도할 수 있게 한다 */
  async releaseDelivery(userId: string, dedupeKey: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM notification_delivery WHERE user_id = $1 AND dedupe_key = $2`,
      [userId, dedupeKey],
    );
  }

  async readCursor(name: string): Promise<Date | null> {
    const result = await this.pool.query<{ processedThrough: Date } & QueryResultRow>(
      `SELECT processed_through AS "processedThrough" FROM notification_cursor WHERE name = $1`,
      [name],
    );
    return result.rows[0]?.processedThrough ?? null;
  }

  async writeCursor(name: string, processedThrough: Date): Promise<void> {
    await this.pool.query(
      `INSERT INTO notification_cursor (name, processed_through)
       VALUES ($1, $2)
       ON CONFLICT (name)
       DO UPDATE SET processed_through = EXCLUDED.processed_through, updated_at = now()`,
      [name, processedThrough],
    );
  }
}
