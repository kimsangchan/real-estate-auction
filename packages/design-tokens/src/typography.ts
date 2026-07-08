// 타이포그래피 토큰 — Optimistic VF(Meta 전용 서체, 한글 미지원)를 Pretendard Variable로 치환
// (design-adaptation.md §1). 사이즈·웨이트·행간 스케일은 DESIGN-meta.md 원문 그대로 유지하고,
// ss01/ss02 스타일리스틱 세트는 해당 없어 제외한다.
const FONT_FAMILY = "'Pretendard Variable', -apple-system, 'Noto Sans KR', sans-serif";

export const typography = {
  heroDisplay: { fontFamily: FONT_FAMILY, fontSize: '64px', fontWeight: 500, lineHeight: 1.16 },
  displayLg: { fontFamily: FONT_FAMILY, fontSize: '48px', fontWeight: 500, lineHeight: 1.17 },
  headingLg: { fontFamily: FONT_FAMILY, fontSize: '36px', fontWeight: 500, lineHeight: 1.28 },
  headingMd: { fontFamily: FONT_FAMILY, fontSize: '28px', fontWeight: 300, lineHeight: 1.21 },
  headingSm: { fontFamily: FONT_FAMILY, fontSize: '24px', fontWeight: 500, lineHeight: 1.25 },
  subtitleLg: { fontFamily: FONT_FAMILY, fontSize: '18px', fontWeight: 700, lineHeight: 1.44 },
  subtitleMd: { fontFamily: FONT_FAMILY, fontSize: '18px', fontWeight: 400, lineHeight: 1.44 },
  bodyMdBold: {
    fontFamily: FONT_FAMILY,
    fontSize: '16px',
    fontWeight: 700,
    lineHeight: 1.5,
    letterSpacing: '-0.16px',
  },
  bodyMd: {
    fontFamily: FONT_FAMILY,
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: '-0.16px',
  },
  bodySmBold: {
    fontFamily: FONT_FAMILY,
    fontSize: '14px',
    fontWeight: 700,
    lineHeight: 1.43,
    letterSpacing: '-0.14px',
  },
  bodySm: {
    fontFamily: FONT_FAMILY,
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: 1.43,
    letterSpacing: '-0.14px',
  },
  captionBold: { fontFamily: FONT_FAMILY, fontSize: '12px', fontWeight: 700, lineHeight: 1.33 },
  caption: { fontFamily: FONT_FAMILY, fontSize: '12px', fontWeight: 400, lineHeight: 1.33 },
  buttonMd: {
    fontFamily: FONT_FAMILY,
    fontSize: '14px',
    fontWeight: 700,
    lineHeight: 1.43,
    letterSpacing: '-0.14px',
  },
  linkMd: {
    fontFamily: FONT_FAMILY,
    fontSize: '16px',
    fontWeight: 700,
    lineHeight: 1.5,
    letterSpacing: '-0.16px',
  },
} as const;

export type TypographyToken = keyof typeof typography;
