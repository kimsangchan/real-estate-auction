# 디자인 시스템 적용 가이드 — DESIGN-meta.md → 경매 플랫폼

작성일 2026-07-07. 사용자 확정: 프론트 디자인의 기본은 루트 `DESIGN-meta.md` (decision-log D-014).
이 문서는 Meta 커머스 디자인 시스템을 **우리 도메인(경매 탐색·권리분석)으로 매핑하는 규칙**이다. Phase 2 프론트엔드 WP는 이 문서와 DESIGN-meta.md를 함께 필독한다.

## 원칙

- **시각 언어(토큰·컴포넌트) = DESIGN-meta.md** / **행동·문구(플로우, UX 라이팅) = 토스 원칙(T-NN)·UX 기준(UX-01~07)**. 두 체계는 층위가 달라 충돌하지 않으며, 충돌 시 아래 "제외 목록"을 따른다.
- 토큰 이름은 DESIGN-meta.md 원문(`{colors.primary}` 등)을 그대로 쓰고, 구현 시 `packages/` 하위 토큰 패키지로 코드화한다.

## 1. 필수 치환 (그대로 쓰면 안 되는 것)

| 항목 | 문제 | 치환 |
|---|---|---|
| **Optimistic VF 폰트** | Meta 전용 서체 — 제3자 라이선스 없음 + **한글 미지원** | **Pretendard Variable** (SIL OFL, 무료)로 전면 치환. 웨이트 매핑 동일(300/400/500/700), 사이즈·행간 스케일은 DESIGN-meta 표 유지. 폴백: -apple-system, Noto Sans KR, sans-serif. `ss01/ss02` 피처는 미적용(해당 없음) |
| 영문 폴백 체인 (Montserrat/Helvetica) | 한글 본문 미커버 | Pretendard가 라틴 포함 — 별도 영문 폰트 불요 |
| `badge-attention` (주황 배경 + 흰 글자) | 대비 약 2:1 — WCAG AA 미달 | attention/warning 계열 배지는 `{colors.ink-deep}` 텍스트로 통일 (spec의 warning 배지와 동일 처리). 모든 배지 조합 AA(4.5:1) 검증 후 사용 |

## 2. 사용하지 않는 패턴 (토스 원칙·기획과 충돌)

| DESIGN-meta 패턴 | 제외 사유 |
|---|---|
| `promo-banner` (내비 위 프로모션 스트립) | T-04 진입 방해 금지 + MVP 무료 정책(A-03)이라 프로모션 없음 |
| `badge-promo-yellow` (Limited time 등) | L-09 강조 화면당 1곳 원칙, 판촉 유도 배지는 다크패턴 소지 |
| 마케팅 히어로의 세일 카피 패턴 | 웹 랜딩은 정보 전달 목적만 (T-14) |

## 3. 도메인 컴포넌트 매핑 (경매 앱 ← Meta 커머스)

| 우리 화면 요소 (05-blueprint §3a) | DESIGN-meta 컴포넌트 | 비고 |
|---|---|---|
| 지도 필터 칩 (유형·가격·유찰…) | `button-pill-tab` / `-active` | 그룹당 ≤7 (L-04) |
| 주소·사건번호 검색바 | `search-pill` | |
| 핵심 CTA "권리분석 보기" | `button-buy-cta` ({colors.primary} 코발트) | "코발트 = 전환 CTA 전용" 원칙을 그대로 계승 — 화면당 1개 (L-09, UX-07) |
| 웹 랜딩·마케팅 CTA | `button-primary` (블랙 필) | Meta의 이원 CTA 체계 유지 |
| 물건 요약 카드 (바텀시트/우측 레일) | `card-checkout-summary` | 모바일 <768px sticky 바텀 바 패턴 그대로 — **총 부담액(UX-02) 표시 바**로 사용 |
| 물건 개요 표 (감정가·최저가·면적·기일) | `tech-specs-table` | |
| 권리분석 근거 펼침 (규칙 ID별) | `faq-accordion-item` | F-03 "왜 이렇게 분류됐는지" |
| 위험 플래그 배지 | `badge-critical`(위험 키워드 감지), `badge-attention`(기일 임박, ink-deep 텍스트), `badge-success`(신건·진행) | **사실 서술 라벨만** — "위험함/안전함" 판단 문구 금지 (D-011) |
| 필터 상세 옵션 | `radio-option` / `-selected` | |
| 물건 사진 갤러리 (웹 상세) | `product-gallery-pdp` | 법원 현황조사 사진 + sticky 요약 레일 = SEO 페이지 골격 |
| 임장 체크리스트 항목 | `card-icon-feature` | |
| 용어 도우미 툴팁 카드 | `card-icon-feature` + `{colors.primary-soft}` 15% 틴트 (정보성 콜아웃 규칙) | UX-03 |
| 단지·통계 카드 | `card-product-feature` (`{rounded.xxxl}`) | |

## 4. 그대로 계승하는 시스템

- 컬러 팔레트 전체(§1 치환 제외), 시맨틱 컬러 용법 (success/attention/critical)
- 스페이싱 스케일(4px 기반), 라운딩 스케일 (필 버튼 `{rounded.full}` 불변 — "버튼은 절대 각지지 않는다")
- 타이포 3단 리듬 (500 디스플레이 / 300 에디토리얼 / 400 본문) — Pretendard 웨이트로
- 플랫 엘리베이션 정책: 그림자는 sticky 요약 패널 등 "행동 레이어"에만
- 반응형 브레이크포인트·터치 타깃 (44px — L-02 기준 32px보다 엄격하므로 그대로 채택)
- 다크모드: DESIGN-meta도 미정의(Known Gaps) → MVP는 라이트 온리, 다크는 Phase 3 백로그

## 5. 구현 지침 (Phase 2 WP 작성 시 반영)

1. 토큰은 `packages/` 하위에 단일 소스(JSON/TS)로 정의하고 웹(CSS 변수)·RN(StyleSheet 상수)이 공유한다 (AGENTS.md 규칙 13 — 하드코딩 금지의 디자인판)
2. DESIGN-meta.md의 Iteration Guide 준수: 토큰 이름 원문 참조, 변형은 `-pressed`/`-disabled` 별도 엔트리
3. 신규 화면은 이 문서 §3 매핑을 먼저 찾고, 없을 때만 새 컴포넌트 제안 (AGENTS.md 규칙 14)
4. 문구는 여전히 토스 라이팅(T-09~13): 해요체·능동형·긍정형·용어 풀어쓰기 — Meta의 영문 카피 톤은 참조하지 않는다
