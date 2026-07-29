import { buildBidReminderMessage, buildScheduleChangeMessage } from './message';

const kst = (iso: string): Date => new Date(`${iso}+09:00`);
const ADDRESS = '서울특별시 서초구 서초동 1603-71';

const observation = (
  bidDatetime: Date | null,
  minimumSalePrice: number | null,
  failedBidCount: number | null,
) => ({ bidDatetime, minimumSalePrice, failedBidCount });

describe('buildScheduleChangeMessage', () => {
  it('첫 관측이면 알릴 변동이 없다', () => {
    expect(
      buildScheduleChangeMessage({
        address: ADDRESS,
        previous: null,
        current: observation(kst('2026-08-01T10:00:00'), 720_800_000, 2),
      }),
    ).toBeNull();
  });

  it('바뀐 게 없으면 알리지 않는다', () => {
    const same = observation(kst('2026-08-01T10:00:00'), 720_800_000, 2);
    expect(
      buildScheduleChangeMessage({ address: ADDRESS, previous: same, current: { ...same } }),
    ).toBeNull();
  });

  it('유찰이면 횟수와 새 최저가를 사실대로 알린다', () => {
    const message = buildScheduleChangeMessage({
      address: ADDRESS,
      previous: observation(kst('2026-08-01T10:00:00'), 901_000_000, 1),
      current: observation(kst('2026-08-01T10:00:00'), 720_800_000, 2),
    });

    expect(message?.title).toBe(ADDRESS);
    expect(message?.body).toBe('2회 유찰돼 최저가가 7억 2,080만원이 됐어요.');
  });

  it('최저가만 바뀌면 최저가만 알린다', () => {
    const message = buildScheduleChangeMessage({
      address: ADDRESS,
      previous: observation(kst('2026-08-01T10:00:00'), 901_000_000, 1),
      current: observation(kst('2026-08-01T10:00:00'), 810_900_000, 1),
    });

    expect(message?.body).toBe('최저가가 8억 1,090만원으로 바뀌었어요.');
  });

  it('기일만 바뀌면 기일만 알린다', () => {
    const message = buildScheduleChangeMessage({
      address: ADDRESS,
      previous: observation(kst('2026-08-01T10:00:00'), 901_000_000, 1),
      current: observation(kst('2026-09-15T14:00:00'), 901_000_000, 1),
    });

    expect(message?.body).toContain('매각기일이');
    expect(message?.body).toContain('2026년 9월 15일');
    expect(message?.body).not.toContain('유찰');
  });

  it('여러 변동이 겹치면 알림 1건으로 합친다 (T-07)', () => {
    const message = buildScheduleChangeMessage({
      address: ADDRESS,
      previous: observation(kst('2026-08-01T10:00:00'), 901_000_000, 1),
      current: observation(kst('2026-09-15T14:00:00'), 720_800_000, 2),
    });

    expect(message?.body).toContain('2회 유찰돼');
    expect(message?.body).toContain('매각기일이');
  });

  it('주소가 없으면 제목을 기본값으로 둔다', () => {
    const message = buildScheduleChangeMessage({
      address: null,
      previous: observation(null, 901_000_000, 1),
      current: observation(null, 810_900_000, 1),
    });

    expect(message?.title).toBe('관심 물건');
  });

  it('판단·권유 문구를 넣지 않는다 (D-011)', () => {
    const message = buildScheduleChangeMessage({
      address: ADDRESS,
      previous: observation(kst('2026-08-01T10:00:00'), 901_000_000, 1),
      current: observation(kst('2026-09-15T14:00:00'), 720_800_000, 2),
    });
    const text = `${message?.title} ${message?.body}`;

    for (const banned of ['추천', '기회', '안전', '위험한 물건', '지금이', '유리']) {
      expect(text).not.toContain(banned);
    }
  });
});

describe('buildBidReminderMessage', () => {
  it('D-3에 보낸다', () => {
    const message = buildBidReminderMessage(
      ADDRESS,
      kst('2026-08-04T10:00:00'),
      kst('2026-08-01T09:00:00'),
    );

    expect(message?.body).toContain('매각기일이 3일 남았어요.');
    expect(message?.body).toContain('2026년 8월 4일');
  });

  it('D-1에는 내일이라고 알린다', () => {
    const message = buildBidReminderMessage(
      ADDRESS,
      kst('2026-08-02T10:00:00'),
      kst('2026-08-01T09:00:00'),
    );

    expect(message?.body).toContain('매각기일이 내일이에요.');
  });

  it('경계값: D-2·D-0·지난 기일에는 보내지 않는다', () => {
    const now = kst('2026-08-01T09:00:00');
    expect(buildBidReminderMessage(ADDRESS, kst('2026-08-03T10:00:00'), now)).toBeNull();
    expect(buildBidReminderMessage(ADDRESS, kst('2026-08-01T10:00:00'), now)).toBeNull();
    expect(buildBidReminderMessage(ADDRESS, kst('2026-07-30T10:00:00'), now)).toBeNull();
  });
});
