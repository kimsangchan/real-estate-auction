# WP-06. RN 임장 체크리스트 화면 (웹 4화면 세트의 마지막 포팅)

- 상태: **구현 완료 — 검증 잔여 (2026-07-22 문서 보완)** — 구현은 `04e9ba2`(F-04 체크리스트 화면)에서 완료됐으나 상태 갱신이 누락됐었음. §2 자동 항목 통과 재확인(2026-07-22): jest 11건(ChecklistScreen 4케이스 포함)·tsc·lint. **잔여**: Gradle 리빌드, 에뮬레이터 E2E(force-stop 후 체크 상태 유지), 적대적 리뷰. | 선행: 없음
- 시작 전 필독: `AGENTS.md`, 이 문서 전체. 포팅 원본: `apps/web/app/items/[id]/checklist/page.tsx`

## 목적

웹 와이어프레임 4화면(물건상세·권리분석·위험상세·임장체크리스트) 중 모바일에 마지막으로 남은
임장 체크리스트를 RN으로 포팅한다. 체크 상태는 기기에 저장해 오프라인(현장 임장 중)에도
유지한다(F-04). 완료 시 모바일 화면 세트가 웹과 동등해진다.

## §0. 이미 준비된 것 (작업 트리에 uncommitted 상태로 있음 — 지우지 말 것)

| 항목 | 내용 |
|---|---|
| 의존성 | `@react-native-async-storage/async-storage@3.1.1` 설치됨 (`apps/mobile/package.json`). **네이티브 모듈 — 에뮬레이터 검증 전 Gradle 리빌드 필요** |
| jest 설정 | `apps/mobile/jest.config.js`의 `transformIgnorePatterns`에 async-storage 추가 + 구분자에 `_` 포함 (pnpm이 긴 패키지명을 `<pkg>_<hash>`로 축약하는 문제 — 이미 수정·검증됨) |
| 실패 테스트 | `apps/mobile/src/screens/ChecklistScreen.test.tsx` — **이 파일이 수용 기준의 진실원.** 현재 "Cannot find module './ChecklistScreen'"으로만 실패(의도됨). 기존 테스트 7건은 통과 확인됨 |
| 예시 데이터 | `apps/mobile/src/lib/rightsSample.ts`에 `SampleChecklistItem` + `sampleChecklistItems` 4건 추가됨 (웹 sample-data와 동일) |

## §1. 구현 요구사항

### 1-1. 화면: `apps/mobile/src/screens/ChecklistScreen.tsx` (신규)

테스트가 요구하는 **export 3개**: `ChecklistScreen`, `CHECKLIST_STORAGE_DB`, `CHECKLIST_STORAGE_KEY`.

- 저장소: `import { createAsyncStorage } from '@react-native-async-storage/async-storage'` —
  **v3 신 API를 쓴다** (default export는 legacy 마이그레이션용이라 금지).
  `const storage = createAsyncStorage(CHECKLIST_STORAGE_DB)` 모듈 레벨 1회.
  - `CHECKLIST_STORAGE_DB = 'auction-mobile'`, `CHECKLIST_STORAGE_KEY = 'auction-checklist:sample'`
    (물건별 키 분리는 실데이터 연동 시 — 범위 밖)
- 상태: `checked: Record<string, boolean>` + `loaded` 플래그.
  마운트 시 `storage.getItem` → `JSON.parse`(실패 시 빈 객체 폴백) → setChecked.
  **`loaded === true`가 된 뒤에만** 변경분을 `storage.setItem`으로 저장
  (웹 `page.tsx:26-34`와 동일 — 저장값을 빈 객체로 덮어쓰는 사고 방지).
  useEffect cleanup에서 unmount 후 setState 방지.
- 구성(위→아래), 카피는 웹에서 그대로 (임의 수정 금지):
  1. 예시 데이터 배너 — `RisksScreen.tsx`의 `sampleNote` 스타일 재사용
  2. 부제: "온라인으로 확인할 수 없는 항목이에요. 현장에서 하나씩 확인해보세요."
  3. 진행률 바: 트랙(`surfaceSoft`) + 채움(`primary`, width `%`) + 텍스트 `` `${done}/${total} 확인함` ``
  4. 카테고리 그룹(등장 순서 유지 — 현장 확인, 서류 확인): 그룹 제목 + 항목 카드
  5. 하단 안내: "체크한 내용은 이 기기에 저장되고 서버로 전송되지 않아요."
- 항목 카드: **`Pressable` 전체가 탭 영역**이며 테스트 계약상 반드시
  `accessibilityRole="checkbox"` + `accessibilityState={{ checked }}` +
  `accessibilityLabel`(항목 label 포함) + `onPress`(토글)를 가진다.
  커스텀 체크박스(RN에 네이티브 checkbox 없음): 테두리 사각형(`hairline` 2px, `radius.sm`),
  체크 시 `primary` 배경 + 흰 ✓ 텍스트. 체크 시 카드 배경 `surfaceSoft`,
  라벨 `textDecorationLine: 'line-through'` + `steel` 색 (웹 `itemChecked`/`itemLabelChecked` 대응).
  `fromRisk` 항목엔 `<Badge tone="critical" label="위험 감지" />` (`src/components/Badge.tsx` 재사용).
- 스타일: `src/theme.ts`의 `colors/radius/space/text` 토큰만 사용. 하드코딩 색 금지
  (그림자 `#000` 제외 — 기존 관례). 카드 그림자는 `RisksScreen.tsx`의 card 스타일과 동일 수치.
  스타일 구조는 `RisksScreen.tsx`를 모방(StyleSheet.create, screen/content 패턴).
- **판단·권유 문구 금지(D-011)** — 상태·사실 서술만. 테스트가 금지어를 검사한다.

### 1-2. 네비게이션

- `src/navigation.ts`: `RootStackParamList`에 `Checklist: undefined` 추가.
- `App.tsx`: `<RootStack.Screen name="Checklist" component={ChecklistScreen} options={{ title: '임장 체크리스트' }} />`
  (기존 Risks 등록 바로 아래).
- 진입점: `src/screens/RisksScreen.tsx`의 **각 위험 카드 안**, "다음 행동" 텍스트 아래에
  체크리스트로 가는 링크 추가 — 웹 `apps/web/app/items/[id]/risks/page.tsx:28-30`과 동일 위치.
  링크 문구(그대로): "임장 체크리스트에서 확인하기 →". RisksScreen이 현재 navigation prop을
  안 받으므로 `RightsAnalysisScreen.tsx:20`(`NativeStackScreenProps`) + `footnoteLink`
  Pressable 패턴(`RightsAnalysisScreen.tsx:178-182`)을 그대로 모방한다.
  기존 `RisksScreen.test.tsx`가 계속 통과해야 한다(문자열 추가는 무해).

## §2. 완료 기준 (전부 pass/fail — 순서대로 검증)

- [ ] `pnpm --filter @auction/mobile test` — ChecklistScreen 신규 4케이스 포함 전체 통과
- [ ] `npx tsc --noEmit` (apps/mobile) + `pnpm --filter @auction/mobile lint` 통과
- [ ] Gradle 리빌드(`cd apps/mobile/android && ./gradlew assembleDebug`) 성공 — async-storage 네이티브 링크
- [ ] 에뮬레이터 E2E (스크린샷 증거 필수): 물건상세 → 권리분석 → "확인이 필요해요" → 위험 화면 →
      체크리스트 진입 → 항목 2개 체크(진행률 2/4) → `adb shell am force-stop com.realestateauction.mobile`
      → 재실행 → 체크 상태 유지 확인
- [ ] 적대적 리뷰 1회(새 컨텍스트, diff + 이 완료 기준만 제공) 후 지적 반영
- [ ] 규칙 18 형식의 완료 보고 (AGENTS.md)

## §3. 이 레포의 알려진 함정 (위반 시 시간 낭비 — 반드시 먼저 읽기)

1. **Metro가 새 패키지를 못 찾으면** (`main 모듈을 못 찾음` 빨간 화면): `--reset-cache`로는 부족.
   `%TEMP%\metro-cache`와 `%TEMP%\metro-file-map-*`를 직접 삭제 후 Metro 재기동.
2. **에뮬레이터는 반드시 `-gpu host`로 기동** — `-gpu swiftshader_indirect`는 네이버 지도 타일
   렌더링 시 네이티브 크래시. AVD명 `AuctionTest`. 부팅 후 `adb shell getprop sys.boot_completed` 확인.
3. API 서버(`apps/api`, 포트 4000)와 Metro가 떠 있어야 상세 화면 실데이터가 보인다.
   에뮬레이터에서 호스트 접근은 `10.0.2.2:4000` (이미 `src/api/auctionItems.ts`에 반영됨).
4. Git Bash에서 `adb shell` 절대경로 인자는 `MSYS_NO_PATHCONV=1` 접두 필요.
5. PowerShell로 파일 쓸 때 UTF-8 BOM 주의 (`local.properties` 깨짐 전례).
6. jest에서 AsyncStorage mock은 테스트 파일 안 `jest.mock(..., () => require('@react-native-async-storage/async-storage/jest'))`
   방식 (이미 테스트에 있음). **jest.config에 `setupFiles`를 추가하면 RN 프리셋의 setupFiles를
   덮어써서 전체 테스트가 깨진다 — 금지.**

## 범위 제외

- 물건(caseNo)별 체크리스트 키 분리, 위험 플래그 → 항목 자동 생성(로드맵 1-3 파서 이후)
- 웹 화면 변경, iOS 설정, ItemDetail/RightsAnalysis에서의 추가 진입점
