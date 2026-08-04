import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assumedRightsLabel,
  riskFlagLabels,
  shortUsageName,
  tenantLabel,
} from './notice-labels';

test('assumedRightsLabel은 명세서 코드를 한국어 라벨로 바꾼다', () => {
  assert.equal(assumedRightsLabel('LEASEHOLD_REGISTRATION'), '주택임차권등기');
  assert.equal(assumedRightsLabel('NONE'), '인수할 권리 없음');
});

test('assumedRightsLabel은 명세서가 없으면 null — "인수할 권리 없음"과 다르다', () => {
  // 이 둘을 같게 표기하면 "확인 못 함"이 "위험 없음"으로 보인다
  assert.equal(assumedRightsLabel(null), null);
  assert.notEqual(assumedRightsLabel('NONE'), null);
});

test('assumedRightsLabel은 모르는 코드를 숨기지 않고 그대로 노출한다', () => {
  // 조용히 사라지면 새 코드가 생겼을 때 위험 신호를 놓친다
  assert.equal(assumedRightsLabel('NEW_KIND'), 'NEW_KIND');
});

test('riskFlagLabels는 코드 배열을 라벨 배열로 바꾼다', () => {
  assert.deepEqual(riskFlagLabels(['HUG_PRIORITY_WAIVER', 'LIEN_CLAIM']), [
    'HUG 대항력포기 확약',
    '유치권 신고',
  ]);
  assert.deepEqual(riskFlagLabels([]), []);
  assert.deepEqual(riskFlagLabels(['UNKNOWN_FLAG']), ['UNKNOWN_FLAG']);
});

test('shortUsageName은 법원이 콤마로 묶어 보낸 용도에서 대표값만 남긴다', () => {
  // 실측: 이 두 묶음이 각각 126건·127건으로 가장 많다
  assert.equal(shortUsageName('연립주택,다세대,빌라'), '연립주택');
  assert.equal(shortUsageName('상가,오피스텔,근린시설'), '상가');
  assert.equal(shortUsageName('다세대'), '다세대');
});

test('shortUsageName은 값이 없거나 비면 null', () => {
  assert.equal(shortUsageName(null), null);
  assert.equal(shortUsageName(''), null);
  assert.equal(shortUsageName('  '), null);
});

test('tenantLabel은 0명과 미확인을 구분한다', () => {
  // 0명 = 법원이 조사했는데 없더라 / null = 명세서를 못 받아 말할 수 없다
  assert.equal(tenantLabel(0), '점유자 없음');
  assert.equal(tenantLabel(2), '점유자 2명');
  assert.equal(tenantLabel(null), null);
});
