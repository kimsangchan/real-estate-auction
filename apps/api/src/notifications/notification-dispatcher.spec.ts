import type { FcmClient } from './fcm.client';
import { NotificationDispatcher } from './notification-dispatcher';
import type { NotificationsRepository, ScheduleChangeRow } from './notifications.repository';

const kst = (iso: string): Date => new Date(`${iso}+09:00`);
const DAYTIME = kst('2026-08-01T10:00:00');

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
    findTokensForFavorite: jest.fn().mockResolvedValue([{ userId: 'user-1', token: 'tok-1' }]),
    findScheduleChanges: jest.fn().mockResolvedValue([]),
    findReminderCandidates: jest.fn().mockResolvedValue([]),
    claimDelivery: jest.fn().mockResolvedValue(true),
    releaseDelivery: jest.fn(),
    readCursor: jest.fn().mockResolvedValue(kst('2026-08-01T09:00:00')),
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
    courtOfficeCode: 'B000210',
    caseNo: '2025타경939',
    itemNo: '3',
    address: '서울특별시 서초구 서초동 1603-71',
    bidDatetime: kst('2026-09-15T14:00:00'),
    minimumSalePrice: '720800000',
    failedBidCount: 2,
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
    // 커서를 움직이면 이 구간 변동이 영영 안 나간다.
    expect(repository.writeCursor).not.toHaveBeenCalled();
    expect(repository.findScheduleChanges).not.toHaveBeenCalled();
  });

  it('커서가 없으면 과거를 몰아 보내지 않고 지금부터 시작한다', async () => {
    const { dispatcher, repository, send } = buildDeps({
      repository: { readCursor: jest.fn().mockResolvedValue(null) },
    });

    await dispatcher.run();

    expect(repository.findScheduleChanges).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(repository.writeCursor).toHaveBeenCalledWith('schedule-change', DAYTIME);
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
        title: '서울특별시 서초구 서초동 1603-71',
        data: { courtOfficeCode: 'B000210', caseNo: '2025타경939', itemNo: '3' },
      }),
    );
    expect(repository.writeCursor).toHaveBeenCalledWith('schedule-change', DAYTIME);
  });

  it('첫 관측(직전 값 없음)은 알리지 않는다', async () => {
    const { dispatcher, send } = buildDeps({
      repository: {
        findScheduleChanges: jest.fn().mockResolvedValue([
          change({ prevBidDatetime: null, prevMinimumSalePrice: null, prevFailedBidCount: null }),
        ]),
      },
    });

    await dispatcher.run();

    expect(send).not.toHaveBeenCalled();
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

  it('일시 실패면 기록을 되돌려 다음 실행에서 다시 시도한다', async () => {
    const { dispatcher, repository } = buildDeps({
      repository: { findScheduleChanges: jest.fn().mockResolvedValue([change()]) },
      send: jest.fn().mockResolvedValue('failed'),
    });

    const summary = await dispatcher.run();

    expect(summary.failed).toBe(1);
    expect(repository.deleteDeviceToken).not.toHaveBeenCalled();
    expect(repository.releaseDelivery).toHaveBeenCalledWith('user-1', 'schedule:11');
  });

  it('D-3 리마인더를 보내고 dedupe 키에 D-n을 담는다', async () => {
    const { dispatcher, repository, send } = buildDeps({
      repository: {
        findReminderCandidates: jest.fn().mockResolvedValue([
          {
            auctionItemId: '7',
            courtOfficeCode: 'B000210',
            caseNo: '2025타경939',
            itemNo: '3',
            address: '서초동',
            bidDatetime: kst('2026-08-04T10:00:00'),
          },
        ]),
      },
    });

    const summary = await dispatcher.run();

    expect(summary.remindersFound).toBe(1);
    expect(send).toHaveBeenCalledWith('tok-1', expect.objectContaining({ title: '서초동' }));
    expect(repository.claimDelivery).toHaveBeenCalledWith(
      'user-1',
      expect.stringContaining('D-3'),
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
