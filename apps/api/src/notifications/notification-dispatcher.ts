// 알림 발송 오케스트레이션 — 변동 감지 결과를 문구로 바꾸고, 멱등 기록을 선점한 뒤 보낸다 (WP-09 §1).
// API 프로세스가 아니라 cron이 부르는 CLI에서 쓴다 — 인스턴스가 늘어도 중복 발송이 생기지 않게 (§1-3).
import { FcmUnavailableError, type FcmClient, type PushMessage } from './fcm.client';
import { buildBidReminderMessage, buildScheduleChangeMessage } from './message';
import type {
  DeviceTokenRecord,
  NotificationsRepository,
  ReminderCandidateRow,
  ScheduleChangeRow,
} from './notifications.repository';
import { isQuietHour, kstDateString, kstDaysUntil } from './quiet-hours';

const CHANGE_CURSOR = 'schedule-change';
const REMINDER_WINDOW_DAYS = 4;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// 한 번에 처리할 변동 수 — 장기 중단 뒤 밀린 이력을 한꺼번에 쏟아내지 않게 (T-07)
const CHANGE_BATCH_LIMIT = 500;
// 수집기 트랜잭션이 커밋될 여유. observed_at은 트랜잭션 "시작" 시각이라 이만큼 뒤를 읽어야
// 커밋이 늦은 배치를 건너뛰지 않는다. 수집기 한 배치가 이보다 오래 걸리면 늘려야 한다.
const WATERMARK_LAG_SECONDS = 300;

export interface RunSummary {
  skippedQuietHours: boolean;
  abortedUnavailable: boolean;
  changesFound: number;
  remindersFound: number;
  sent: number;
  deduped: number;
  failed: number;
  staleTokensRemoved: number;
}

const emptySummary = (): RunSummary => ({
  skippedQuietHours: false,
  abortedUnavailable: false,
  changesFound: 0,
  remindersFound: 0,
  sent: 0,
  deduped: 0,
  failed: 0,
  staleTokensRemoved: 0,
});

const toNumber = (value: string | null): number | null => (value === null ? null : Number(value));

type DeliveryTarget = Pick<
  ScheduleChangeRow,
  'auctionItemId' | 'courtOfficeCode' | 'caseNo' | 'itemNo'
>;

/** 알림을 탭했을 때 물건 상세로 보내기 위한 페이로드 (FCM data는 문자열만 담는다) */
function itemRoute(target: DeliveryTarget): Record<string, string> {
  return {
    courtOfficeCode: target.courtOfficeCode,
    caseNo: target.caseNo,
    itemNo: target.itemNo,
  };
}

/** 한 물건에 이번 구간의 관측이 여러 건이면 하나로 접는다 — 물건당 알림 1건 (T-07) */
function groupByItem(changes: ScheduleChangeRow[]): ScheduleChangeRow[][] {
  const groups = new Map<string, ScheduleChangeRow[]>();
  for (const change of changes) {
    const group = groups.get(change.auctionItemId);
    if (group) group.push(change);
    else groups.set(change.auctionItemId, [change]);
  }
  return [...groups.values()];
}

export class NotificationDispatcher {
  constructor(
    private readonly repository: NotificationsRepository,
    private readonly fcm: FcmClient,
    private readonly now: () => number = Date.now,
  ) {}

  async run(): Promise<RunSummary> {
    const summary = emptySummary();
    const now = new Date(this.now());

    if (isQuietHour(now)) {
      // 커서를 움직이지 않는다 — 다음 실행에서 이 구간 변동을 그대로 다시 집는다.
      return { ...summary, skippedQuietHours: true };
    }

    try {
      await this.processScheduleChanges(summary);
      await this.processReminders(now, summary);
    } catch (cause) {
      if (!(cause instanceof FcmUnavailableError)) throw cause;
      // 액세스 토큰을 못 받으면 이번 실행은 아무 것도 못 보낸다 — 커서를 두고 다음 실행에 맡긴다.
      summary.abortedUnavailable = true;
    }
    return summary;
  }

  private async processScheduleChanges(summary: RunSummary): Promise<void> {
    const watermark = await this.repository.readSafeWatermark(WATERMARK_LAG_SECONDS);

    // 커서가 없으면 첫 실행 — 과거 이력을 몰아서 보내면 안 되니 지금부터 시작한다.
    const since = await this.repository.readCursor(CHANGE_CURSOR);
    if (!since) {
      await this.repository.writeCursor(CHANGE_CURSOR, watermark);
      return;
    }
    if (watermark <= since) return;

    const changes = await this.repository.findScheduleChanges(since, watermark, CHANGE_BATCH_LIMIT);
    summary.changesFound = changes.length;

    // 실패가 하나라도 있으면 그 지점 이후로는 커서를 올리지 않는다 — 올리면 그 구간 변동이
    // 영구히 사라진다(재조회 창이 커서로 잘리므로 "다음에 재시도"가 성립하지 않는다).
    let checkpoint: Date | null = changes.length < CHANGE_BATCH_LIMIT ? watermark : null;
    let blocked = false;

    for (const group of groupByItem(changes)) {
      const latest = group[group.length - 1] as ScheduleChangeRow;
      const message = this.toChangeMessage(group);

      const delivered = message
        ? await this.deliver(latest, `schedule:${latest.scheduleId}`, 'schedule-change', message, summary)
        : true;

      if (!delivered) blocked = true;
      if (!blocked) checkpoint = latest.observedAt;
    }

    if (checkpoint && !blocked) {
      await this.repository.writeCursor(CHANGE_CURSOR, checkpoint);
    } else if (!blocked && changes.length > 0) {
      await this.repository.writeCursor(CHANGE_CURSOR, watermark);
    }
  }

  /** 구간 안 여러 관측을 접어 하나의 변동으로 만든다: 구간 이전 상태 → 구간 마지막 상태 */
  private toChangeMessage(group: ScheduleChangeRow[]): PushMessage | null {
    const first = group[0] as ScheduleChangeRow;
    const latest = group[group.length - 1] as ScheduleChangeRow;

    const built = buildScheduleChangeMessage({
      address: latest.address,
      previous: first.hasPrevious
        ? {
            bidDatetime: first.prevBidDatetime,
            minimumSalePrice: toNumber(first.prevMinimumSalePrice),
            failedBidCount: first.prevFailedBidCount,
          }
        : null,
      current: {
        bidDatetime: latest.bidDatetime,
        minimumSalePrice: toNumber(latest.minimumSalePrice),
        failedBidCount: latest.failedBidCount,
      },
    });

    return built ? { ...built, data: itemRoute(latest) } : null;
  }

  private async processReminders(now: Date, summary: RunSummary): Promise<void> {
    const candidates: ReminderCandidateRow[] = await this.repository.findReminderCandidates(
      now,
      new Date(now.getTime() + REMINDER_WINDOW_DAYS * MS_PER_DAY),
    );

    for (const candidate of candidates) {
      const built = buildBidReminderMessage(candidate.address, candidate.bidDatetime, now);
      if (!built) continue;

      summary.remindersFound += 1;
      const daysLeft = kstDaysUntil(candidate.bidDatetime, now);
      // 날짜도 KST로 적는다 — UTC 날짜를 쓰면 D-n 판정과 어긋나 중복·누락이 생긴다 (§3-4)
      const bidDate = kstDateString(candidate.bidDatetime);
      await this.deliver(
        candidate,
        `remind:${candidate.auctionItemId}:${bidDate}:D-${daysLeft}`,
        'bid-reminder',
        { ...built, data: itemRoute(candidate) },
        summary,
      );
    }
  }

  /** @returns 이 알림이 모두 처리됐는지(false면 재시도가 필요해 커서를 올리면 안 된다) */
  private async deliver(
    target: DeliveryTarget,
    dedupeKey: string,
    kind: string,
    message: PushMessage,
    summary: RunSummary,
  ): Promise<boolean> {
    const devices = await this.repository.findTokensForFavorite(
      target.courtOfficeCode,
      target.caseNo,
      target.itemNo,
    );

    let allDelivered = true;
    // 멱등 기록은 사용자 단위다 — 기기별로 선점하면 두 번째 기기가 "중복"으로 걸러져
    // 다중 기기 사용자는 한 대에서만 알림을 받게 된다.
    for (const [userId, userDevices] of groupByUser(devices)) {
      const claimed = await this.repository.claimDelivery(
        userId,
        dedupeKey,
        target.auctionItemId,
        kind,
      );
      if (!claimed) {
        summary.deduped += 1;
        continue;
      }

      let anySent = false;
      try {
        for (const device of userDevices) {
          const result = await this.fcm.send(device.token, message);
          if (result === 'sent') {
            anySent = true;
          } else if (result === 'unregistered') {
            // FCM이 404로 죽었다고 확인해 준 토큰만 지운다.
            await this.repository.deleteDeviceToken(device.token);
            summary.staleTokensRemoved += 1;
          } else {
            allDelivered = false;
          }
        }
      } finally {
        // 한 대도 못 보냈으면 기록을 되돌려 다음 실행에서 다시 시도한다.
        // (예외로 빠져나가는 경우에도 반드시 되돌린다 — 안 그러면 영구 미발송으로 남는다)
        if (!anySent) {
          await this.repository.releaseDelivery(userId, dedupeKey);
        }
      }

      if (anySent) summary.sent += 1;
      else {
        summary.failed += 1;
        allDelivered = false;
      }
    }

    return allDelivered;
  }
}

function groupByUser(devices: DeviceTokenRecord[]): Map<string, DeviceTokenRecord[]> {
  const byUser = new Map<string, DeviceTokenRecord[]>();
  for (const device of devices) {
    const list = byUser.get(device.userId);
    if (list) list.push(device);
    else byUser.set(device.userId, [device]);
  }
  return byUser;
}
