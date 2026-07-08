// 라운딩(border-radius) 토큰 — DESIGN-meta.md 원문 그대로. 버튼·필·배지는 항상 full(100px) —
// "버튼은 절대 각지지 않는다" 규칙 (design-adaptation.md §4 계승)
export const radius = {
  xs: '2px',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '16px',
  xxl: '24px',
  xxxl: '32px',
  feature: '40px',
  full: '100px',
  circle: '9999px',
} as const;

export type RadiusToken = keyof typeof radius;
