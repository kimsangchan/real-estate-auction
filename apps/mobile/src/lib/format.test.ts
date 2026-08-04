// 포맷터 단위 테스트 — 매각기일 KST 표기와 금액 축약이 기기/타임존과 무관하게 결정적임을 보장한다.
import {
  computeMinimumBidRate,
  formatBidDatetime,
  formatDday,
  formatDropRate,
  formatWon,
  formatWonCompact,
} from './format';

describe('formatWon', () => {
  it('천 단위 콤마 + 원 단위', () => {
    expect(formatWon(123456789)).toBe('123,456,789원');
    expect(formatWon(0)).toBe('0원');
  });
});

describe('formatWonCompact', () => {
  it('억/만 단위로 축약한다', () => {
    expect(formatWonCompact(123000000)).toBe('1억 2,300만');
    expect(formatWonCompact(100000000)).toBe('1억');
    expect(formatWonCompact(50000)).toBe('5만');
    expect(formatWonCompact(9000)).toBe('9,000원');
  });
});

describe('computeMinimumBidRate', () => {
  it('감정가 대비 최저가율(%)을 반올림한다', () => {
    expect(computeMinimumBidRate(100000000, 64000000)).toBe(64);
  });

  it('감정가가 0이거나 값이 없으면 null', () => {
    expect(computeMinimumBidRate(null, 100)).toBeNull();
    expect(computeMinimumBidRate(0, 100)).toBeNull();
    expect(computeMinimumBidRate(100, null)).toBeNull();
  });
});

describe('formatBidDatetime', () => {
  it('UTC/오프셋 표기와 무관하게 KST 벽시계로 표기한다', () => {
    // 2026-07-16T01:00:00Z === 2026-07-16 10:00 KST
    expect(formatBidDatetime('2026-07-16T01:00:00.000Z')).toBe(
      '2026. 07. 16. 10:00',
    );
    expect(formatBidDatetime('2026-07-16T10:00:00+09:00')).toBe(
      '2026. 07. 16. 10:00',
    );
  });

  it('null/파싱 불가 입력은 null', () => {
    expect(formatBidDatetime(null)).toBeNull();
    expect(formatBidDatetime('nope')).toBeNull();
  });
});

describe('formatDropRate', () => {
  it('감정가 대비 하락률을 라벨로 만든다', () => {
    // 실측 분포: 유찰 3회 물건의 평균 최저가율이 64% → ↓36%
    expect(formatDropRate(1000, 640)).toBe('↓36%');
    expect(formatDropRate(1000, 512)).toBe('↓49%');
  });

  it('하락이 없으면 null — 신건에 서브캡션을 붙이지 않는다', () => {
    expect(formatDropRate(1000, 1000)).toBeNull();
    expect(formatDropRate(1000, 1200)).toBeNull();
  });

  it('감정가나 최저가가 없으면 null', () => {
    expect(formatDropRate(null, 640)).toBeNull();
    expect(formatDropRate(1000, null)).toBeNull();
    expect(formatDropRate(0, 640)).toBeNull();
  });
});

describe('formatDday', () => {
  // 매각기일 8/3 10:00 KST = 8/3 01:00 UTC
  const bid = '2026-08-03T01:00:00.000Z';

  it('KST 달력 날짜 차이로 센다', () => {
    expect(formatDday(bid, new Date('2026-08-03T00:00:00.000Z'))).toBe('D-day');
    expect(formatDday(bid, new Date('2026-08-02T00:00:00.000Z'))).toBe('D-1');
    expect(formatDday(bid, new Date('2026-07-27T00:00:00.000Z'))).toBe('D-7');
  });

  it('KST 자정 경계를 UTC로 착각하지 않는다', () => {
    // 8/2 23:30 KST = 8/2 14:30 UTC — 아직 D-1
    expect(formatDday(bid, new Date('2026-08-02T14:30:00.000Z'))).toBe('D-1');
    // 8/3 00:30 KST = 8/2 15:30 UTC — KST로는 당일이라 D-day
    expect(formatDday(bid, new Date('2026-08-02T15:30:00.000Z'))).toBe('D-day');
  });

  it('기일이 지났거나 값이 없으면 null', () => {
    expect(formatDday(bid, new Date('2026-08-04T00:00:00.000Z'))).toBeNull();
    expect(formatDday(null)).toBeNull();
    expect(formatDday('nope')).toBeNull();
  });
});
