// 알림 발송 오케스트레이션 — 변동 감지 결과를 문구로 바꾸고, 멱등 기록을 선점한 뒤 보낸다 (WP-09 §1).
// API 프로세스가 아니라 cron이 부르는 CLI에서 쓴다 — 인스턴스가 늘어도 중복 발송이 생기지 않게 (§1-3).
import type { FcmClient, PushMessage } from './fcm.client';
import { buildBidReminderMessage, buildScheduleChangeMessage } from './message';
import type {
  NotificationsRepository,
  ReminderCandidateRow,
  ScheduleChangeRow,
} from './notifications.repository';
import { isQuietHour, kstDaysUntil } from './quiet-hours';

const CHANGE_CURSOR = 'schedule-change';
const REMINDER_WINDOW_DAYS = 4;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface RunSummary {
  skippedQuietHours: boolean;
  changesFound: number;
  remindersFound: number;
  sent: number;
  deduped: number;
  failed: number;
  staleTokensRemoved: number;
}

const emptySummary = (): RunSummary => ({
  skippedQuietHours: false,
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

    await this.processScheduleChanges(now, summary);
    await this.processReminders(now, summary);
    return summary;
  }

  private async processScheduleChanges(now: Date, summary: RunSummary): Promise<void> {
    // 커서가 없으면 첫 실행 — 과거 이력을 몰아서 보내면 안 되니 지금부터 시작한다.
    const since = await this.repository.readCursor(CHANGE_CURSOR);
    if (!since) {
      await this.repository.writeCursor(CHANGE_CURSOR, now);
      return;
    }

    const changes = await this.repository.findScheduleChanges(since, now);
    summary.changesFound = changes.length;

    for (const change of changes) {
      const message = this.toChangeMessage(change);
      if (message) {
        await this.deliver(change, `schedule:${change.scheduleId}`, 'schedule-change', message, summary);
      }
    }

    await this.repository.writeCursor(CHANGE_CURSOR, now);
  }

  private toChangeMessage(change: ScheduleChangeRow): PushMessage | null {
    const hasPrevious =
      change.prevBidDatetime !== null ||
      change.prevMinimumSalePrice !== null ||
      change.prevFailedBidCount !== null;

    const built = buildScheduleChangeMessage({
      address: change.address,
      previous: hasPrevious
        ? {
            bidDatetime: change.prevBidDatetime,
            minimumSalePrice: toNumber(change.prevMinimumSalePrice),
            failedBidCount: change.prevFailedBidCount,
          }
        : null,
      current: {
        bidDatetime: change.bidDatetime,
        minimumSalePrice: toNumber(change.minimumSalePrice),
        failedBidCount: change.failedBidCount,
      },
    });

    return built ? { ...built, data: itemRoute(change) } : null;
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
      const bidDate = candidate.bidDatetime.toISOString().slice(0, 10);
      await this.deliver(
        candidate,
        `remind:${candidate.auctionItemId}:${bidDate}:D-${daysLeft}`,
        'bid-reminder',
        { ...built, data: itemRoute(candidate) },
        summary,
      );
    }
  }

  private async deliver(
    target: DeliveryTarget,
    dedupeKey: string,
    kind: string,
    message: PushMessage,
    summary: RunSummary,
  ): Promise<void> {
    const devices = await this.repository.findTokensForFavorite(
      target.courtOfficeCode,
      target.caseNo,
      target.itemNo,
    );

    for (const device of devices) {
      // 기록을 먼저 선점한다 — 발송 도중 죽어도 같은 알림이 두 번 나가지 않는다 (규칙 10).
      const claimed = await this.repository.claimDelivery(
        device.userId,
        dedupeKey,
        target.auctionItemId,
        kind,
      );
      if (!claimed) {
        summary.deduped += 1;
        continue;
      }

      const result = await this.fcm.send(device.token, message);
      if (result === 'sent') {
        summary.sent += 1;
        continue;
      }

      if (result === 'unregistered') {
        // 앱이 지워진 기기 — 토큰을 지운다. 같은 사용자의 다른 기기로는 그대로 나간다.
        await this.repository.deleteDeviceToken(device.token);
        summary.staleTokensRemoved += 1;
      } else {
        summary.failed += 1;
      }
      // 못 보냈으면 기록을 되돌려 다음 실행에서 다시 시도한다.
      await this.repository.releaseDelivery(device.userId, dedupeKey);
    }
  }
}
