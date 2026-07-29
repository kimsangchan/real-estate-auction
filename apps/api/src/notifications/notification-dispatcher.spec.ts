import { FcmUnavailableError, type FcmClient } from './fcm.client';
import { NotificationDispatcher } from './notification-dispatcher';
import type { NotificationsRepository, ScheduleChangeRow } from './notifications.repository';

const kst = (iso: string): Date => new Date(`${iso}+09:00`);
const DAYTIME = kst('2026-08-01T10:00:00');
const WATERMARK = kst('2026-08-01T09:55:00');
const CURSOR = kst('2026-08-01T09:00:00');

function buildDeps(
  overrides: {
    repository?: Partial<jest.Mocked<NotificationsRepository>>;
    send?: jest.Mock;
    now?: Date;
  } = {},
) {
  const repository = {
    upsertDeviceToken: jest.fn(),
    deleteDeviceToken: jest.fn(),
    deleteOwnDeviceToken: jest.fn(),
    pruneDeviceTokens: jest.fn(),
    findTokensForFavorite: jest.fn().mockResolvedValue([{ userId: 'user-1', token: 'tok-1' }]),
    findScheduleChanges: jest.fn().mockResolvedValue([]),
    findReminderCandidates: jest.fn().mockResolvedValue([]),
    claimDelivery: jest.fn().mockResolvedValue(true),
    releaseDelivery: jest.fn(),
    readSafeWatermark: jest.fn().mockResolvedValue(WATERMARK),
    readCursor: jest.fn().mockResolvedValue(CURSOR),
    writeCursor: jest.fn(),
    ...overrides.repository,
  } as unknown as jest.Mocked<NotificationsRepository>;

  const send = overrides.send ?? jest.fn().mockResolvedValue('sent');
  const fcm = { send } as unknown as FcmClient;
  const now = overrides.now ?? DAYTIME;

  return {
    repository,
    send,
    dispatcher: new NotificationDispatcher(repository, fcm, () => now.getTime()),
  };
}

const change = (overrides: Partial<ScheduleChangeRow> = {}): ScheduleChangeRow =>
  ({
    scheduleId: '11',
    auctionItemId: '7',
    observedAt: kst('2026-08-01T09:30:00'),
    courtOfficeCode: 'B000210',
    caseNo: '2025타경939',
    itemNo: '3',
    address: '서울특별시 서초구 서초동 1603-71',
    bidDatetime: kst('2026-09-15T14:00:00'),
    minimumSalePrice: '720800000',
    failedBidCount: 2,
    hasPrevious: true,
    prevBidDatetime: kst('2026-08-01T10:00:00'),
    prevMinimumSalePrice: '901000000',
    prevFailedBidCount: 1,
    ...overrides,
  }) as ScheduleChangeRow;

describe('NotificationDispatcher.run', () => {
  it('조용한 시간이면 아무 것도 보내지 않고 커서도 움직이지 않는다', async () => {
    const { dispatcher, repository, send } = buildDeps({ now: kst('2026-08-01T23:00:00') });

    const summary = await dispatcher.run();

    expect(summary.skippedQuietHours).toBe(true);
    expect(send).not.toHaveBeenCalled();
    expect(repository.writeCursor).not.toHaveBeenCalled();
  });

  it('구간 경계는 앱 시계가 아니라 DB 워터마크로 잡는다', async () => {
    const { dispatcher, repository } = buildDeps();

    await dispatcher.run();

    expect(repository.readSafeWatermark).toHaveBeenCalled();
    expect(repository.findScheduleChanges).toHaveBeenCalledWith(CURSOR, WATERMARK, expect.any(Number));
  });

  it('커서가 없으면 과거를 몰아 보내지 않고 워터마크부터 시작한다', async () => {
    const { dispatcher, repository, send } = buildDeps({
      repository: { readCursor: jest.fn().mockResolvedValue(null) },
    });

    await dispatcher.run();

    expect(repository.findScheduleChanges).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(repository.writeCursor).toHaveBeenCalledWith('schedule-change', WATERMARK);
  });

  it('변동이 있으면 관심 등록자에게 보내고 커서를 옮긴다', async () => {
    const { dispatcher, repository, send } = buildDeps({
      repository: { findScheduleChanges: jest.fn().mockResolvedValue([change()]) },
    });

    const summary = await dispatcher.run();

    expect(summary.sent).toBe(1);
    expect(send).toHaveBeenCalledWith(
      'tok-1',
      expect.objectContaining({
        data: { courtOfficeCode: 'B000210', caseNo: '2025타경939', itemNo: '3' },
      }),
    );
    expect(repository.writeCursor).toHaveBeenCalled();
  });

  it('발송이 실패하면 커서를 옮기지 않는다 — 옮기면 그 변동이 영구히 사라진다', async () => {
    const { dispatcher, repository } = buildDeps({
      repository: { findScheduleChanges: jest.fn().mockResolvedValue([change()]) },
      send: jest.fn().mockResolvedValue('failed'),
    });

    const summary = await dispatcher.run();

    expect(summary.failed).toBe(1);
    expect(repository.releaseDelivery).toHaveBeenCalledWith('user-1', 'schedule:11');
    expect(repository.writeCursor).not.toHaveBeenCalled();
  });

  it('한 물건에 관측이 여러 건이면 알림 1건으로 접는다 (T-07)', async () => {
    const { dispatcher, send, repository } = buildDeps({
      repository: {
        findScheduleChanges: jest.fn().mockResolvedValue([
          change({ scheduleId: '11', observedAt: kst('2026-08-01T09:10:00') }),
          change({
            scheduleId: '12',
            observedAt: kst('2026-08-01T09:20:00'),
            failedBidCount: 3,
            minimumSalePrice: '576640000',
            hasPrevious: true,
          }),
        ]),
      },
    });

    const summary = await dispatcher.run();

    expect(send).toHaveBeenCalledTimes(1);
    expect(summary.sent).toBe(1);
    // 구간 마지막 상태가 반영돼야 한다
    expect(send.mock.calls[0][1].body).toContain('3회 유찰');
    // dedupe 키는 마지막 관측 기준
    expect(repository.claimDelivery).toHaveBeenCalledWith(
      'user-1',
      'schedule:12',
      '7',
      'schedule-change',
    );
  });

  it('기기가 여러 대면 모두 보내되 멱등 기록은 사용자 단위로 1건이다', async () => {
    const { dispatcher, repository, send } = buildDeps({
      repository: {
        findScheduleChanges: jest.fn().mockResolvedValue([change()]),
        findTokensForFavorite: jest.fn().mockResolvedValue([
          { userId: 'user-1', token: 'phone' },
          { userId: 'user-1', token: 'tablet' },
        ]),
      },
    });

    const summary = await dispatcher.run();

    expect(send).toHaveBeenCalledTimes(2);
    expect(repository.claimDelivery).toHaveBeenCalledTimes(1);
    expect(summary.sent).toBe(1);
    expect(summary.deduped).toBe(0);
  });

  it('첫 관측(직전 행 없음)은 알리지 않는다', async () => {
    const { dispatcher, send } = buildDeps({
      repository: {
        findScheduleChanges: jest.fn().mockResolvedValue([
          change({
            hasPrevious: false,
            prevBidDatetime: null,
            prevMinimumSalePrice: null,
            prevFailedBidCount: null,
          }),
        ]),
      },
    });

    await dispatcher.run();

    expect(send).not.toHaveBeenCalled();
  });

  it('직전 행의 값이 전부 NULL이어도 "직전 행 없음"으로 보지 않는다', async () => {
    const { dispatcher, send } = buildDeps({
      repository: {
        findScheduleChanges: jest.fn().mockResolvedValue([
          change({
            hasPrevious: true,
            prevBidDatetime: null,
            prevMinimumSalePrice: null,
            prevFailedBidCount: null,
          }),
        ]),
      },
    });

    await dispatcher.run();

    expect(send).toHaveBeenCalled();
  });

  it('이미 보낸 변동이면 다시 보내지 않는다 (멱등)', async () => {
    const { dispatcher, send } = buildDeps({
      repository: {
        findScheduleChanges: jest.fn().mockResolvedValue([change()]),
        claimDelivery: jest.fn().mockResolvedValue(false),
      },
    });

    const summary = await dispatcher.run();

    expect(send).not.toHaveBeenCalled();
    expect(summary.deduped).toBe(1);
  });

  it('관심 등록자가 없으면 발송 대상이 없다', async () => {
    const { dispatcher, send } = buildDeps({
      repository: {
        findScheduleChanges: jest.fn().mockResolvedValue([change()]),
        findTokensForFavorite: jest.fn().mockResolvedValue([]),
      },
    });

    const summary = await dispatcher.run();

    expect(send).not.toHaveBeenCalled();
    expect(summary.sent).toBe(0);
  });

  it('앱이 지워진 기기(unregistered)면 토큰을 지우고 기록을 되돌린다', async () => {
    const { dispatcher, repository } = buildDeps({
      repository: { findScheduleChanges: jest.fn().mockResolvedValue([change()]) },
      send: jest.fn().mockResolvedValue('unregistered'),
    });

    const summary = await dispatcher.run();

    expect(repository.deleteDeviceToken).toHaveBeenCalledWith('tok-1');
    expect(repository.releaseDelivery).toHaveBeenCalledWith('user-1', 'schedule:11');
    expect(summary.staleTokensRemoved).toBe(1);
  });

  it('발송 중 예외가 나도 선점한 기록을 반드시 되돌린다', async () => {
    const { dispatcher, repository } = buildDeps({
      repository: { findScheduleChanges: jest.fn().mockResolvedValue([change()]) },
      send: jest.fn().mockRejectedValue(new Error('ECONNRESET')),
    });

    await expect(dispatcher.run()).rejects.toThrow('ECONNRESET');

    // 되돌리지 않으면 그 사용자는 이 알림을 영원히 못 받는다.
    expect(repository.releaseDelivery).toHaveBeenCalledWith('user-1', 'schedule:11');
    expect(repository.writeCursor).not.toHaveBeenCalled();
  });

  it('액세스 토큰을 못 받으면 실행을 중단하고 커서를 두고 나간다', async () => {
    const { dispatcher, repository } = buildDeps({
      repository: { findScheduleChanges: jest.fn().mockResolvedValue([change()]) },
      send: jest.fn().mockRejectedValue(new FcmUnavailableError('token')),
    });

    const summary = await dispatcher.run();

    expect(summary.abortedUnavailable).toBe(true);
    expect(repository.writeCursor).not.toHaveBeenCalled();
  });

  it('D-3 리마인더는 KST 날짜로 dedupe 키를 만든다', async () => {
    const { dispatcher, repository, send } = buildDeps({
      repository: {
        findReminderCandidates: jest.fn().mockResolvedValue([
          {
            auctionItemId: '7',
            courtOfficeCode: 'B000210',
            caseNo: '2025타경939',
            itemNo: '3',
            address: '서초동',
            // KST 자정 — UTC로 찍으면 전날(08-03)이 된다
            bidDatetime: kst('2026-08-04T00:00:00'),
          },
        ]),
      },
    });

    const summary = await dispatcher.run();

    expect(summary.remindersFound).toBe(1);
    expect(send).toHaveBeenCalled();
    expect(repository.claimDelivery).toHaveBeenCalledWith(
      'user-1',
      'remind:7:2026-08-04:D-3',
      '7',
      'bid-reminder',
    );
  });

  it('D-2는 리마인더 대상이 아니다', async () => {
    const { dispatcher, send } = buildDeps({
      repository: {
        findReminderCandidates: jest.fn().mockResolvedValue([
          {
            auctionItemId: '7',
            courtOfficeCode: 'B000210',
            caseNo: '2025타경939',
            itemNo: '3',
            address: '서초동',
            bidDatetime: kst('2026-08-03T10:00:00'),
          },
        ]),
      },
    });

    const summary = await dispatcher.run();

    expect(send).not.toHaveBeenCalled();
    expect(summary.remindersFound).toBe(0);
  });
});
