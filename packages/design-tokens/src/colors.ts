// 색상 토큰 — DESIGN-meta.md 원문 값을 그대로 코드화한 단일 소스. 도메인 적용 규칙은
// docs/design/design-adaptation.md 참고 (컬러 팔레트는 §4에 따라 전체 계승, 치환 없음).
export const colors = {
  primary: '#0064e0',
  primaryDeep: '#0457cb',
  primarySoft: '#0091ff',
  onPrimary: '#ffffff',
  inkButton: '#000000',
  onInkButton: '#ffffff',
  fbBlue: '#1876f2',
  metaLink: '#385898',
  oculusPurple: '#a121ce',
  success: '#31a24c',
  successBg: '#24e400',
  attention: '#f2a918',
  warning: '#f7b928',
  warningBg: '#ffe200',
  critical: '#e41e3f',
  criticalStrong: '#f0284a',
  canvas: '#ffffff',
  surfaceSoft: '#f1f4f7',
  inkDeep: '#0a1317',
  ink: '#1c1e21',
  charcoal: '#444950',
  slate: '#4b4c4f',
  steel: '#5d6c7b',
  stone: '#8595a4',
  hairline: '#ced0d4',
  hairlineSoft: '#dee3e9',
  disabledText: '#bcc0c4',
} as const;

export type ColorToken = keyof typeof colors;
