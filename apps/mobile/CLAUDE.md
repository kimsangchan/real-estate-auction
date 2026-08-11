# apps/mobile/ — 스코프 작업 지침

이 폴더의 파일을 다룰 때만 로드된다(온디맨드). 공통 행동규칙은 루트 `CLAUDE.md`,
프로젝트 표준·구현기준 22개는 `AGENTS.md`, 다음-할일은 `NEXT.md`를 따른다.

## 목표

React Native 0.86 앱. 물건 체크리스트·권리분석·위험 요약·즐겨찾기·푸시 알림.

## 소유 경로

`src/{api,auth,components,lib,notifications,screens}`
읽기 전용 입력: `packages/design-tokens`(시각 토큰), `apps/api`(HTTP 계약).

## 핵심 관례

- **`@react-native` eslint config에 prettier 규칙이 포함돼 있다.** 포맷이 어긋나면 `lint`가 실패한다.
  파일을 만들거나 고친 뒤 반드시 prettier를 적용할 것 (`.prettierrc.js`: `arrowParens: avoid`,
  `singleQuote`, `trailingComma: all`, printWidth 기본 80). 이걸 놓쳐 `4c7cbff`에서 lint가 깨져 있었다.
- 테스트는 jest (`@react-native/jest-preset`). 화면 테스트는 `react-test-renderer`.
- 훅 의존성에 인라인 객체를 그대로 걸지 않는다 — 원시값으로 분해해서 건다(매 렌더 재조회 방지).
- 시각 토큰은 `@auction/design-tokens` 참조. 스타일 값 하드코딩 금지.
- 사용자 대면 문구: 해요체, 능동형, 긍정형. 권리분석에 판단·권유 표현 금지 (D-011).

## 검증

```
pnpm --filter @auction/mobile lint && pnpm --filter @auction/mobile test
```
화면 변경은 단위 테스트로 끝나지 않는다 — 에뮬레이터 실기 확인까지 해야 완료다.
