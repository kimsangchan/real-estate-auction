import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colors } from './colors';
import { radius } from './radius';
import { components } from './components';

test('badgeAttention은 대비 수정을 반영해 inkDeep 텍스트를 쓴다 (원본 canvas 텍스트는 WCAG AA 미달, §1)', () => {
  assert.equal(components.badgeAttention.textColor, colors.inkDeep);
});

test('버튼·필·배지 계열 컴포넌트는 항상 radius.full을 쓴다 ("버튼은 절대 각지지 않는다")', () => {
  const pillComponents = [
    components.buttonPrimary,
    components.buttonBuyCta,
    components.buttonPillTab,
    components.searchPill,
    components.badgeCritical,
    components.badgeSuccess,
    components.badgeAttention,
  ];

  for (const component of pillComponents) {
    assert.equal(component.rounded, radius.full);
  }
});
