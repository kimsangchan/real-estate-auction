// 알림 문구 조립 — 사실 서술만 쓴다. 판단·권유·추천 표현 금지 (D-011, 변호사법 §109).
// 금액 축약은 apps/web/app/items/format.ts의 formatWonCompact와 같은 규칙을 따른다(화면과 문구 일치).
import { kstDaysUntil } from './quiet-hours';

export interface ScheduleObservation {
  bidDatetime: Date | null;
  minimumSalePrice: number | null;
  failedBidCount: number | null;
}

export interface ScheduleChange {
  address: string | null;
  /** 직전 관측 — 없으면 이 물건의 첫 관측이라 알릴 변동이 없다 */
  previous: ScheduleObservation | null;
  current: ScheduleObservation;
}

export interface NotificationMessage {
  title: string;
  body: string;
}

function formatWonCompact(amount: number): string {
  const value = Math.round(amount);
  const eok = Math.floor(value / 100_000_000);
  const man = Math.floor((value % 100_000_000) / 10_000);
  if (eok > 0) return man > 0 ? `${eok}억 ${man.toLocaleString('ko-KR')}만원` : `${eok}억원`;
  if (man > 0) return `${man.toLocaleString('ko-KR')}만원`;
  return `${value.toLocaleString('ko-KR')}원`;
}

function formatBidDatetime(value: Date): string {
  return value.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function titleOf(address: string | null): string {
  return address ?? '관심 물건';
}

/**
 * 한 물건에 여러 변동이 겹치면 문장을 이어 붙여 알림 1건으로 만든다 (T-07 — 과다 발송 금지).
 * 알릴 변동이 없으면 null.
 */
export function buildScheduleChangeMessage(change: ScheduleChange): NotificationMessage | null {
  const { previous, current } = change;
  if (!previous) return null;

  const sentences: string[] = [];

  const failedBefore = previous.failedBidCount ?? 0;
  const failedNow = current.failedBidCount ?? 0;
  const priceChanged =
    current.minimumSalePrice !== null && current.minimumSalePrice !== previous.minimumSalePrice;

  if (failedNow > failedBefore) {
    sentences.push(
      priceChanged && current.minimumSalePrice !== null
        ? `${failedNow}회 유찰돼 최저가가 ${formatWonCompact(current.minimumSalePrice)}이 됐어요.`
        : `${failedNow}회 유찰됐어요.`,
    );
  } else if (priceChanged && current.minimumSalePrice !== null) {
    sentences.push(`최저가가 ${formatWonCompact(current.minimumSalePrice)}으로 바뀌었어요.`);
  }

  const bidChanged =
    (current.bidDatetime?.getTime() ?? null) !== (previous.bidDatetime?.getTime() ?? null);
  if (bidChanged && current.bidDatetime) {
    sentences.push(`매각기일이 ${formatBidDatetime(current.bidDatetime)}로 바뀌었어요.`);
  }

  if (sentences.length === 0) return null;
  return { title: titleOf(change.address), body: sentences.join(' ') };
}

/** 매각기일 임박 리마인더 — D-3, D-1에만 보낸다 (WP-09 §1-2) */
export function buildBidReminderMessage(
  address: string | null,
  bidDatetime: Date,
  now: Date,
): NotificationMessage | null {
  const daysLeft = kstDaysUntil(bidDatetime, now);
  if (daysLeft !== 3 && daysLeft !== 1) return null;

  const when = formatBidDatetime(bidDatetime);
  const lead = daysLeft === 1 ? '매각기일이 내일이에요.' : '매각기일이 3일 남았어요.';
  return { title: titleOf(address), body: `${lead} ${when}에 진행돼요.` };
}
