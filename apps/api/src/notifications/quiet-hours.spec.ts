import { isQuietHour, kstDaysUntil, nextSendableAt } from './quiet-hours';

/** KST 시각을 UTC 인스턴트로 (KST = UTC+9, 서머타임 없음) */
const kst = (iso: string): Date => new Date(`${iso}+09:00`);

describe('nextSendableAt', () => {
  it('낮 시간이면 지금 그대로 보낸다', () => {
    const now = kst('2026-08-01T14:30:00');
    expect(nextSendableAt(now).getTime()).toBe(now.getTime());
    expect(isQuietHour(now)).toBe(false);
  });

  it('밤 21시 이후면 다음 날 08시로 미룬다', () => {
    expect(nextSendableAt(kst('2026-08-01T21:00:00')).toISOString()).toBe(
      kst('2026-08-02T08:00:00').toISOString(),
    );
    expect(nextSendableAt(kst('2026-08-01T23:59:00')).toISOString()).toBe(
      kst('2026-08-02T08:00:00').toISOString(),
    );
  });

  it('새벽이면 같은 날 08시로 미룬다', () => {
    expect(nextSendableAt(kst('2026-08-02T00:10:00')).toISOString()).toBe(
      kst('2026-08-02T08:00:00').toISOString(),
    );
    expect(nextSendableAt(kst('2026-08-02T07:59:00')).toISOString()).toBe(
      kst('2026-08-02T08:00:00').toISOString(),
    );
  });

  it('경계값: 08:00은 보낼 수 있고 20:59도 보낼 수 있다', () => {
    const eight = kst('2026-08-02T08:00:00');
    expect(nextSendableAt(eight).getTime()).toBe(eight.getTime());
    const late = kst('2026-08-02T20:59:59');
    expect(nextSendableAt(late).getTime()).toBe(late.getTime());
  });

  it('월말 밤이면 다음 달 1일 08시로 넘어간다', () => {
    expect(nextSendableAt(kst('2026-08-31T22:00:00')).toISOString()).toBe(
      kst('2026-09-01T08:00:00').toISOString(),
    );
  });
});

describe('kstDaysUntil', () => {
  it('같은 KST 날짜면 0, 내일이면 1이다', () => {
    expect(kstDaysUntil(kst('2026-08-01T10:00:00'), kst('2026-08-01T23:00:00'))).toBe(0);
    expect(kstDaysUntil(kst('2026-08-02T10:00:00'), kst('2026-08-01T09:00:00'))).toBe(1);
    expect(kstDaysUntil(kst('2026-08-04T10:00:00'), kst('2026-08-01T09:00:00'))).toBe(3);
  });

  it('UTC로 세면 하루가 밀리는 시각도 KST 달력으로 센다 (§3-4 회귀 방지)', () => {
    // KST 2026-08-02 01:00 = UTC 2026-08-01 16:00. UTC 기준이면 같은 날로 보여 D-1을 놓친다.
    const now = kst('2026-08-02T01:00:00');
    const bid = kst('2026-08-03T10:00:00');
    expect(kstDaysUntil(bid, now)).toBe(1);
  });

  it('이미 지난 기일은 음수다', () => {
    expect(kstDaysUntil(kst('2026-07-30T10:00:00'), kst('2026-08-01T09:00:00'))).toBe(-2);
  });
});
