// 컴포넌트 토큰 — docs/design/design-adaptation.md §3 도메인 매핑에서 실제로 쓰이는 컴포넌트만
// 포함한다(Meta 원본 카탈로그 중 하드웨어 커머스 전용 컴포넌트는 제외). badgeAttention은 §1의
// 접근성 수정(원본 캔버스색 텍스트는 대비 부족)을 반영해 inkDeep 텍스트로 통일했다.
import { colors } from './colors';
import { radius } from './radius';
import { spacing } from './spacing';
import { typography } from './typography';

export const components = {
  /** 마케팅/보조 CTA — 블랙 필 */
  buttonPrimary: {
    backgroundColor: colors.inkButton,
    textColor: colors.onInkButton,
    typography: typography.buttonMd,
    rounded: radius.full,
    padding: '14px 30px',
  },
  buttonPrimaryPressed: { backgroundColor: colors.charcoal, textColor: colors.onInkButton },
  /** 화면당 1개 핵심 전환 CTA(예: "권리분석 보기") — 코발트 필 */
  buttonBuyCta: {
    backgroundColor: colors.primary,
    textColor: colors.onPrimary,
    typography: typography.buttonMd,
    rounded: radius.full,
    padding: '14px 30px',
  },
  buttonBuyCtaPressed: { backgroundColor: colors.primaryDeep, textColor: colors.onPrimary },
  /** 지도 필터 칩(유형·가격·유찰 등) */
  buttonPillTab: {
    backgroundColor: colors.canvas,
    textColor: colors.ink,
    typography: typography.bodySmBold,
    rounded: radius.full,
    padding: '8px 16px',
    border: `1px solid ${colors.hairline}`,
  },
  buttonPillTabActive: { backgroundColor: colors.inkDeep, textColor: colors.canvas },
  /** 주소·사건번호 검색바 */
  searchPill: {
    backgroundColor: colors.surfaceSoft,
    textColor: colors.steel,
    typography: typography.bodySm,
    rounded: radius.full,
    padding: `${spacing.md} ${spacing.lg}`,
    height: '40px',
  },
  /** 물건 요약/총부담액 표시 바(바텀시트·우측 레일, <768px sticky) */
  cardCheckoutSummary: {
    backgroundColor: colors.canvas,
    rounded: radius.xl,
    padding: spacing.xl,
    border: `1px solid ${colors.hairlineSoft}`,
    shadow: 'rgba(20, 22, 26, 0.3) 0px 1px 4px 0px',
  },
  /** 단지·통계 카드 */
  cardProductFeature: {
    backgroundColor: colors.canvas,
    rounded: radius.xxxl,
    padding: spacing.xxl,
    border: `1px solid ${colors.hairlineSoft}`,
  },
  /** 임장 체크리스트 항목, 용어 도우미 툴팁 카드 */
  cardIconFeature: {
    backgroundColor: colors.canvas,
    rounded: radius.xl,
    padding: spacing.xl,
    border: `1px solid ${colors.hairlineSoft}`,
  },
  /** 물건 개요 표(감정가·최저가·면적·기일) */
  techSpecsTable: {
    backgroundColor: colors.canvas,
    textColor: colors.ink,
    typography: typography.bodySm,
    rounded: radius.lg,
    padding: spacing.lg,
    border: `1px solid ${colors.hairlineSoft}`,
  },
  /** 권리분석 근거 펼침(규칙 ID별) */
  faqAccordionItem: {
    backgroundColor: colors.canvas,
    rounded: radius.xl,
    padding: spacing.xl,
    border: `1px solid ${colors.hairlineSoft}`,
  },
  /** 필터 상세 옵션 */
  radioOption: {
    backgroundColor: colors.canvas,
    rounded: radius.lg,
    padding: spacing.lg,
    border: '1px solid rgba(10, 19, 23, 0.12)',
  },
  radioOptionSelected: { backgroundColor: colors.canvas, rounded: radius.lg, border: '2px solid #0143b5' },
  /** 물건 사진 갤러리(웹 상세) */
  productGalleryPdp: { backgroundColor: colors.canvas, rounded: radius.xxxl, padding: spacing.base },
  /** 위험 키워드 감지 — 사실 서술 라벨만, 판단 문구 금지 (D-011) */
  badgeCritical: {
    backgroundColor: colors.critical,
    textColor: colors.canvas,
    typography: typography.captionBold,
    rounded: radius.full,
    padding: '4px 10px',
  },
  /** 신건·진행 등 긍정 상태 라벨 */
  badgeSuccess: {
    backgroundColor: colors.success,
    textColor: colors.canvas,
    typography: typography.captionBold,
    rounded: radius.full,
    padding: '4px 10px',
  },
  /** 기일 임박 등 — 원본은 canvas 텍스트라 대비 부족(WCAG AA 미달), inkDeep으로 수정 */
  badgeAttention: {
    backgroundColor: colors.attention,
    textColor: colors.inkDeep,
    typography: typography.captionBold,
    rounded: radius.full,
    padding: '4px 10px',
  },
} as const;

export type ComponentToken = keyof typeof components;
