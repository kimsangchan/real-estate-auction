import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeMinimumBidRate,
  formatAreaM2,
  formatBidDatetime,
  formatDday,
  formatDropRate,
  formatPyeong,
  formatUnitPrice,
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

test('formatDday는 KST 달력 날짜 차이로 센다', () => {
  // 매각기일 8/3 10:00 KST = 8/3 01:00 UTC
  const bid = '2026-08-03T01:00:00.000Z';
  // 같은 날 오전 9시 KST — 24시간이 안 남았지만 D-day다
  assert.equal(formatDday(bid, new Date('2026-08-03T00:00:00.000Z')), 'D-day');
  assert.equal(formatDday(bid, new Date('2026-08-02T00:00:00.000Z')), 'D-1');
  assert.equal(formatDday(bid, new Date('2026-07-27T00:00:00.000Z')), 'D-7');
});

test('formatDday는 KST 자정 경계를 UTC로 착각하지 않는다', () => {
  const bid = '2026-08-03T01:00:00.000Z';
  // 8/2 23:30 KST = 8/2 14:30 UTC — 아직 D-1이어야 한다
  assert.equal(formatDday(bid, new Date('2026-08-02T14:30:00.000Z')), 'D-1');
  // 8/3 00:30 KST = 8/2 15:30 UTC — KST로는 이미 당일이라 D-day
  assert.equal(formatDday(bid, new Date('2026-08-02T15:30:00.000Z')), 'D-day');
});

test('formatDday는 기일이 지났거나 값이 없으면 null', () => {
  assert.equal(formatDday('2026-08-03T01:00:00.000Z', new Date('2026-08-04T00:00:00.000Z')), null);
  assert.equal(formatDday(null), null);
  assert.equal(formatDday('nope'), null);
});

test('formatBidDatetime은 UTC 시각을 한국 표준시로 변환한다', () => {
  const result = formatBidDatetime('2026-07-16T01:00:00.000Z');
  assert.match(result ?? '', /오전 10:00/);
});

test('formatBidDatetime은 null이면 null을 반환한다', () => {
  assert.equal(formatBidDatetime(null), null);
});

test('formatPyeong은 ㎡를 평으로 환산한다 (1평 = 400/121㎡)', () => {
  // 실측값: 28.21㎡ 다세대 → 8.5평
  assert.equal(formatPyeong(28.21), '8.5평');
  assert.equal(formatPyeong(84.99), '25.7평');
});

test('formatAreaM2는 소수점을 한 자리로 줄인다', () => {
  // 법원 값에 14.0075처럼 자릿수가 긴 게 온다
  assert.equal(formatAreaM2(14.0075), '14.0㎡');
  assert.equal(formatAreaM2(28.21), '28.2㎡');
});

test('면적이 없거나 0이면 평·㎡ 모두 null — 추정하지 않는다', () => {
  assert.equal(formatPyeong(null), null);
  assert.equal(formatPyeong(0), null);
  assert.equal(formatAreaM2(null), null);
  assert.equal(formatAreaM2(0), null);
});

test('formatUnitPrice는 평당·㎡당을 같은 값에서 뽑는다', () => {
  // 실측: 최저가 2.65억 / 28.21㎡ → 평당 3,129만 · ㎡당 946만
  assert.equal(formatUnitPrice(265_000_000, 28.21, 'pyeong'), '평당 3,105만');
  assert.equal(formatUnitPrice(265_000_000, 28.21, 'm2'), '㎡당 939만');
});

test('formatUnitPrice는 금액이나 면적이 없으면 null', () => {
  assert.equal(formatUnitPrice(null, 28.21, 'pyeong'), null);
  assert.equal(formatUnitPrice(265_000_000, null, 'pyeong'), null);
  assert.equal(formatUnitPrice(265_000_000, 0, 'm2'), null);
});
