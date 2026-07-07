// 사건번호 검증 단위 테스트 — 정상/실패/경계값 (AGENTS.md 규칙 11)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isValidCaseNo } from './case-no';

test('정상 사건번호를 통과시킨다', () => {
  assert.equal(isValidCaseNo('2026타경12345'), true);
});

test('사건 구분이 다르거나 형식이 깨지면 거부한다', () => {
  assert.equal(isValidCaseNo('2026가단12345'), false);
  assert.equal(isValidCaseNo('타경12345'), false);
  assert.equal(isValidCaseNo(''), false);
});

test('경계값: 연도 4자리·일련번호 1~10자리', () => {
  assert.equal(isValidCaseNo('2026타경1'), true);
  assert.equal(isValidCaseNo('2026타경1234567890'), true);
  assert.equal(isValidCaseNo('2026타경12345678901'), false);
  assert.equal(isValidCaseNo('026타경12345'), false);
});
