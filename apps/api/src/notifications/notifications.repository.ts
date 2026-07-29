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
  observedAt: Date;
  courtOfficeCode: string;
  caseNo: string;
  itemNo: string;
  address: string | null;
  bidDatetime: Date | null;
  minimumSalePrice: string | null;
  failedBidCount: number | null;
  hasPrevious: boolean;
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
    s.observed_at AS "observedAt",
    ac.court_office_code AS "courtOfficeCode",
    ac.case_no AS "caseNo",
    ai.item_no AS "itemNo",
    ai.address AS "address",
    s.bid_datetime AS "bidDatetime",
    s.minimum_sale_price AS "minimumSalePrice",
    s.failed_bid_count AS "failedBidCount",
    -- "직전 행이 없음"과 "직전 행의 값이 전부 NULL"은 다르다 — 후자는 알려야 할 변동이다
    (prev.id IS NOT NULL) AS "hasPrevious",
    prev.bid_datetime AS "prevBidDatetime",
    prev.minimum_sale_price AS "prevMinimumSalePrice",
    prev.failed_bid_count AS "prevFailedBidCount"
  FROM auction_schedule s
  JOIN auction_item ai ON ai.id = s.auction_item_id
  JOIN auction_case ac ON ac.id = ai.auction_case_id
  LEFT JOIN LATERAL (
    -- 한 수집 배치의 행들은 observed_at이 같다(now()는 트랜잭션 시각) — id로 동률을 깬다
    SELECT p.id, p.bid_datetime, p.minimum_sale_price, p.failed_bid_count
    FROM auction_schedule p
    WHERE p.auction_item_id = s.auction_item_id
      AND (p.observed_at, p.id) < (s.observed_at, s.id)
    ORDER BY p.observed_at DESC, p.id DESC
    LIMIT 1
  ) prev ON true
  WHERE s.observed_at > $1 AND s.observed_at <= $2
    AND EXISTS (
      SELECT 1 FROM favorite f
      WHERE f.court_office_code = ac.court_office_code
        AND f.case_no = ac.case_no
        AND f.item_no = ai.item_no
    )
  ORDER BY s.observed_at, s.id
  LIMIT $3
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

  /**
   * 토큰은 요청자가 그대로 보내는 값이라 소유자 재할당의 근거가 될 수 없다 —
   * 이미 다른 계정에 붙은 토큰이면 아무 것도 하지 않는다. 재할당을 허용하면 남의 토큰으로
   * 등록해 그 기기에 임의 물건 알림을 밀어넣을 수 있다 (T-07 예상 밖 노출).
   * 기기 인계는 로그아웃 시 DELETE로 이미 정리된다.
   */
  async upsertDeviceToken(userId: string, token: string, platform: string): Promise<boolean> {
    const result = await this.pool.query(
      `INSERT INTO device_token (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (token)
       DO UPDATE SET platform = EXCLUDED.platform, last_seen_at = now()
       WHERE device_token.user_id = EXCLUDED.user_id
       RETURNING id`,
      [userId, token, platform],
    );
    return result.rows.length > 0;
  }

  /** 사용자 요청 경로 — 반드시 본인 토큰만 지운다 */
  async deleteOwnDeviceToken(userId: string, token: string): Promise<void> {
    await this.pool.query(`DELETE FROM device_token WHERE token = $1 AND user_id = $2`, [
      token,
      userId,
    ]);
  }

  /** 발송 잡 전용 — FCM이 죽었다고 알려준 토큰을 지운다(소유자와 무관하게 무효인 토큰) */
  async deleteDeviceToken(token: string): Promise<void> {
    await this.pool.query(`DELETE FROM device_token WHERE token = $1`, [token]);
  }

  /** 계정당 기기 수 상한 — 무제한 등록으로 발송 루프를 늘려 잡을 마비시키는 것을 막는다 */
  async pruneDeviceTokens(userId: string, keep: number): Promise<void> {
    await this.pool.query(
      `DELETE FROM device_token
       WHERE user_id = $1
         AND id NOT IN (
           SELECT id FROM device_token WHERE user_id = $1
           ORDER BY last_seen_at DESC LIMIT $2
         )`,
      [userId, keep],
    );
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

  /** limit으로 한 번에 처리할 양을 묶는다 — 장기 중단 후 밀린 이력을 한꺼번에 올리지 않게 (T-07) */
  async findScheduleChanges(since: Date, through: Date, limit: number): Promise<ScheduleChangeRow[]> {
    const result = await this.pool.query<ScheduleChangeRow>(SELECT_SCHEDULE_CHANGES, [
      since,
      through,
      limit,
    ]);
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

  /**
   * 구간 경계는 반드시 DB 시계로 잡는다 — 앱 프로세스 시계를 쓰면 DB와의 시차만큼 행이 새어나간다.
   * observed_at의 now()는 트랜잭션 "시작" 시각이라, 커밋이 늦은 수집 배치는 우리 SELECT가 지나간
   * 뒤에 더 이른 observed_at으로 보이게 된다 — 그래서 안전 지연(lag)만큼 뒤를 잘라 읽는다.
   */
  async readSafeWatermark(lagSeconds: number): Promise<Date> {
    const result = await this.pool.query<{ watermark: Date } & QueryResultRow>(
      `SELECT now() - make_interval(secs => $1) AS "watermark"`,
      [lagSeconds],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('DB 시각을 읽지 못했어요');
    }
    return row.watermark;
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
