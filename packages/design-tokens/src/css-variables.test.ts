import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCssVariables, buildCssVariablesText } from './css-variables';

test('색상·스페이싱·라운딩 토큰이 커스텀 프로퍼티로 변환된다', () => {
  const variables = buildCssVariables();

  assert.equal(variables['--color-primary'], '#0064e0');
  assert.equal(variables['--spacing-base'], '16px');
  assert.equal(variables['--radius-full'], '100px');
});

test('중첩된 타이포그래피 토큰도 하위 속성별로 평탄화된다', () => {
  const variables = buildCssVariables();

  assert.equal(variables['--typography-body-md-font-size'], '16px');
  assert.equal(variables['--typography-body-md-font-weight'], '400');
});

test('buildCssVariablesText는 :root 블록으로 감싼 CSS 텍스트를 만든다', () => {
  const text = buildCssVariablesText();

  assert.match(text, /^:root \{\n/);
  assert.match(text, /--color-primary: #0064e0;/);
  assert.match(text, /\}\n$/);
});
