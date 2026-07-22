import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isFavorited } from './favorite-match';

test('isFavorited는 자연키 3콤보가 모두 일치할 때만 true다', () => {
  const favorites = [{ courtOfficeCode: 'B000210', caseNo: '2025타경755', itemNo: '1' }];
  assert.equal(isFavorited(favorites, { courtOfficeCode: 'B000210', caseNo: '2025타경755', itemNo: '1' }), true);
});

test('isFavorited는 하나라도 다르면 false다', () => {
  const favorites = [{ courtOfficeCode: 'B000210', caseNo: '2025타경755', itemNo: '1' }];
  assert.equal(isFavorited(favorites, { courtOfficeCode: 'B000210', caseNo: '2025타경755', itemNo: '2' }), false);
});

test('isFavorited는 빈 목록이면 false다', () => {
  assert.equal(isFavorited([], { courtOfficeCode: 'B000210', caseNo: '2025타경755', itemNo: '1' }), false);
});
