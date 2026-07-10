# WP-07. 웹 지도 화면 (네이버 Web Dynamic Map + bbox API)

- 상태: 대기 | 선행: **사용자 액션 1건 (§0 — 미완이면 지도 타일 인증 실패)** | 담당 에이전트: (할당 시 기입)
- 시작 전 필독: `AGENTS.md`, 이 문서 전체. UX 참고 구현: `apps/mobile/src/screens/MapHomeScreen.tsx`(모바일 F-01 — 동일한 화면 문법을 웹으로)

## 목적

웹(apps/web)에 지도 기반 물건 탐색 화면을 추가한다. 모바일 지도 홈(F-01)과 동일한 문법 —
지도 이동 시 화면 범위(bbox) 재조회, "이 지역 N건" 배지, 클러스터/개별 마커, 고줌 가격 캡션,
마커 클릭 → 물건 상세 이동. 데이터 레이어(bbox API)는 이미 있으므로 프론트만 붙인다.

## §0. 사용자 액션 (착수 전 확인, 미완이면 §2-d에서 막힘)

- **NCP 콘솔 > Maps > Application에 Web 서비스 URL `http://localhost:3000` 등록.**
  모바일 때 Android 패키지명 등록과 동일한 인증 방식 — 미등록 시 지도가 401 인증 오류로 회색.
  (참고: 이 프로젝트의 `NCP_MAPS_*` 키는 유효함이 실호출로 검증돼 있음. 키 재발급 불필요.)
- 등록 전에도 §1 구현·단위 테스트·lint/build까지는 진행 가능. 지도 렌더 검증만 등록 후 가능.

## §1. 확정된 설계 결정 (재논의 금지 — 근거 포함)

1. **SDK**: 네이버 지도 Web Dynamic Map (JS v3). 스크립트 URL은
   `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId={클라이언트ID}` —
   이 프로젝트 키는 신 NCP 콘솔 키라서 `ncpKeyId` 파라미터/`oapi.map.naver.com` 도메인을 쓴다
   (구 `openapi.map.naver.com`+`ncpClientId`는 구 AI NAVER API용. 지오코딩에서 구 도메인이
   401로 폐기된 것을 이미 실확인함). 로드는 map 페이지 클라이언트 컴포넌트에서 next/script
   `<Script strategy="afterInteractive" onReady/onError>`로.
2. **클라이언트 ID 노출**: Web Dynamic Map의 클라이언트 ID는 설계상 공개값(URL 등록으로 보호).
   루트 `.env`의 `NCP_MAPS_CLIENT_ID` 값을 `apps/web` 실행 환경에서
   `NEXT_PUBLIC_NCP_MAPS_CLIENT_ID`로 노출한다. **값을 코드/리포에 하드코딩 금지** —
   `.env.example`에 키 이름만 추가하고 README 실행 방법에 한 줄 기재.
3. **CORS 회피 = Next rewrites 프록시**: `apps/api/src/main.ts`에 enableCors가 없음(확인됨).
   API를 건드리지 않고 `apps/web/next.config.ts`(신규 — 현재 next.config 파일 자체가 없음)에
   `rewrites: /api/:path* → ${API_BASE_URL}/:path*` 추가, 클라이언트는 동일 출처
   `/api/auction-items/bbox?...`로 호출한다. 기존 서버 컴포넌트 fetch(`api-client.ts`)는 무변경.
4. **bbox API 계약 (실호출 검증됨)**: `GET /auction-items/bbox?minLng=&minLat=&maxLng=&maxLat=`
   → 물건 배열(기존 필드 + `lng`/`lat`, `apps/api/src/auction-items/auction-items.repository.ts:39-40`).
   limit 500 고정. 필수 파라미터 4개 누락/NaN 시 400.
5. **클러스터링은 직접 구현(순수 TS 유틸)**: 네이버 JS API엔 내장 클러스터링이 없고, 공식
   예제 라이브러리(marker-tools.js)는 비유지보수 외부 스크립트라 배제. 화면 픽셀 그리드(80px)
   기반 그룹핑 유틸 `cluster.ts`를 만든다. **naver 전역에 의존하지 않도록 좌표→픽셀 변환 함수를
   파라미터로 주입**받게 설계한다(이래야 기존 테스트 인프라로 단위 테스트 가능 — §1-8).
6. **줌 게이팅**: zoom < 15 → 클러스터 버블(개수), zoom ≥ 15 → 개별 마커 + 가격 캡션.
   모바일 `CAPTION_ZOOM = 15`와 동일. 캡션 포맷터 `formatWonCompact`는
   `apps/mobile/src/lib/format.ts:13-20`을 `apps/web/app/items/format.ts`로 이식(+단위 테스트).
7. **마커/버블은 HTML 커스텀 아이콘**(`naver.maps.Marker`의 icon.content)로 그려 디자인 토큰을
   적용한다. 클릭: 개별 마커 → `/items/{encodeItemId(...)}` 라우팅(`item-id.ts` 재사용),
   클러스터 버블 → 한 단계 줌인.
8. **파일 구성**:
   - `apps/web/app/items/map/page.tsx` — 서버 컴포넌트: metadata(title "경매 지도") + MapView 렌더
   - `apps/web/app/items/map/MapView.tsx` — 'use client': 스크립트 로드·지도 초기화·idle 재조회
   - `apps/web/app/items/map/cluster.ts` + `cluster.test.ts` — 순수 클러스터링 유틸
   - `apps/web/app/items/map/page.module.css` — 스타일(토큰만)
   - `/items`·`/items/browse` 상단에 "지도로 보기" 링크 (기존 링크 문법 모방)
9. **동작 흐름**: 초기 카메라 서울시청(37.5665, 126.9780) zoom 12 → `idle` 이벤트마다
   (debounce 300ms) `map.getBounds()`로 bbox 계산 → `/api/auction-items/bbox` 조회 →
   "이 지역 N건" 배지 갱신 + 마커 재계산. `lng`/`lat`가 null인 물건은 제외.
10. **상태 3종 필수**: 지도 스크립트 로드/인증 실패(안내+재시도), bbox 조회 실패(배지 자리에
    에러 배너), 0건("이 지역 0건" — 빈 지도도 정상 상태). 로딩 중엔 배지에 조회 중 표시.
11. **디자인 (frontend-design-taste 하드룰)**: design-tokens CSS 변수만(하드코드 색 금지),
    모든 숫자(캡션·배지 개수)는 `--font-mono` + `tabular-nums`(`globals.css` 기존 토큰),
    그림자는 `--shadow-sm/md`, 순수 #000 금지, 애니메이션 쓰면 transform/opacity만.
    카피는 모바일과 동일("이 지역 N건") — 필러 문구 금지.

## §2. 완료 기준 (전부 pass/fail — 순서대로)

- [ ] a. 단위 테스트: `cluster.ts`(그룹핑·그리드 경계·단일 항목·빈 배열) + `formatWonCompact`
      (억/만 조합 4케이스 — 모바일 `format.test.ts` 참고) — 기존 `tsconfig.test.json` 방식으로
      `pnpm --filter @auction/web test` 통과 (기존 8건 + 신규)
- [ ] b. `pnpm -r lint && pnpm -r build` 통과 (next build가 신규 라우트 포함 성공)
- [ ] c. rewrites 프록시 동작: dev 서버에서 `curl localhost:3000/api/auction-items/bbox?...` → 200
- [ ] d. 브라우저 검증 (Playwright MCP): `localhost:3000/items/map` 접속 →
      **이 머신에서 스크린샷 도구는 5초 타임아웃으로 항상 실패하니 쓰지 말 것** — 대신
      `browser_snapshot`(a11y 트리)으로 "이 지역 N건" 배지 텍스트 확인,
      `browser_evaluate`로 ① 마커 DOM 개수 ≥ 1 ② 배지 computed style fontFamily에 mono 포함
      ③ 지도 이동(`map.panBy` 호출) 후 배지 숫자 변경 확인
- [ ] e. 마커 클릭 → 물건 상세로 이동 (browser_click 또는 evaluate로 검증)
- [ ] f. 적대적 리뷰 1회(새 컨텍스트, diff + 이 완료 기준만) 후 지적 반영
- [ ] g. 규칙 18 형식 완료 보고. §0 미완으로 d~e가 막혔으면 "사용자 액션 대기"로 명시 보고

## §3. 이 레포의 알려진 함정

1. 웹 dev 서버가 이미 3000에 떠 있을 수 있음 — 중복 `next dev`는 스스로 종료됨. 그대로 3000 사용.
   API(4000)·DB(55432 docker)가 안 떠 있으면 bbox가 빈 배열이 아니라 fetch 실패가 된다.
2. Playwright MCP 스크린샷 금지(§2-d 참고) — `browser_evaluate`/`browser_snapshot`으로 단언.
3. apps/web 테스트 인프라는 JSX 없는 순수 TS만 가능(`tsconfig.test.json`) — 그래서 클러스터
   로직을 컴포넌트 밖 순수 함수로 분리하는 것(§1-5). MapView 자체의 단위 테스트는 시도하지 말 것.
4. naver maps 타입: `@types/navermaps`가 npm에 있으면 devDependency로 추가해 사용, 없거나
   버전이 안 맞으면 이 화면에서 실제로 쓰는 API만 담은 최소 타입 선언(`naver-maps.d.ts`)을
   map/ 폴더에 직접 작성(전역 `any` 금지 — ESLint `no-explicit-any: error`가 걸려 있음).
5. 커밋 전 pre-push 훅이 전체 모노레포 lint/test/build를 돌린다 — 로컬에서 미리 `pnpm -r build`로
   확인해 훅 타임아웃 낭비를 줄일 것.

## 범위 제외

- 지적편집도·필터·검색(지역 드릴다운과의 연결은 후속), 웹-모바일 지도 코드 공유,
  클러스터 전환 애니메이션, 모바일 웹 최적화(반응형 기본만), SSR 지도 렌더링, API CORS 설정 변경.
