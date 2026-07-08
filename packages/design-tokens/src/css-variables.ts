// 토큰 객체 → CSS 커스텀 프로퍼티 변환 — 웹(Next.js)이 :root에 주입해 쓰는 단일 소스 (규칙 13,
// 하드코딩 금지의 디자인판). RN은 colors/typography/spacing/radius 객체를 상수로 직접 import한다.
import { colors } from './colors';
import { radius } from './radius';
import { spacing } from './spacing';
import { typography } from './typography';

function toKebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function flatten(prefix: string, value: unknown, out: Record<string, string>): void {
  if (typeof value === 'string' || typeof value === 'number') {
    out[`--${prefix}`] = String(value);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      flatten(`${prefix}-${toKebabCase(key)}`, nested, out);
    }
  }
}

export function buildCssVariables(): Record<string, string> {
  const out: Record<string, string> = {};
  flatten('color', colors, out);
  flatten('spacing', spacing, out);
  flatten('radius', radius, out);
  flatten('typography', typography, out);
  return out;
}

export function buildCssVariablesText(): string {
  const variables = buildCssVariables();
  const lines = Object.entries(variables).map(([key, value]) => `  ${key}: ${value};`);
  return `:root {\n${lines.join('\n')}\n}\n`;
}
