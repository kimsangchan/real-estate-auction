import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildProviderHref } from './provider-href';

test('buildProviderHref는 returnTo가 없으면 쿼리 없이 provider 경로만 만든다', () => {
  assert.equal(buildProviderHref('kakao', undefined), '/api/auth/kakao');
});

test('buildProviderHref는 returnTo를 쿼리로 인코딩해 붙인다', () => {
  assert.equal(
    buildProviderHref('naver', '/items/B000210_2025타경755_1'),
    `/api/auth/naver?returnTo=${encodeURIComponent('/items/B000210_2025타경755_1')}`,
  );
});
