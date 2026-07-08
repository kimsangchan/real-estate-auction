import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeItemId, encodeItemId } from './item-id';

test('encodeItemId와 decodeItemId는 서로 역함수다', () => {
  const key = { courtOfficeCode: 'B000210', caseNo: '2025타경755', itemNo: '1' };
  assert.deepEqual(decodeItemId(encodeItemId(key)), key);
});

// Next.js 동적 라우트 세그먼트가 percent-encoding이 남은 채로 넘어오는 경우가 있어(2026-07-08 발견) 회귀 방지
test('decodeItemId는 percent-encoding이 남아있는 문자열도 디코딩한다', () => {
  const encoded = `B000210_${encodeURIComponent('2025타경755')}_1`;
  assert.deepEqual(decodeItemId(encoded), {
    courtOfficeCode: 'B000210',
    caseNo: '2025타경755',
    itemNo: '1',
  });
});

test('decodeItemId는 구성 요소가 3개가 아니면 null이다', () => {
  assert.equal(decodeItemId('B000210_1'), null);
  assert.equal(decodeItemId('a_b_c_d'), null);
});
