# WP-01b. React Native 모바일 골격 (WP-01에서 분리)

- 상태: 대기 | 선행: WP-01(완료) | 담당 에이전트: (할당 시 기입)
- 시작 전 필독: `AGENTS.md`, `decision-log.md` D-004

## 목적
`apps/mobile`에 React Native 0.86 앱 골격을 만든다. Android와 iOS를 모두 1급 지원 대상으로 두고, 플랫폼별 분기는 네이티브 경계와 지도 SDK 어댑터에만 제한한다. WP-01에서 분리된 이유: Android SDK/JDK/에뮬레이터와 Xcode/iOS Simulator 등 네이티브 도구 체인 준비가 필요.

## 요구사항
1. 사전 확인:
   - Android: Android Studio + SDK, JDK 17+ 설치 여부 확인 후 없으면 설치 안내를 먼저 보고
   - iOS: macOS 환경이면 Xcode + iOS Simulator + CocoaPods 확인. Windows 환경에서는 iOS 빌드를 직접 수행하지 못하므로 iOS 프로젝트 파일 생성·정적 검증까지만 수행하고, 실제 구동은 macOS 빌드 머신에서 검증하도록 기록
2. `npx @react-native-community/cli init` 기반 TypeScript 템플릿 → 모노레포 워크스페이스로 편입 (pnpm 호환 — metro의 심링크 이슈 확인)
3. `tsconfig.base.json` 상속, ESLint `no-explicit-any: error` (규칙 19)
4. 초기 화면 1개 ("준비 중이에요") + 단위 테스트 1개
5. `@auction/shared` 타입 import 스모크 (모노레포 연결 확인)
6. 플랫폼 공통 UI·상태·도메인 로직은 TypeScript 공통 코드로 작성하고, 플랫폼별 코드는 `*.android.*` / `*.ios.*` 또는 네이티브 모듈 경계에서만 허용

## 완료 기준
- [ ] Android 에뮬레이터(또는 실기기)에서 초기 화면 구동 스크린샷
- [ ] iOS Simulator에서 초기 화면 구동 스크린샷. 단, Windows 작업 환경에서는 "iOS 프로젝트 생성 + lint/test 통과 + macOS 검증 필요"를 명시하면 조건부 통과
- [ ] `pnpm --filter @auction/mobile lint && test` 통과
- [ ] 규칙 18 보고

## 비고
지도 SDK(네이버) 네이티브 래핑은 Phase 2 별도 WP — 이번엔 순수 골격만. 지도 어댑터는 Android/iOS 구현체를 분리하되 앱 화면 API는 동일하게 유지한다.
