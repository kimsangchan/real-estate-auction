import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeMinimumBidRate,
  formatBidDatetime,
  formatDropRate,
  formatWon,
  formatWonCompact,
} from './format';

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

test('formatDropRate는 감정가 대비 하락률을 라벨로 만든다', () => {
  // 실측 분포: 유찰 3회 물건의 평균 최저가율이 64% → ↓36%
  assert.equal(formatDropRate(1000, 640), '↓36%');
  assert.equal(formatDropRate(1000, 512), '↓49%');
});

test('formatDropRate는 하락이 없으면 null이다 — 신건에 뱃지를 붙이지 않는다', () => {
  assert.equal(formatDropRate(1000, 1000), null);
  // 재감정 등으로 최저가가 감정가를 넘는 경우도 붙일 게 없다
  assert.equal(formatDropRate(1000, 1200), null);
});

test('formatDropRate는 감정가나 최저가가 없으면 null이다', () => {
  assert.equal(formatDropRate(null, 640), null);
  assert.equal(formatDropRate(1000, null), null);
  assert.equal(formatDropRate(0, 640), null);
});

test('formatBidDatetime은 UTC 시각을 한국 표준시로 변환한다', () => {
  const result = formatBidDatetime('2026-07-16T01:00:00.000Z');
  assert.match(result ?? '', /오전 10:00/);
});

test('formatBidDatetime은 null이면 null을 반환한다', () => {
  assert.equal(formatBidDatetime(null), null);
});
