// 스페이싱 토큰 — 4px 기반 스케일, DESIGN-meta.md 원문 그대로 (design-adaptation.md §4 계승)
export const spacing = {
  xxs: '4px',
  xs: '8px',
  sm: '10px',
  md: '12px',
  base: '16px',
  lg: '20px',
  xl: '24px',
  xxl: '32px',
  xxxl: '40px',
  sectionSm: '48px',
  section: '64px',
  sectionLg: '80px',
  hero: '120px',
} as const;

export type SpacingToken = keyof typeof spacing;
