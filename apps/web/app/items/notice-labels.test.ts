import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  ASSUMED_RIGHTS_LABEL,
  RISK_FLAG_LABEL,
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

// 같은 라벨 맵을 apps/mobile에도 두고 있다(RN에 @auction/shared를 붙이면 Metro 해석 문제를
// 다시 겪어서 format.ts 선례를 따랐다). 한쪽만 고치면 다른 쪽 사용자에게 코드 원문이 노출되므로
// 여기서 두 파일을 직접 비교해 어긋남을 막는다. RN tsconfig에는 Node 타입이 없어 웹에 둔다.
function parseLabels(source: string, mapName: string): Record<string, string> {
  const body = source.split(`export const ${mapName}: Record<string, string> = {`)[1]?.split('};')[0];
  if (body === undefined) throw new Error(`${mapName}을 찾지 못했다`);
  const out: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const match = /^\s*([A-Z_]+):\s*'(.*)',\s*$/.exec(line);
    if (match) out[match[1] as string] = match[2] as string;
  }
  return out;
}

const mobileSource = readFileSync(
  join(__dirname, '..', '..', '..', '..', 'mobile', 'src', 'lib', 'notice-labels.ts'),
  'utf-8',
);

test('인수권리 라벨이 모바일 사본과 같다', () => {
  assert.deepEqual(parseLabels(mobileSource, 'ASSUMED_RIGHTS_LABEL'), ASSUMED_RIGHTS_LABEL);
});

test('위험 플래그 라벨이 모바일 사본과 같다', () => {
  assert.deepEqual(parseLabels(mobileSource, 'RISK_FLAG_LABEL'), RISK_FLAG_LABEL);
});
