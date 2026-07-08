// 디자인 토큰 패키지 진입점 — DESIGN-meta.md + docs/design/design-adaptation.md 기준 단일 소스.
// 웹은 buildCssVariablesText()로 CSS 변수를 주입하고, RN은 아래 상수 객체를 직접 import한다.
export { colors, type ColorToken } from './colors';
export { typography, type TypographyToken } from './typography';
export { spacing, type SpacingToken } from './spacing';
export { radius, type RadiusToken } from './radius';
export { components, type ComponentToken } from './components';
export { buildCssVariables, buildCssVariablesText } from './css-variables';
