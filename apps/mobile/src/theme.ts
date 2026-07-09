// design-tokens 패키지를 RN 스타일 단위(숫자 px, 절대 lineHeight)로 변환한 단일 소스 테마.
// 색상은 그대로 재사용하고, 웹 전용 값(px 문자열·폰트 스택·비율 lineHeight)만 RN용으로 보정한다.
import type { TextStyle } from 'react-native';
import {
  colors,
  radius as radiusTokens,
  spacing,
  typography,
} from '@auction/design-tokens';

const px = (value: string): number => parseFloat(value);

const toNumbers = <T extends Record<string, string>>(
  tokens: T,
): Record<keyof T, number> =>
  Object.fromEntries(
    Object.entries(tokens).map(([key, value]) => [key, px(value)]),
  ) as Record<keyof T, number>;

// Pretendard는 RN에 번들되지 않았고 lineHeight는 RN에서 절대값(px)이라, fontFamily는 시스템 기본에 맡기고
// 비율 lineHeight를 fontSize에 곱해 절대값으로 바꾼다.
type TypographyToken = (typeof typography)[keyof typeof typography];

const toTextStyle = (token: TypographyToken): TextStyle => {
  const fontSize = px(token.fontSize);
  const style: TextStyle = {
    fontSize,
    lineHeight: Math.round(fontSize * token.lineHeight),
    fontWeight: String(token.fontWeight) as TextStyle['fontWeight'],
  };
  if ('letterSpacing' in token && token.letterSpacing) {
    style.letterSpacing = px(token.letterSpacing);
  }
  return style;
};

export { colors };
export const space = toNumbers(spacing);
export const radius = toNumbers(radiusTokens);

export const text = {
  headingSm: toTextStyle(typography.headingSm),
  subtitleLg: toTextStyle(typography.subtitleLg),
  bodyMd: toTextStyle(typography.bodyMd),
  bodyMdBold: toTextStyle(typography.bodyMdBold),
  bodySm: toTextStyle(typography.bodySm),
  bodySmBold: toTextStyle(typography.bodySmBold),
  caption: toTextStyle(typography.caption),
  captionBold: toTextStyle(typography.captionBold),
  buttonMd: toTextStyle(typography.buttonMd),
} as const;
