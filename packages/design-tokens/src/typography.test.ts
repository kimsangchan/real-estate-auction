import assert from 'node:assert/strict';
import { test } from 'node:test';
import { typography } from './typography';

test('모든 타이포그래피 토큰은 Pretendard Variable을 1순위 폰트로 쓴다 (Optimistic VF 치환, design-adaptation.md §1)', () => {
  for (const [name, token] of Object.entries(typography)) {
    assert.match(token.fontFamily, /^'Pretendard Variable'/, name);
    assert.doesNotMatch(token.fontFamily, /Optimistic VF/, name);
  }
});
