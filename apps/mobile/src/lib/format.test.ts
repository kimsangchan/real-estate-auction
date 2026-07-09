// 포맷터 단위 테스트 — 매각기일 KST 표기와 금액 축약이 기기/타임존과 무관하게 결정적임을 보장한다.
import {
  computeMinimumBidRate,
  formatBidDatetime,
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
