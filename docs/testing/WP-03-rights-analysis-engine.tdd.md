# WP-03 TDD Evidence — 권리분석 룰 엔진 v1

작성일: 2026-07-08

## Source

- 작업지시서: `docs/work-orders/WP-03-rights-analysis-engine.md`
- 기획 근거: `solution-planning/realestate-auction-platform/01-domain-discovery.md` §1-3, `decision-log.md` D-011
- 구현 위치: `apps/api/src/rights-analysis/`

## User Journeys

1. 등기 권리 목록이 주어지면 말소기준권리(6종 후보, 전세권 예외 포함)를 접수일 최선순위로 판별한다.
2. 말소기준 이후 권리는 말소, 이전 용익물권·가처분·가등기는 인수로 분류하되 담보물권·압류 계열은 항상 말소된다.
3. 임차인의 대항력(전입 익일 0시)과 배당요구 유효성(배당요구종기 이내)을 판정하고, 소액임차인 최우선변제·일반 우선변제를 거쳐 매수인의 인수 잔액을 산정한다.
4. 등기부에 없는 위험(유치권·법정지상권·분묘기지권)은 항상 "확인 필요"로만 표시하고 자동 판별하지 않는다.
5. 모든 출력은 enum 상태값과 금액만 포함하고, ruleId·ruleVersion으로 감사 가능하다 (판단·권유 문구 금지, D-011).

## RED/GREEN Evidence

| Stage | Command | Result | Evidence |
|---|---|---|---|
| 연구 | 소액임차인 최우선변제 개정 연혁 조사 (1984~2026) | 완료 | KLAC·법제처·U-LEX 3개 이상 출처 교차검증, `small-deposit-tenant-table.ts` 주석에 출처 기재 |
| GREEN (도메인) | `npx jest` (`apps/api`) | PASS | baseline-right, right-classification, tenant-priority, small-deposit-tenant(-table), distribution, total-burden 전부 통과 |
| GREEN (DTO) | `npx jest validate-request` | PASS | class-validator 기반 필수 필드·타입·화이트리스트 검증 |
| GREEN (서비스) | `npx jest rights-analysis.service` | PASS | 검증 시나리오 10건 + 판단문구 0건 강제 테스트 포함 15개 테스트 |
| GREEN (전체) | `pnpm --filter api test` | PASS | 11 suites, 76 tests |
| Lint | `pnpm --filter api lint` | PASS | eslint 오류 0건 |
| Build | `pnpm --filter api build` | PASS | `nest build` 성공 |

## Test Specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | 6종 후보(전세권 예외 포함) 중 접수일 최선순위가 말소기준이 된다 | `domain/baseline-right.spec.ts` | unit | PASS |
| 2 | 건물 전부+배당요구 조건을 만족하지 못한 전세권은 말소기준 후보에서 제외된다 | `domain/baseline-right.spec.ts` | unit | PASS |
| 3 | 말소기준 후보가 없으면 명시적 오류를 던진다 | `domain/baseline-right.spec.ts` | unit | PASS |
| 4 | 담보물권·압류 계열은 말소기준 위치와 무관하게 항상 말소된다 | `domain/right-classification.spec.ts` | unit | PASS |
| 5 | 용익물권·가처분·가등기는 말소기준 이전이면 인수, 이후면 말소된다 | `domain/right-classification.spec.ts` | unit | PASS |
| 6 | 유치권·법정지상권·분묘기지권은 항상 NEEDS_REVIEW로 분류된다 | `domain/right-classification.spec.ts` | unit | PASS |
| 7 | 대항력 발생일 = 전입일 다음 날 0시(경계: 전입일=말소기준일 시 후순위) | `domain/tenant-priority.spec.ts` | unit | PASS |
| 8 | 배당요구종기 이후 배당요구는 효력이 없다 | `domain/tenant-priority.spec.ts` | unit | PASS |
| 9 | 담보물권 설정일(없으면 경매개시결정등기일) 기준으로 소액임차인 시행령을 조회한다 | `domain/small-deposit-tenant.spec.ts`, `domain/small-deposit-tenant-table.spec.ts` | unit | PASS |
| 10 | 경계: 시행령 개정일 당일 설정된 담보물권은 새 기준을 적용한다 | `domain/small-deposit-tenant-table.spec.ts` | unit | PASS |
| 11 | 최우선변제(소액임차인, 재원 부족 시 안분) → 우선변제(확정일자·등기접수일 순) 단순화 배당 | `domain/distribution.spec.ts` | unit | PASS |
| 12 | 대항력 없는 임차인은 배당을 받아도 인수액이 항상 0이다 | `domain/distribution.spec.ts` | unit | PASS |
| 13 | 총 부담액 = 입찰가 + 인수보증금 합계 | `domain/total-burden.spec.ts` | unit | PASS |
| 14 | 필수 필드 누락·잘못된 타입·화이트리스트 외 필드는 서비스 진입 전 차단된다 | `dto/validate-request.spec.ts` | unit | PASS |
| 15 | 01-discovery §1-3 기준 수작업 검증 시나리오 10건이 기대값과 일치한다 | `service/rights-analysis.service.spec.ts` + `test/fixtures/rights-analysis-scenarios.json` | integration | PASS |
| 16 | 출력 JSON 전수에서 판단·권유 문자열(추천/안전/위험/판단/권유 등) 0건 | `service/rights-analysis.service.spec.ts` | integration | PASS |
| 17 | saleAmount(낙찰대금) 미입력 시 배당 계산을 생략하고 NEEDS_REVIEW로 보류한다 | `service/rights-analysis.service.spec.ts` | integration | PASS |

## 소액임차인 최우선변제 연혁 (seed 데이터 출처)

- 대한법률구조공단: https://support.klac.or.kr/front/contents/07/006.do
- 국가법령정보센터 연혁(U-LEX): https://www.ulex.co.kr/법률/88530-004950-주택임대차보호법시행령
- 법제처 찾기쉬운 생활법령정보(2023-02-21 현행): https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=629&ccfNo=5&cciNo=2&cnpClsNo=2
- 1984~2023 전 구간 금액은 위 출처 간 완전 일치. 담보물권 설정일 기준 적용 원칙은 각 개정 부칙의 경과규정과 일치.

## Known Gaps

- **지역 티어 단순화**: 소액임차인 기준의 지역 구분을 자치구 단위가 아닌 4단계 티어(SEOUL/OVERCONCENTRATION/METRO/OTHER)로 단순화했다. 주소→티어 매핑은 이 모듈의 범위 밖(호출자 책임) — 향후 WP에서 행정구역 매핑 테이블이 필요하다.
- **2010~2016년 METRO 티어 세부 도시 목록 불확실**: 이 구간에 포함되는 정확한 시·군 목록은 출처마다 서술이 엇갈린다. 금액 자체는 신뢰도가 높으나, 이 구간의 지역 경계가 중요한 케이스는 law.go.kr 원문 재확인을 권장한다.
- **예상배당표는 단순화 버전**: 동순위 채권자 간 정밀 안분, 근저당권자 간 우선순위 세부 규칙 등은 v2 범위(작업지시서 §범위 제외)로 제외했다.
- **saleAmount 없이는 배당 불가**: 배당요구 효력이 있는 선순위 임차인은 낙찰대금 입력 전까지 NEEDS_REVIEW로 보류된다 — 실제 제품에서는 사용자가 입찰가를 입력하는 2단계 UX와 일치하는 설계 의도.
