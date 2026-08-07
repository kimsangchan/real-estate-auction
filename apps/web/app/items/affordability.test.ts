import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatRatioRange,
  formatWonRangeCompact,
  summaryScenario,
  type Affordability,
  type AffordabilityScenario,
} from './affordability';

function scenario(kind: AffordabilityScenario['kind']): AffordabilityScenario {
  return {
    kind,
    bidPrice: 100_000_000,
    totalBurden: 100_000_000,
    totalWithExtras: { min: 105_000_000, max: 115_000_000 },
    appraisalRatio: { min: 52.5, max: 57.5 },
    extras: [],
    unknownItems: ['UNPAID_MAINTENANCE_FEE'],
  };
}

function affordability(scenarios: AffordabilityScenario[]): Affordability {
  return {
    appraisalAmount: 200_000_000,
    minimumSalePrice: 100_000_000,
    bulkSale: false,
    usageName: '다세대',
    assumedTotal: 0,
    assumedIsLowerBound: false,
    comparableSales: { usage: '다세대', sampleCount: 10, rateP25: 60, rateMedian: 70, rateP75: 80 },
    scenarios,
    referencePrice: 'APPRAISAL',
    source: 'NOTICE_ONLY',
  };
}

test('summaryScenario는 유사 중위를 우선하고 없으면 최저가를 쓴다', () => {
  const withMedian = affordability([scenario('MINIMUM_PRICE'), scenario('COMPARABLE_MEDIAN')]);
  assert.equal(summaryScenario(withMedian)?.kind, 'COMPARABLE_MEDIAN');

  const minimumOnly = affordability([scenario('MINIMUM_PRICE')]);
  assert.equal(summaryScenario(minimumOnly)?.kind, 'MINIMUM_PRICE');

  assert.equal(summaryScenario(affordability([])), null);
});

test('formatWonRangeCompact — 구간을 압축 표기하고 양끝이 같으면 하나로 줄인다', () => {
  assert.equal(
    formatWonRangeCompact({ min: 220_000_000, max: 240_000_000 }),
    '2억 2,000만~2억 4,000만',
  );
  assert.equal(formatWonRangeCompact({ min: 100_000_000, max: 100_000_000 }), '1억');
});

test('formatRatioRange — 정수 반올림, 양끝이 같으면 하나로 줄인다', () => {
  assert.equal(formatRatioRange({ min: 63.6, max: 71.2 }), '64~71%');
  assert.equal(formatRatioRange({ min: 46.9, max: 47.2 }), '47%');
});
