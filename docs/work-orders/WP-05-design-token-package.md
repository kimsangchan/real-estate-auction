# WP-05. 디자인 토큰 패키지 (Phase 2-0)

- 상태: **완료 (2026-07-08)** — `packages/design-tokens` 구현, `apps/web`에 연결·시각 확인 완료 | 선행: WP-01(완료) | 담당 에이전트: Claude Sonnet 5
- 시작 전 필독: `DESIGN-meta.md`, `docs/design/design-adaptation.md`, `07-roadmap.md` 2-0

## 목적
`DESIGN-meta.md`(Meta 커머스 디자인 시스템) + `docs/design/design-adaptation.md`(도메인 적용 규칙)를 단일 소스 토큰 패키지로 코드화해, 웹(CSS 변수)·RN(상수 객체)이 하드코딩 없이 공유하도록 한다 (로드맵 2-0).

## 요구사항
1. 색상·타이포그래피·스페이싱·라운딩 토큰을 `DESIGN-meta.md` 원문 값 그대로 코드화
2. **필수 치환 반영** (design-adaptation.md §1): Optimistic VF(한글 미지원, 라이선스 없음) → Pretendard Variable, `badgeAttention`의 흰색 텍스트(WCAG AA 미달) → `inkDeep`
3. **제외 목록 반영** (§2): `promo-banner`, `badge-promo-yellow` 등 다크패턴·MVP 무료 정책과 충돌하는 컴포넌트는 토큰화하지 않음
4. 컴포넌트 토큰은 §3 도메인 매핑에서 실제로 쓰이는 것만 포함 (Meta 하드웨어 커머스 전용 컴포넌트 제외 — 규칙 14)
5. 웹은 CSS 커스텀 프로퍼티로, RN은 상수 객체로 동일 토큰을 공유 (단일 소스, 규칙 13)

## 완료 기준
- [x] `packages/design-tokens` — colors/typography/spacing/radius/components + CSS 변수 생성기, 단위 테스트 7건 통과
- [x] `apps/web/app/layout.tsx`에 연결 — `:root` CSS 변수 주입 + body 기본 폰트/색상 적용
- [x] 개발 서버로 실제 렌더링 확인 (흰 배경·Pretendard 폰트 스택 적용 확인)
- [x] `pnpm -r lint && pnpm -r test && pnpm -r build` 전체 통과 (apps/api, apps/web, packages/shared, packages/design-tokens)

## 범위 제외
와이어프레임(2-1), 실제 화면 컴포넌트 구현(2-2~2-8), RN 앱(`apps/mobile`, WP-01b 대기), Pretendard 폰트 파일 자체 호스팅(폰트 스택은 정의했으나 웹폰트 파일 번들링은 후속 작업).
