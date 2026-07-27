import assert from 'node:assert/strict';
import { test } from 'node:test';
import { needsSessionRefresh, withAccessTokenCookie } from './session-cookie';

test('needsSessionRefresh는 액세스 토큰이 없고 리프레시 토큰만 있으면 true를 반환한다', () => {
  assert.equal(needsSessionRefresh('refresh_token=r1'), true);
  assert.equal(needsSessionRefresh('other=1; refresh_token=r1'), true);
});

test('needsSessionRefresh는 액세스 토큰이 아직 있으면 false를 반환한다', () => {
  assert.equal(needsSessionRefresh('access_token=a1; refresh_token=r1'), false);
});

test('needsSessionRefresh는 리프레시 토큰이 없으면(비로그인) false를 반환한다', () => {
  assert.equal(needsSessionRefresh('other=1'), false);
});

test('needsSessionRefresh는 쿠키 헤더가 없어도 안전하게 false를 반환한다', () => {
  assert.equal(needsSessionRefresh(null), false);
  assert.equal(needsSessionRefresh(undefined), false);
  assert.equal(needsSessionRefresh(''), false);
});

test('withAccessTokenCookie는 기존 쿠키를 유지한 채 액세스 토큰을 덧붙인다', () => {
  assert.equal(withAccessTokenCookie('refresh_token=r1', 'a2'), 'refresh_token=r1; access_token=a2');
});

test('withAccessTokenCookie는 이미 있는 액세스 토큰을 새 값으로 교체한다(중복 방지)', () => {
  assert.equal(withAccessTokenCookie('access_token=old; refresh_token=r1', 'a2'), 'refresh_token=r1; access_token=a2');
});

test('withAccessTokenCookie는 경계값: 쿠키 헤더가 비어 있으면 액세스 토큰만 담는다', () => {
  assert.equal(withAccessTokenCookie(null, 'a2'), 'access_token=a2');
});
