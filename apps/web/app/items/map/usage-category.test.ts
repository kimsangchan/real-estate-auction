import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  usageCategory,
  USAGE_CATEGORY_ICON,
  USAGE_CATEGORY_LABEL,
  type UsageCategory,
} from './usage-category';

const ALL: UsageCategory[] = [
  'APARTMENT',
  'MULTI_HOUSE',
  'OFFICETEL',
  'DETACHED',
  'RETAIL',
  'LAND',
  'OTHER',
];

test('실측 용도 분포를 빠짐없이 범주로 옮긴다', () => {
  // 개발 DB 실측(2,979건)의 대표용도 15종. 하나라도 OTHER로 새면 지도에서 유형이 뭉개진다.
  const observed: Array<[string, UsageCategory]> = [
    ['상가', 'RETAIL'],
    ['다세대', 'MULTI_HOUSE'],
    ['연립주택', 'MULTI_HOUSE'],
    ['오피스텔', 'OFFICETEL'],
    ['아파트', 'APARTMENT'],
    ['단독주택다가구', 'DETACHED'],
    ['근린시설', 'RETAIL'],
    ['대지', 'LAND'],
    ['임야', 'LAND'],
    ['단독주택', 'DETACHED'],
    ['다가구주택', 'DETACHED'],
    ['전답', 'LAND'],
    ['빌라', 'MULTI_HOUSE'],
  ];
  for (const [usage, expected] of observed) {
    assert.equal(usageCategory(usage), expected, `${usage} → ${expected}`);
  }
});

test('법원이 콤마로 묶어 보낸 용도는 첫 조각으로 판정한다', () => {
  // 실측: "연립주택,다세대,빌라"(126건), "상가,오피스텔,근린시설"(127건)
  assert.equal(usageCategory('연립주택,다세대,빌라'), 'MULTI_HOUSE');
  assert.equal(usageCategory('상가,오피스텔,근린시설'), 'RETAIL');
});

test('모르는 용도와 미상은 OTHER — 건물이라고 단정하지 않는다', () => {
  // 실측에 "기타" 178건, "자동차" 28건이 있다. 자동차를 건물 아이콘으로 그리면 사실과 어긋난다.
  assert.equal(usageCategory('기타'), 'OTHER');
  assert.equal(usageCategory('자동차'), 'OTHER');
  assert.equal(usageCategory('처음보는용도'), 'OTHER');
  assert.equal(usageCategory(null), 'OTHER');
  assert.equal(usageCategory('  '), 'OTHER');
});

test('모든 범주에 라벨과 아이콘이 있다', () => {
  for (const category of ALL) {
    assert.ok(USAGE_CATEGORY_LABEL[category], `${category} 라벨 없음`);
    assert.ok(USAGE_CATEGORY_ICON[category], `${category} 아이콘 없음`);
  }
});

test('아이콘은 currentColor를 쓰고 스크립트를 담지 않는다', () => {
  // 마커는 innerHTML로 주입되므로 여기에 실행 가능한 것이 섞이면 안 된다.
  for (const category of ALL) {
    const icon = USAGE_CATEGORY_ICON[category];
    assert.ok(!/<script|on[a-z]+=|javascript:/i.test(icon), `${category} 아이콘에 실행 코드`);
    // 색은 CSS 클래스가 정한다 — 아이콘 안에 색을 박으면 유형별 구분이 죽는다
    assert.ok(!/fill="#|stroke="#/.test(icon), `${category} 아이콘에 하드코딩된 색`);
  }
});

test('범주 색은 판단을 뜻하는 토큰을 쓰지 않는다 (D-011)', async () => {
  // 용도는 좋고 나쁨이 아니다 — warning·critical 색을 쓰면 "위험한 물건"으로 읽힌다
  // (page.module.css의 markerDrop 주석과 같은 원칙).
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  // 테스트는 dist-test/app/items/map 에서 돌아 __dirname 이 소스 폴더가 아니다 — apps/web 까지 올라간다
  const css = readFileSync(
    join(__dirname, '..', '..', '..', '..', 'app', 'items', 'map', 'page.module.css'),
    'utf-8',
  );
  const block = css.slice(css.indexOf('.markerIcon'), css.indexOf('.markerPrice'));
  assert.ok(block.length > 0, '.markerIcon 블록을 찾지 못했다');
  assert.ok(!block.includes('--color-warning'), '범주 색에 warning이 있다');
  assert.ok(!block.includes('--color-critical'), '범주 색에 critical이 있다');
});
