import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeMinimumBidRate, formatBidDatetime, formatWon, formatWonCompact } from './format';

test('formatWon은 천단위 콤마와 원 단위를 붙인다', () => {
  assert.equal(formatWon(1234567), '1,234,567원');
});

test('formatWonCompact는 억/만 단위로 축약한다', () => {
  assert.equal(formatWonCompact(123_000_000), '1억 2,300만');
  assert.equal(formatWonCompact(100_000_000), '1억');
  assert.equal(formatWonCompact(50_000), '5만');
  assert.equal(formatWonCompact(9_000), '9,000원');
});

test('computeMinimumBidRate는 최저가/감정가 비율을 반올림한다', () => {
  assert.equal(computeMinimumBidRate(259_000_000, 84_869_000), 33);
});

test('computeMinimumBidRate는 감정가·최저가가 없거나 0이면 null이다', () => {
  assert.equal(computeMinimumBidRate(null, 100), null);
  assert.equal(computeMinimumBidRate(100, null), null);
  assert.equal(computeMinimumBidRate(0, 100), null);
});

test('formatBidDatetime은 UTC 시각을 한국 표준시로 변환한다', () => {
  const result = formatBidDatetime('2026-07-16T01:00:00.000Z');
  assert.match(result ?? '', /오전 10:00/);
});

test('formatBidDatetime은 null이면 null을 반환한다', () => {
  assert.equal(formatBidDatetime(null), null);
});
