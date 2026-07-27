# WP-08b. 모바일 로그인·관심 탭 + 웹 세션 자동 연장 (로드맵 2-6 2/3)

- 상태: **진행 중 (2026-07-27)** — 구현 전부 완료(서버·웹·모바일), §2-a~c 통과. 남은 것은 실행 검증뿐:
  §2-d~g E2E(에뮬레이터·실계정 필요)와 §2-h 적대적 리뷰
- 시작 전 필독: `AGENTS.md`, 이 문서 전체, `WP-08-auth-favorites.md`(§1 설계·§3 함정·후속/보류 항목), `06-tech-blueprint.md` §5(보안)

## 목적

모바일 앱에서 로그인과 관심 등록/해제/목록(F-06)을 완성하고, 웹은 액세스 토큰(15분) 만료 후에도
리프레시로 세션이 이어지게 한다(WP-08 보류분 — 14일 세션 의도 실현). 스토어 심사 요건인
회원 탈퇴를 서버 API + 모바일 화면으로 함께 넣는다. 비로그인 탐색·권리분석 열람은 웹·모바일
모두 그대로 유지한다 (T-04).

## §0. 사용자 액션 (착수 전 확인)

1. **루트 `.env`에 `OAUTH_STATE_SECRET` 추가** — 임의 랜덤 문자열(32자 이상). WP-08 보류 항목
   "state 서명 시크릿 분리"(RFC 8725 §3.5)를 이번에 이행한다. 미설정 시 부팅 검증에서 기동 중단.
2. 카카오·네이버 **콘솔 추가 등록은 불필요** — 모바일도 시스템 브라우저로 서버 시작 URL을 열므로
   provider가 보는 Redirect URI는 WP-08에서 등록한 서버 콜백 그대로다. 서버→앱 딥링크 구간은
   우리 서버 소관이라 콘솔과 무관하다.
3. 에뮬레이터(AVD `AuctionTest`)·JDK 21은 WP-06에서 구성 완료 — 그대로 사용.

## §1. 확정된 설계 결정 (재논의 금지 — 근거 포함)

1. **모바일 OAuth 플로우 (RFC 8252 — 네이티브 앱 OAuth 표준)**: 인앱 WebView 금지, **시스템 브라우저
   + 커스텀 스킴 딥링크 + 일회성 교환 코드 + PKCE**.
   - 앱: 랜덤 `codeVerifier` 생성 → 브라우저로 `{웹오리진}/api/auth/{provider}?client=mobile&codeChallenge=S256(verifier)` 열기(`Linking.openURL`)
   - 서버: state 페이로드에 `client`·`codeChallenge` 포함(기존 returnTo와 같은 서명 방식, 시크릿은 §0-1 신규 키)
   - 콜백: `client=mobile`이면 쿠키 대신 **일회성 교환 코드**(HS256 서명, typ=`mobile_exchange`, TTL 60초,
     jti 1회용 — 인메모리 소모 집합, 단일 인스턴스 MVP라 충분·재기동 시 진행 중 로그인만 무효) 발급
     → `auction://auth/callback?code=…` 302
   - 앱: 딥링크 수신 → `POST /auth/mobile/token` `{ code, codeVerifier }` → `{ accessToken, refreshToken }` JSON.
     서버는 S256(codeVerifier)와 state의 codeChallenge 일치를 검증 — **스킴 하이재킹 앱이 코드를
     가로채도 verifier 없이는 교환 불가** (RFC 8252 §8.1 근거, PKCE 도입 이유).
   - **시작 URL은 반드시 웹 오리진 프록시 경로**(`/api/auth/…`)로 연다 — state 쿠키가 웹 오리진에
     저장돼야 콜백(같은 오리진)에서 검증된다. API 포트(4000)로 직접 열면 state 불일치로 실패 (§3-1).
2. **앱 스킴**: `auction://` — AndroidManifest `MainActivity`(launchMode `singleTask`)에 intent-filter 추가.
   iOS는 이번 범위 제외(Windows 환경 — WP-01b와 동일한 조건부 조항).
3. **모바일 토큰 저장**: `react-native-keychain` 신규 의존성 — 리프레시 토큰은 Keystore 보관,
   액세스 토큰은 메모리만 (AGENTS 규칙 8). **AsyncStorage에 토큰 저장 금지**(평문 파일이라 루팅·백업
   추출에 노출). 네이티브 의존성이므로 Gradle 재빌드 필요 (§3-5).
4. **모바일 API 인증**: `Authorization: Bearer` 헤더 — guard는 WP-08에서 쿠키·헤더 겸용으로 이미
   구현됨(서버 무변경). `apps/mobile/src/api/`에 인증 세션 모듈 1개: 401 응답 시 리프레시 1회 →
   원요청 재시도 → 그래도 실패면 로그아웃 상태 전환. 새 fetch 헬퍼 난립 금지 — 기존
   `auctionItems.ts` 문법에 맞춰 확장.
5. **서버 확장 (기존 auth 모듈 국소 변경 — 새 모듈 금지)**:
   - `POST /auth/refresh`·`POST /auth/logout`: 쿠키 없으면 body `{ refreshToken }` 수용(DTO 추가).
     refresh 응답에 `refreshToken`(회전분)도 포함 — 모바일이 Keystore 갱신용. 웹 쿠키 동작은 무변경.
   - `POST /auth/mobile/token`: §1-1 교환 코드 → 토큰 쌍. 실패 사유(만료·재사용·verifier 불일치)는
     401 통일(구체 사유는 로그만 — 규칙 8).
   - `DELETE /auth/me` (JWT guard): `app_user` 삭제 — `refresh_token`·`favorite`는 FK `ON DELETE CASCADE`
     확인 완료(마이그레이션 002). 새 마이그레이션 불필요.
   - state 서명을 `OAUTH_STATE_SECRET`으로 교체 (§0-1, env 스키마 검증 추가).
6. **모바일 UI (화면 신설 최소 — Login·Favorites 2개 + ItemDetail 수정)**:
   - 하단 탭에 **관심** 탭 추가(`TabParamList` 확장). 비로그인 시 탭 내용은 로그인 안내 + 로그인 버튼
     (탭 진입 자체는 막지 않음 — T-04).
   - `ItemDetail`에 관심 등록/해제 버튼 — 웹 `FavoriteButton`과 동일 로직·문구(사실 서술만, D-011).
     비로그인 클릭 시 Login 화면으로.
   - `Login` 화면: 카카오·네이버 버튼(각 브랜드 가이드), 로그인 후 원화면 복귀.
   - 계정 영역 신설 금지 — 관심 탭 상단에 닉네임·로그아웃·회원 탈퇴 진입을 최소 배치.
     탈퇴는 확인 다이얼로그(사실 서술: "관심 목록과 계정 정보가 즉시 삭제돼요") 후 `DELETE /auth/me`.
   - 스타일은 디자인 토큰만(`@auction/design-tokens` — WP-05·frontend-design-taste 하드룰 유지).
7. **웹 세션 자동 연장 (Next middleware — WP-08 보류분 결론)**:
   - `apps/web/middleware.ts` 신설: 페이지 요청에 `access_token` 쿠키가 없고 `refresh_token`이 있으면
     API `/auth/refresh` 호출(쿠키 전달) → 응답 `Set-Cookie`를 그대로 복사 → 요청 계속.
     matcher는 페이지 경로만(`/api`·`_next`·정적 리소스 제외 — `/api` 포함 시 리프레시 재귀 주의, §3-6).
   - **refresh 쿠키 `Path=/` 유지 확정** — middleware가 페이지 요청에서 refresh 쿠키를 받아야 하므로
     Path 축소 불가. WP-08 보류 항목("Path 축소는 방식 확정 후") 종결.
   - 클라이언트 fetch 401 보강: 웹 api-client에서 401 → `/api/auth/refresh` 1회 → 원요청 재시도
     (페이지 로드 후 15분 이상 머문 탭의 관심 버튼 대비). 재시도 무한루프 금지 — 1회 한정.
8. **판단·권유 문구 금지(D-011) 유지**: 알림 약속 카피는 여전히 금지 — 푸시는 WP-09에서 동작한 뒤에.

## §2. 완료 기준 (전부 pass/fail — 순서대로)

- [x] a. API 테스트: 교환 코드 발급·소모(재사용 거부·TTL 만료·verifier 불일치 401), refresh/logout
      body 수용·회전, `DELETE /auth/me` 캐스케이드(favorite·refresh_token 잔존 0), state 신규 시크릿
      서명·구 시크릿 거부 — `pnpm --filter @auction/api test` 전체 통과
- [x] b. 모바일 테스트: 로그인 상태 전환, 관심 탭 목록/빈 상태/해제, 401→리프레시 재시도 1회 한정,
      딥링크 파싱 — `pnpm --filter @auction/mobile test` 통과 (53건)
- [x] c. `pnpm -r lint && pnpm -r test && pnpm -r build` 통과 (+ Gradle assembleDebug 통과 —
      네이티브 의존성 2종 autolink 확인, 에뮬레이터 기동 무크래시 확인)
- [ ] d. 모바일 E2E (AVD, §3-1 adb reverse 선행): 관심 탭 → 로그인 → 브라우저 카카오 실계정 →
      딥링크 복귀 → 물건 상세 관심 등록 → 관심 탭 표시 → 해제 → **앱 강제종료 후 재실행 시 세션
      유지**(Keystore 리프레시 동작) 확인. 네이버는 배선만(웹 WP-08과 동일 기준)
      — **사용자 액션 대기: 카카오 실계정 로그인 필요** (앱→시스템 브라우저 핸드오프까지는 확인)
- [x] e. 웹 자동 연장 E2E: 리프레시 쿠키만 남긴 요청 → 같은 응답에서 닉네임 렌더 + 새 액세스 쿠키
      발급 확인. 추가로 **동시 요청 6건 회귀 확인**(세션 종료 0건 — 적대적 리뷰 finding #1)
- [x] f. 회원 탈퇴: 실 DB 대조로 `app_user`·`favorite`·`refresh_token` 1/1/7 → 0/0/0, 이후 `/auth/me` 401.
      (모바일 화면 경로는 단위 테스트만 — 기기 확인은 d와 함께)
- [x] g. 비로그인 회귀 (T-04): 웹 공개 6화면 전부 200(`/favorites`만 의도대로 로그인 유도),
      모바일은 에뮬레이터에서 지도·목록·관심 탭 무로그인 접근 확인
- [x] h. 적대적 리뷰 2회(보안·정합성, 각각 새 컨텍스트) 후 지적 반영 — Critical 1건(동시 리프레시로
      인한 세션 종료) 포함 실수확 다수 수정. **미결 결정 사항은 §4 참고**
- [ ] i. 규칙 18 형식 완료 보고. §0-1 미이행으로 막히면 "사용자 액션 대기" 명시 보고

## §3. 이 레포의 알려진 함정

1. **에뮬레이터 로그인 E2E는 `adb reverse tcp:3000 tcp:3000` + `adb reverse tcp:4000 tcp:4000` 필수** —
   카카오 등록 Redirect URI가 `localhost:3000`이라 에뮬레이터 브라우저의 localhost가 호스트로
   포워딩돼야 콜백이 닿는다(10.0.2.2로는 불가). 앱이 여는 로그인 시작 URL도 같은 이유로
   `http://localhost:3000/api/auth/…`(웹 오리진)이어야 한다 — 단 앱의 일반 API 호출은 기존
   10.0.2.2:4000 유지(브라우저 밖이라 무관).
2. Android Chrome이 302→커스텀 스킴 리다이렉트를 차단하는 버전이 있다 — 차단 시 콜백 응답을
   "앱으로 돌아가기" 버튼이 있는 중간 페이지(같은 딥링크 href)로 폴백할 것. 사용자 제스처가 있으면 통과.
3. 전역 `ValidationPipe({ whitelist, forbidNonWhitelisted })` — refresh/logout body DTO, mobile/token DTO,
   시작 쿼리의 `client`·`codeChallenge`를 전부 DTO에 명시할 것 (WP-08 §3-4와 동일 함정).
4. Playwright MCP 스크린샷은 5초 타임아웃으로 실패 — `browser_snapshot`/`browser_evaluate`로 단언.
5. 네이티브 의존성 추가 후 Gradle 재빌드 필요 — JAVA_HOME이 Java 6을 가리키면 wrapper가 죽는다.
   JDK 21 경로 지정 (WP-06 §3 함정 재발 방지). 또한 Gradle 캐시가 2026-07-23 정리돼 첫 빌드는
   의존성 재다운로드로 오래 걸린다.
6. Next middleware matcher에 `/api`가 포함되면 리프레시 호출이 middleware를 재귀 트리거할 수 있다 —
   matcher에서 `/api`·`/_next`·정적 파일 제외. middleware의 API 호출 대상은 프록시가 아닌
   API 오리진(`http://localhost:4000`) 직접 — Next 자기 자신 경유 금지(데드락·중복 Set-Cookie).
7. pre-push 훅이 전체 모노레포 lint/test/build를 돌린다 — 커밋 전 `pnpm -r build`로 미리 확인.

## §4. 적대적 리뷰 후 남은 결정 사항 (2026-07-27, 사용자 판단 필요)

1. **리프레시 재사용 감지가 서버에서 무효 상태** (WP-08 `dd650de`부터의 선행 버그).
   `auth.service.ts`의 재사용 분기가 `revokeFamily()` 직후 `throw`해서 `withTransaction`이
   `ROLLBACK`을 건다 → 계열 폐기가 저장되지 않는다. 고치면 제어는 살아나지만, 브라우저
   클라이언트 리프레시와 미들웨어 리프레시가 다른 프로세스에서 겹칠 때 정상 사용자가
   로그아웃된다. 정석 해법은 "직전 회전 후 N초 안의 재제출은 경쟁으로 보고 계열을 폐기하지 않음"
   (유예 창)인데, 이는 도난 탐지를 일부 약화시키는 보안 트레이드오프라 임의로 넣지 않았다.
2. **`auction://` 스킴 하이재킹** (RFC 8252 §8.6). 악성 앱이 같은 스킴을 등록하고 자기 PKCE로
   흐름을 시작하면 피해자 계정의 교환 코드를 가로챌 수 있다. PKCE로는 못 막고, 해법은 검증된
   App Links(https + `assetlinks.json`) — 실도메인이 필요하다. **스토어 제출 전 필수.**
3. **iOS `CFBundleURLTypes` 미등록** — iOS는 애초에 범위 밖(Mac 없음)이지만, 딥링크가 없으면
   교환 코드가 Safari에 남는다. iOS 착수 시 최우선.
4. **릴리스 설정 부재** — `WEB_ORIGIN`/`API_BASE_URL`이 localhost 하드코딩이고
   `usesCleartextTraffic=true`라 릴리스 빌드는 평문으로 토큰을 보낸다. 빌드 변형별 주소 주입 +
   cleartext 허용 목록 축소 필요.
5. **교환 코드 1회용 보장이 프로세스 지역적** — 인스턴스 2대가 되는 순간 무효(§1-1에 명시된 MVP
   전제). 스케일아웃 전 Postgres로 옮기거나 부팅 시 경고 필요.
6. **새 미인증 엔드포인트에 rate limiting 없음** — `/auth/:provider`, `/auth/refresh`,
   `/auth/mobile/token`.

## 범위 제외

- 푸시·변동 감지(WP-09 — "알림 E2E 1건"은 거기서), 네이버 실계정 E2E(배선만 — 웹과 동일 기준),
  iOS(macOS 필요 — WP-01b 조건부 조항), 익명 앱 토큰·rate limiting(로드맵 3-2),
  마케팅 푸시 동의(T-07 — WP-09), 애플 로그인(D-015 유지).
