import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildBreadcrumbJsonLd,
  buildItemDescription,
  buildItemTitle,
  buildOpenGraph,
  NOINDEX,
  serializeJsonLd,
  type ItemSeoFields,
} from './seo';

const item: ItemSeoFields = {
  caseNo: '2023타경4722',
  courtName: '서울중앙지방법원',
  usageName: '아파트',
  address: '서울특별시 서초구 서초동 1번지',
  appraisalAmount: 259_000_000,
  minimumSalePrice: 84_869_000,
};

test('buildItemTitle은 주소와 최저가를 제목에 담는다', () => {
  assert.equal(
    buildItemTitle(item),
    '서울특별시 서초구 서초동 1번지 - 84,869,000원 경매 | 부동산 경매 플랫폼',
  );
});

test('buildItemTitle은 주소가 없으면 사건번호로 대체한다', () => {
  assert.equal(buildItemTitle({ ...item, address: null }), '2023타경4722 - 84,869,000원 경매 | 부동산 경매 플랫폼');
});

test('buildItemTitle은 최저가가 없어도 빈 값을 노출하지 않는다', () => {
  assert.equal(
    buildItemTitle({ ...item, minimumSalePrice: null }),
    '서울특별시 서초구 서초동 1번지 - 경매 물건 | 부동산 경매 플랫폼',
  );
});

test('buildItemDescription은 법원·사건번호·물건종류·가격을 사실만 나열한다', () => {
  assert.equal(
    buildItemDescription(item),
    '서울중앙지방법원 · 2023타경4722 · 아파트 · 감정가 259,000,000원, 최저가 84,869,000원',
  );
});

test('buildItemDescription은 없는 필드를 빈 문자열로 흘리지 않는다', () => {
  const description = buildItemDescription({ ...item, courtName: null, usageName: null, appraisalAmount: null });
  assert.equal(description, '2023타경4722 · 물건 · 감정가 정보 없음, 최저가 84,869,000원');
  assert.ok(!description.includes('  '), '빈 필드 때문에 공백이 겹치면 안 된다');
});

test('설명에는 판단·권유 문구가 들어가지 않는다 (D-011)', () => {
  const banned = ['추천', '기회', '안전', '유망', '수익', '투자하'];
  const text = `${buildItemTitle(item)} ${buildItemDescription(item)}`;
  for (const word of banned) {
    assert.ok(!text.includes(word), `금지 표현 "${word}"가 포함되면 안 된다`);
  }
});

test('buildBreadcrumbJsonLd는 절대 URL과 1부터 시작하는 position을 만든다', () => {
  const jsonLd = buildBreadcrumbJsonLd('https://example.com', [
    { name: '물건 목록', path: '/items' },
    { name: '서울특별시 서초구 서초동 1번지', path: '/items/abc' },
  ]);

  assert.equal(jsonLd['@type'], 'BreadcrumbList');
  assert.deepEqual(jsonLd.itemListElement, [
    { '@type': 'ListItem', position: 1, name: '물건 목록', item: 'https://example.com/items' },
    {
      '@type': 'ListItem',
      position: 2,
      name: '서울특별시 서초구 서초동 1번지',
      item: 'https://example.com/items/abc',
    },
  ]);
});

test('buildBreadcrumbJsonLd는 path가 없는 마지막 항목의 item을 아예 넣지 않는다', () => {
  const jsonLd = buildBreadcrumbJsonLd('https://example.com', [
    { name: '경매 물건 목록', path: '/items' },
    { name: '아파트' },
  ]);

  const last = jsonLd.itemListElement[1];
  assert.deepEqual(last, { '@type': 'ListItem', position: 2, name: '아파트' });
  assert.ok(last && !('item' in last), 'item 키가 undefined로라도 남으면 안 된다');
});

test('buildBreadcrumbJsonLd는 한글 사건번호를 canonical과 같은 형태로 인코딩한다', () => {
  const jsonLd = buildBreadcrumbJsonLd('https://example.com', [
    { name: '물건', path: '/items/B000210_2025타경311_1' },
  ]);

  assert.equal(jsonLd.itemListElement[0]?.item, 'https://example.com/items/B000210_2025%ED%83%80%EA%B2%BD311_1');
});

test('buildOpenGraph는 페이지마다 siteName·locale·type을 다시 채운다 (Next가 깊은 병합을 안 함)', () => {
  assert.deepEqual(buildOpenGraph('/items', '목록', '설명'), {
    type: 'website',
    siteName: '부동산 경매 플랫폼',
    locale: 'ko_KR',
    url: '/items',
    title: '목록',
    description: '설명',
  });
});

test('NOINDEX는 색인만 막고 링크는 따라가게 둔다', () => {
  assert.deepEqual(NOINDEX, { index: false, follow: true });
});

test('serializeJsonLd는 수집 데이터에 섞인 태그로 script를 빠져나가지 못하게 막는다', () => {
  const serialized = serializeJsonLd({ name: '서초동 </script><script>alert(1)</script>' });

  assert.ok(!serialized.includes('</script>'), 'script 종료 태그가 그대로 남으면 안 된다');
  assert.ok(serialized.includes('\\u003c/script'));
  // 이스케이프해도 JSON으로는 원문 그대로 복원돼야 한다
  assert.deepEqual(JSON.parse(serialized), { name: '서초동 </script><script>alert(1)</script>' });
});
