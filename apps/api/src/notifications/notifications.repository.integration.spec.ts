// 저장소 SQL 통합 테스트 — 목이 아니라 실제 Postgres로 돌린다 (WP-09 §6, 적대적 리뷰 지적).
// 목 기반 단위 테스트는 감지 창·LATERAL 동률·소유자 재할당 같은 SQL 자체의 결함을 못 잡는다.
//
// 실행: API_RUN_DB_TESTS=1 DATABASE_URL=... pnpm --filter @auction/api test
// (수집기 tools/collector/tests/test_postgres_repository.py와 같은 opt-in 방식.
//  단 여기서는 TRUNCATE하지 않고 고유 키의 픽스처만 만들었다 지운다 — 실데이터 보호)
import { Pool } from 'pg';
import { NotificationsRepository } from './notifications.repository';

/** 첫 행을 꺼낸다 — 없으면 테스트가 그 자리에서 실패하도록 (규칙 19: ! 금지) */
function firstRow<T>(result: { rows: T[] }): T {
  const row = result.rows[0];
  if (!row) throw new Error('행이 반환되지 않았어요');
  return row;
}

const DATABASE_URL = process.env.DATABASE_URL;
const shouldRun = process.env.API_RUN_DB_TESTS === '1' && Boolean(DATABASE_URL);
const describeDb = shouldRun ? describe : describe.skip;

// 실데이터와 겹치지 않는 키
const CASE_NO = 'IT-9999타경1';
const COURT = 'ZZ999999';
const ITEM_NO = '1';
const PROVIDER_A = 'it-user-a';
const PROVIDER_B = 'it-user-b';

describeDb('NotificationsRepository (실 DB)', () => {
  let pool: Pool;
  let repository: NotificationsRepository;
  let userA: string;
  let userB: string;
  let itemId: string;

  const insertSchedule = async (
    bid: string | null,
    price: number | null,
    failed: number | null,
    observedAt: string,
  ): Promise<string> => {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO auction_schedule (auction_item_id, bid_datetime, minimum_sale_price, failed_bid_count, observed_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [itemId, bid, price, failed, observedAt],
    );
    return firstRow(result).id;
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    repository = new NotificationsRepository(pool);

    const a = await pool.query<{ id: string }>(
      `INSERT INTO app_user (provider, provider_user_id, nickname) VALUES ('kakao', $1, '통합A')
       ON CONFLICT (provider, provider_user_id) DO UPDATE SET nickname = EXCLUDED.nickname RETURNING id`,
      [PROVIDER_A],
    );
    userA = firstRow(a).id;
    const b = await pool.query<{ id: string }>(
      `INSERT INTO app_user (provider, provider_user_id, nickname) VALUES ('kakao', $1, '통합B')
       ON CONFLICT (provider, provider_user_id) DO UPDATE SET nickname = EXCLUDED.nickname RETURNING id`,
      [PROVIDER_B],
    );
    userB = firstRow(b).id;

    const auctionCase = await pool.query<{ id: string }>(
      `INSERT INTO auction_case (court_office_code, case_no, court_name) VALUES ($1, $2, '통합법원') RETURNING id`,
      [COURT, CASE_NO],
    );
    const item = await pool.query<{ id: string }>(
      `INSERT INTO auction_item (auction_case_id, item_no, address) VALUES ($1, $2, '통합 테스트 주소') RETURNING id`,
      [firstRow(auctionCase).id, ITEM_NO],
    );
    itemId = firstRow(item).id;

    // A만 관심 등록한다 — B는 같은 물건을 등록하지 않은 대조군
    await pool.query(
      `INSERT INTO favorite (user_id, court_office_code, case_no, item_no) VALUES ($1, $2, $3, $4)`,
      [userA, COURT, CASE_NO, ITEM_NO],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM auction_case WHERE court_office_code = $1`, [COURT]);
    await pool.query(`DELETE FROM app_user WHERE provider_user_id IN ($1, $2)`, [
      PROVIDER_A,
      PROVIDER_B,
    ]);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query(`DELETE FROM auction_schedule WHERE auction_item_id = $1`, [itemId]);
    await pool.query(`DELETE FROM device_token WHERE user_id IN ($1, $2)`, [userA, userB]);
    await pool.query(`DELETE FROM notification_delivery WHERE user_id IN ($1, $2)`, [userA, userB]);
  });

  describe('readSafeWatermark', () => {
    it('DB 시계에서 지연만큼 뺀 시각을 준다 (앱 시계를 쓰지 않는다)', async () => {
      const watermark = await repository.readSafeWatermark(300);
      const dbNow = firstRow(await pool.query<{ now: Date }>(`SELECT now() AS now`)).now;

      const lagMs = dbNow.getTime() - watermark.getTime();
      expect(lagMs).toBeGreaterThanOrEqual(299_000);
      expect(lagMs).toBeLessThan(310_000);
    });
  });

  describe('findScheduleChanges', () => {
    it('구간 안의 신규 관측만, 직전 관측과 함께 돌려준다', async () => {
      await insertSchedule('2026-08-01T10:00:00+09', 900_000_000, 1, '2026-07-01T00:00:00Z');
      const inWindow = await insertSchedule(
        '2026-08-08T10:00:00+09',
        720_000_000,
        2,
        '2026-07-02T00:00:00Z',
      );

      const rows = await repository.findScheduleChanges(
        new Date('2026-07-01T12:00:00Z'),
        new Date('2026-07-03T00:00:00Z'),
        100,
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]?.scheduleId).toBe(inWindow);
      expect(rows[0]?.hasPrevious).toBe(true);
      expect(Number(rows[0]?.prevMinimumSalePrice)).toBe(900_000_000);
      expect(rows[0]?.prevFailedBidCount).toBe(1);
    });

    it('관심 등록자가 없는 물건은 아예 나오지 않는다', async () => {
      await pool.query(`DELETE FROM favorite WHERE user_id = $1`, [userA]);
      await insertSchedule('2026-08-01T10:00:00+09', 900_000_000, 1, '2026-07-01T00:00:00Z');
      await insertSchedule('2026-08-08T10:00:00+09', 720_000_000, 2, '2026-07-02T00:00:00Z');

      const rows = await repository.findScheduleChanges(
        new Date('2026-07-01T12:00:00Z'),
        new Date('2026-07-03T00:00:00Z'),
        100,
      );
      expect(rows).toHaveLength(0);

      await pool.query(
        `INSERT INTO favorite (user_id, court_office_code, case_no, item_no) VALUES ($1, $2, $3, $4)`,
        [userA, COURT, CASE_NO, ITEM_NO],
      );
    });

    it('직전 행이 없으면 hasPrevious가 false다', async () => {
      const first = await insertSchedule(
        '2026-08-01T10:00:00+09',
        900_000_000,
        1,
        '2026-07-02T00:00:00Z',
      );

      const rows = await repository.findScheduleChanges(
        new Date('2026-07-01T00:00:00Z'),
        new Date('2026-07-03T00:00:00Z'),
        100,
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]?.scheduleId).toBe(first);
      expect(rows[0]?.hasPrevious).toBe(false);
    });

    it('직전 행의 값이 전부 NULL이어도 "직전 행 없음"과 구분한다', async () => {
      await insertSchedule(null, null, null, '2026-07-01T00:00:00Z');
      await insertSchedule('2026-08-08T10:00:00+09', 720_000_000, 2, '2026-07-02T00:00:00Z');

      const rows = await repository.findScheduleChanges(
        new Date('2026-07-01T12:00:00Z'),
        new Date('2026-07-03T00:00:00Z'),
        100,
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]?.hasPrevious).toBe(true);
      expect(rows[0]?.prevMinimumSalePrice).toBeNull();
    });

    it('관측 시각이 같은 행들도 id로 직전 관측을 가린다 (수집 배치 동률)', async () => {
      // 한 수집 트랜잭션의 행들은 observed_at이 같다
      const older = await insertSchedule(
        '2026-08-01T10:00:00+09',
        900_000_000,
        1,
        '2026-07-02T00:00:00Z',
      );
      const newer = await insertSchedule(
        '2026-08-08T10:00:00+09',
        720_000_000,
        2,
        '2026-07-02T00:00:00Z',
      );
      expect(Number(newer)).toBeGreaterThan(Number(older));

      const rows = await repository.findScheduleChanges(
        new Date('2026-07-01T00:00:00Z'),
        new Date('2026-07-03T00:00:00Z'),
        100,
      );

      const latest = rows.find(row => row.scheduleId === newer);
      expect(latest?.hasPrevious).toBe(true);
      expect(Number(latest?.prevMinimumSalePrice)).toBe(900_000_000);
    });

    it('limit으로 한 번에 가져오는 양을 묶는다', async () => {
      for (let i = 0; i < 5; i += 1) {
        await insertSchedule('2026-08-01T10:00:00+09', 900_000_000 - i, i, `2026-07-0${i + 1}T00:00:00Z`);
      }

      const rows = await repository.findScheduleChanges(
        new Date('2026-06-01T00:00:00Z'),
        new Date('2026-07-30T00:00:00Z'),
        2,
      );

      expect(rows).toHaveLength(2);
    });
  });

  describe('device_token', () => {
    it('다른 계정이 쥔 토큰은 가로챌 수 없다 (소유자 재할당 금지)', async () => {
      expect(await repository.upsertDeviceToken(userA, 'shared-token', 'android')).toBe(true);

      const hijacked = await repository.upsertDeviceToken(userB, 'shared-token', 'android');

      expect(hijacked).toBe(false);
      const owner = await pool.query<{ user_id: string }>(
        `SELECT user_id FROM device_token WHERE token = 'shared-token'`,
      );
      expect(firstRow(owner).user_id).toBe(userA);
    });

    it('본인 토큰 재등록은 멱등하다', async () => {
      await repository.upsertDeviceToken(userA, 'own-token', 'android');
      expect(await repository.upsertDeviceToken(userA, 'own-token', 'android')).toBe(true);

      const count = await pool.query<{ n: string }>(
        `SELECT count(*) AS n FROM device_token WHERE user_id = $1`,
        [userA],
      );
      expect(Number(firstRow(count).n)).toBe(1);
    });

    it('해제는 본인 토큰만 지운다', async () => {
      await repository.upsertDeviceToken(userA, 'a-token', 'android');

      await repository.deleteOwnDeviceToken(userB, 'a-token');
      expect(
        Number(
          (await pool.query<{ n: string }>(`SELECT count(*) AS n FROM device_token WHERE token = 'a-token'`))
            .rows[0]?.n,
        ),
      ).toBe(1);

      await repository.deleteOwnDeviceToken(userA, 'a-token');
      expect(
        Number(
          (await pool.query<{ n: string }>(`SELECT count(*) AS n FROM device_token WHERE token = 'a-token'`))
            .rows[0]?.n,
        ),
      ).toBe(0);
    });

    it('계정당 기기 수 상한을 넘으면 오래된 것부터 지운다', async () => {
      for (const [token, seenAt] of [
        ['old', '2026-01-01T00:00:00Z'],
        ['mid', '2026-02-01T00:00:00Z'],
        ['new', '2026-03-01T00:00:00Z'],
      ] as const) {
        await pool.query(
          `INSERT INTO device_token (user_id, token, platform, last_seen_at) VALUES ($1, $2, 'android', $3)`,
          [userA, token, seenAt],
        );
      }

      await repository.pruneDeviceTokens(userA, 2);

      const rows = await pool.query<{ token: string }>(
        `SELECT token FROM device_token WHERE user_id = $1 ORDER BY last_seen_at`,
        [userA],
      );
      expect(rows.rows.map(row => row.token)).toEqual(['mid', 'new']);
    });

    it('관심 등록자의 기기만, 등록자 아닌 사람 것은 빼고 돌려준다', async () => {
      await repository.upsertDeviceToken(userA, 'a-phone', 'android');
      await repository.upsertDeviceToken(userA, 'a-tablet', 'android');
      await repository.upsertDeviceToken(userB, 'b-phone', 'android');

      const devices = await repository.findTokensForFavorite(COURT, CASE_NO, ITEM_NO);

      expect(devices.map(device => device.token).sort()).toEqual(['a-phone', 'a-tablet']);
      expect(devices.every(device => device.userId === userA)).toBe(true);
    });
  });

  describe('claimDelivery', () => {
    it('같은 키는 한 번만 선점된다 (UNIQUE 제약이 실제로 건다)', async () => {
      expect(await repository.claimDelivery(userA, 'schedule:1', itemId, 'schedule-change')).toBe(true);
      expect(await repository.claimDelivery(userA, 'schedule:1', itemId, 'schedule-change')).toBe(false);
    });

    it('되돌리면 다시 선점할 수 있다', async () => {
      await repository.claimDelivery(userA, 'schedule:2', itemId, 'schedule-change');
      await repository.releaseDelivery(userA, 'schedule:2');

      expect(await repository.claimDelivery(userA, 'schedule:2', itemId, 'schedule-change')).toBe(true);
    });

    it('사용자가 다르면 서로 막지 않는다', async () => {
      expect(await repository.claimDelivery(userA, 'schedule:3', itemId, 'schedule-change')).toBe(true);
      expect(await repository.claimDelivery(userB, 'schedule:3', itemId, 'schedule-change')).toBe(true);
    });
  });

  describe('findReminderCandidates', () => {
    it('창 안에 매각기일이 있는 관심 물건만 돌려준다', async () => {
      await insertSchedule('2026-08-05T10:00:00+09', 900_000_000, 1, '2026-07-02T00:00:00Z');

      const inside = await repository.findReminderCandidates(
        new Date('2026-08-01T00:00:00Z'),
        new Date('2026-08-10T00:00:00Z'),
      );
      const outside = await repository.findReminderCandidates(
        new Date('2026-09-01T00:00:00Z'),
        new Date('2026-09-10T00:00:00Z'),
      );

      expect(inside.map(row => row.auctionItemId)).toContain(itemId);
      expect(outside.map(row => row.auctionItemId)).not.toContain(itemId);
    });
  });
});
