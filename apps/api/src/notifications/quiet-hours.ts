// 발송 시각 계산 — 조용한 시간(21:00~08:00 KST)과 기일 임박 D-n 판정 (WP-09 §1-7, §1-2).
// KST는 서머타임이 없어 UTC+9 고정 오프셋으로 계산해도 안전하다. DB 세션 타임존이 UTC라
// UTC 기준으로 날짜를 세면 하루가 밀린다 — 날짜 경계는 반드시 이 모듈을 거칠 것 (§3-4).
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const QUIET_START_HOUR = 21;
const QUIET_END_HOUR = 8;

/** 조용한 시간에 걸리면 다음 08:00(KST)으로, 아니면 지금 그대로 */
export function nextSendableAt(now: Date): Date {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const hour = kst.getUTCHours();

  if (hour < QUIET_END_HOUR || hour >= QUIET_START_HOUR) {
    const target = new Date(kst);
    if (hour >= QUIET_START_HOUR) {
      target.setUTCDate(target.getUTCDate() + 1);
    }
    target.setUTCHours(QUIET_END_HOUR, 0, 0, 0);
    return new Date(target.getTime() - KST_OFFSET_MS);
  }

  return now;
}

export function isQuietHour(now: Date): boolean {
  return nextSendableAt(now).getTime() !== now.getTime();
}

/** KST 달력 기준으로 남은 날수 — 같은 날이면 0, 내일이면 1 */
export function kstDaysUntil(target: Date, now: Date): number {
  const toKstDay = (instant: Date): number =>
    Math.floor((instant.getTime() + KST_OFFSET_MS) / MS_PER_DAY);
  return toKstDay(target) - toKstDay(now);
}
