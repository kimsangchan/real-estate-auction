// 포맷터 단위 테스트 — 매각기일 KST 표기와 금액 축약이 기기/타임존과 무관하게 결정적임을 보장한다.
import {
  computeMinimumBidRate,
  formatAreaM2,
  formatAreaWithKind,
  formatBidDatetime,
  formatDday,
  formatDropRate,
  formatPyeong,
  formatUnitPrice,
  formatUnitPriceWithKind,
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

describe('면적·단위가격', () => {
  it('㎡를 평으로 환산한다 (1평 = 400/121㎡)', () => {
    expect(formatPyeong(28.21)).toBe('8.5평');
    expect(formatPyeong(84.99)).toBe('25.7평');
  });

  it('㎡ 표기는 소수점 한 자리', () => {
    expect(formatAreaM2(14.0075)).toBe('14.0㎡');
  });

  it('평당·㎡당을 같은 값에서 뽑는다 (웹과 동일 규칙)', () => {
    expect(formatUnitPrice(265_000_000, 28.21, 'pyeong')).toBe('평당 3,105만');
    expect(formatUnitPrice(265_000_000, 28.21, 'm2')).toBe('㎡당 939만');
  });

  it('면적이나 금액이 없으면 null — 추정하지 않는다', () => {
    expect(formatPyeong(null)).toBeNull();
    expect(formatAreaM2(0)).toBeNull();
    expect(formatUnitPrice(null, 28.21, 'pyeong')).toBeNull();
    expect(formatUnitPrice(265_000_000, null, 'm2')).toBeNull();
  });
});

describe('면적 종류 라벨', () => {
  it('종류를 앞에 붙인다', () => {
    expect(formatAreaWithKind(28.21, 'AGGREGATE')).toBe('전용 8.5평 (28.2㎡)');
    expect(formatAreaWithKind(2193, 'LAND')).toBe('토지 663.4평 (2193.0㎡)');
    expect(formatAreaWithKind(231.66, 'BUILDING')).toBe('연면적 70.1평 (231.7㎡)');
  });

  it('종류를 모르면 면적만', () => {
    expect(formatAreaWithKind(28.21, null)).toBe('8.5평 (28.2㎡)');
    expect(formatAreaWithKind(null, 'LAND')).toBeNull();
  });

  it('단가 라벨에도 분모를 드러낸다', () => {
    expect(formatUnitPriceWithKind(265_000_000, 28.21, 'AGGREGATE', 'pyeong')).toBe('전용 평당 3,105만');
    expect(formatUnitPriceWithKind(265_000_000, 2193, 'LAND', 'pyeong')).toBe('토지 평당 40만');
  });
});

describe('일괄매각 단가', () => {
  it('일괄매각이면 단가를 내지 않는다', () => {
    expect(formatUnitPriceWithKind(34_076_000_000, 34.32, 'AGGREGATE', 'pyeong', true)).toBeNull();
    expect(formatUnitPriceWithKind(34_076_000_000, 34.32, 'AGGREGATE', 'pyeong', false)).not.toBeNull();
  });
});
