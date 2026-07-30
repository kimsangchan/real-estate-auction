// photo.ts 순수 헬퍼 테스트 — 프록시 경로 생성과 대체 텍스트 우선순위를 검증한다
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { photoAlt, photoProxySrc } from './photo';

test('photoProxySrc는 next.config.ts 프록시(/api) 경로를 만든다', () => {
  assert.equal(photoProxySrc(93), '/api/auction-items/photos/93');
});

test('photoAlt는 설명 → 구분명 → 일반 문구 순으로 고른다', () => {
  assert.equal(photoAlt({ caption: '건물 전경', categoryName: '전경도' }), '건물 전경');
  assert.equal(photoAlt({ caption: null, categoryName: '전경도' }), '전경도');
  assert.equal(photoAlt({ caption: null, categoryName: null }), '경매물건 사진');
});

test('photoAlt는 공백뿐인 설명·구분명을 없는 것으로 취급한다', () => {
  assert.equal(photoAlt({ caption: '  ', categoryName: '위치도' }), '위치도');
  assert.equal(photoAlt({ caption: '', categoryName: ' ' }), '경매물건 사진');
});
