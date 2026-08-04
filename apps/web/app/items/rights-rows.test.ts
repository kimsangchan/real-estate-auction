import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRightsSummary } from './rights-rows';
import type { SampleRight, SampleTenant } from './sample-data';

const baseline: SampleRight = {
  id: 'r1',
  label: '가압류',
  receivedDate: '2022-10-18',
  status: 'EXTINGUISHED',
  isBaseline: true,
};

const assumedRight: SampleRight = {
  id: 'r2',
  label: '선순위 전세권',
  receivedDate: '2021-01-05',
  status: 'ASSUMED',
  isBaseline: false,
};

const tenant: SampleTenant = {
  id: 't1',
  label: '임차인 A',
  possessionRightDate: '2021-03-15',
  hasPriority: true,
  depositAmount: 50_000_000,
  assumedAmount: 0,
  status: 'EXTINGUISHED',
};

test('상태별로 정확히 한 그룹에만 들어간다', () => {
  const summary = buildRightsSummary([baseline, assumedRight], [tenant], [{ id: 'k1', label: '유치권 신고 기재' }]);

  assert.deepEqual(
    summary.assumed.map((row) => row.id),
    ['r2'],
  );
  assert.deepEqual(
    summary.needsReview.map((row) => row.id),
    ['k1'],
  );
  assert.deepEqual(
    summary.extinguished.map((row) => row.id),
    ['r1', 't1'],
  );
});

test('말소기준 표시는 해당 권리에만 남는다', () => {
  const summary = buildRightsSummary([baseline, assumedRight], [], []);
  assert.equal(summary.extinguished[0]?.isBaseline, true);
  assert.equal(summary.assumed[0]?.isBaseline, false);
});

test('등기부에 없는 신고 사항은 인수/말소로 단정하지 않는다', () => {
  const summary = buildRightsSummary([], [], [{ id: 'k1', label: '유치권 신고 기재' }]);
  assert.equal(summary.assumed.length, 0);
  assert.equal(summary.extinguished.length, 0);
  assert.equal(summary.needsReview[0]?.status, 'NEEDS_REVIEW');
});

test('임차인 행에 보증금과 인수 보증금이 함께 적힌다', () => {
  const summary = buildRightsSummary([], [tenant], []);
  const row = summary.extinguished[0];
  assert.ok(row?.label.includes('50,000,000원'));
  assert.ok(row?.detail.includes('인수 보증금 0원'));
});

test('빈 입력이면 세 그룹 모두 비어 있다', () => {
  const summary = buildRightsSummary([], [], []);
  assert.deepEqual(summary, { assumed: [], needsReview: [], extinguished: [] });
});
