import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colors } from './colors';

test('모든 색상 토큰은 유효한 hex 값이다', () => {
  for (const [name, value] of Object.entries(colors)) {
    assert.match(value, /^#[0-9a-f]{6}$/i, `${name} = ${value}`);
  }
});
