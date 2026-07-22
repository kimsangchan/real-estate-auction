# WP-08. 소셜 로그인 + 관심 물건 — 서버·웹 (로드맵 2-6 1/3)

- 상태: 대기 | 선행: **사용자 액션 2건 (§0 — 미완이면 §2-d 로그인 E2E가 막힘)** | 담당 에이전트: (할당 시 기입)
- 시작 전 필독: `AGENTS.md`, 이 문서 전체, `06-tech-blueprint.md` §5(보안), `decision-log.md` 소셜 로그인 결정(카카오 OIDC·네이버·애플 + RFC 8725 JWT)

## 목적

관심 등록(F-06)의 전제인 계정·인증 기반을 만들고, 웹에서 관심 물건 등록/해제/목록까지 잇는다.
비로그인 탐색·권리분석 열람은 그대로 유지하고 **관심 등록만 로그인을 요구**한다 (T-04 진입 방해 금지).

로드맵 2-6(소셜 로그인+관심+푸시)은 한 WP로 과대해 WP-01/01b 전례대로 3분할한다:
**WP-08(본 문서: 서버+웹) → WP-08b(모바일 로그인·관심 탭) → WP-09(푸시: 변동 감지+FCM, "알림 E2E 1건"은 여기서 달성)**.
후속 문서는 본 WP 완료 후 작성한다 (빈 문서 선작성 금지 — AGENTS 규칙 14).

## §0. 사용자 액션 (착수 전 확인)

1. **카카오 개발자 콘솔(developers.kakao.com) 앱 등록** — 2025 개편 후 새 콘솔 경로 기준(2026-07-22 실확인):
   - 카카오 로그인 > 사용 설정 ON → 카카오 로그인 > OpenID Connect ON
   - **앱 > 플랫폼 키 > REST API 키** 안에서 "카카오 로그인 리다이렉트 URI"
     `http://localhost:3000/api/auth/kakao/callback` 등록 + 클라이언트 시크릿 발급
     (구 콘솔의 "카카오 로그인 > 보안"·"플랫폼" 메뉴는 없어짐 — 플랫폼 키 메뉴로 통합)
   - 카카오 로그인 > 동의항목 → 닉네임만 (이메일·전화 수집 안 함 — A-08 개인정보 최소화)
   - **함정**: "대표 도메인"은 localhost 거부 — 필수 아님, 비워둘 것. "사이트 도메인"(웹 도메인)은
     JS SDK용이라 서버 사이드 REST 방식엔 불필요. localhost가 필요한 곳은 Redirect URI뿐이고 여기는 허용.
2. **네이버 개발자 센터(developers.naver.com) 앱 등록**: Client ID/Secret 발급, 서비스 URL
   `http://localhost:3000`, Callback URL `http://localhost:3000/api/auth/naver/callback` 등록. 제공 항목: 별명만.
3. 발급 키를 루트 `.env`에 기입 (키 이름은 §1-7). **값을 코드·리포·채팅에 붙여넣지 말 것** (AGENTS 규칙 8).
- 등록 전에도 §1 마이그레이션·JWT·guard·favorites API 구현과 단위 테스트까지는 진행 가능. 로그인 E2E만 등록 후 가능.

## §1. 확정된 설계 결정 (재논의 금지 — 근거 포함)

1. **제공자 범위 (D-015, 2026-07-22 사용자 확정)**: **카카오+네이버 2종만** 구현한다. 애플 로그인은
   계획에서 제외 — 단 iOS 출시 시점(로드맵 3-3)에 Apple 지침 4.8(서드파티 소셜 로그인 제공 시
   Sign in with Apple 의무) 재검토 필요. 서버는 provider 어댑터 구조로 짜서 추후 추가가 국소 변경이 되게만 한다.
2. **플로우**: OAuth2 Authorization Code (서버 사이드). 웹 브라우저 → `GET /auth/{provider}` (state 발급·서명 쿠키 저장)
   → provider 동의 → `GET /auth/{provider}/callback?code&state` (state 검증) → 토큰 교환·프로필 조회 → 자체 JWT 발급.
   **카카오는 OIDC**(id_token 검증 — iss/aud/nonce), **네이버는 OIDC 미지원**이므로 OAuth2 + 프로필 API(`/v1/nid/me`)로 통일된
   `{ provider, providerUserId, nickname }`을 뽑는 provider 어댑터 인터페이스를 둔다.
3. **JWT (RFC 8725 준거, 06 §5)**: 액세스 15분 + 리프레시 14일 회전(rotation). HS256 단일 키(단일 서버 MVP —
   키 분리가 필요해지는 다중 서비스 시점에 RS256 전환), `alg` 고정 검증, iss/aud 고정. 리프레시는
   `refresh_tokens` 테이블에 해시 저장 — **재사용 감지 시 해당 유저 토큰 계열 전체 폐기** (탈취 대응, 서버측 폐기 목록 결정 이행).
4. **토큰 전달**: 웹은 **httpOnly 쿠키** (`SameSite=Lax`, dev는 Secure 생략) — Next rewrites 프록시로 동일 출처라
   CORS·쿠키 도메인 이슈 없음(WP-07 §1-3에서 확인된 구조 재사용). 모바일(WP-08b)은 Authorization 헤더 —
   guard는 쿠키·헤더 둘 다 수용하게 처음부터 작성한다.
5. **DB (마이그레이션은 기존 러너 재사용)**: `tools/collector/migrations/002_users_favorites.sql` —
   러너·SQL 마이그레이션 방식이 collector에 이미 있으므로 새 도구를 들이지 않는다 (AGENTS 규칙 1).
   - `app_user(id uuid pk, provider text, provider_user_id text, nickname text, created_at)` + `unique(provider, provider_user_id)`
   - `refresh_token(id uuid pk, user_id fk, token_hash text unique, family_id uuid, expires_at, revoked_at nullable, created_at)`
   - `favorite(user_id fk, court_office_code, case_no, item_no, created_at, pk(user_id, court_office_code, case_no, item_no))`
     — 물건 참조는 `auction_item`의 자연키 3콤보(기존 상세 라우팅 `encodeItemId`와 동일 키 체계)
6. **API (NestJS 기존 구조 — module/controller/service/repository/dto, 전역 ValidationPipe)**:
   - `auth` 모듈: `GET /auth/{provider}`, `GET /auth/{provider}/callback`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`
   - `favorites` 모듈(JWT guard): `GET /favorites`, `PUT /favorites/:courtOfficeCode/:caseNo/:itemNo`, `DELETE /favorites/:courtOfficeCode/:caseNo/:itemNo`
   - **기존 공개 조회 API는 무변경** — 비로그인 탐색 유지 (T-04). 익명 앱 토큰·rate limit은 Phase 3-2 범위.
7. **env (부팅 시 스키마 검증 — 기존 `config/env.ts` 확장, 실패 시 기동 중단)**: `AUTH_JWT_SECRET`,
   `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `AUTH_WEB_ORIGIN`(기본 `http://localhost:3000`).
   `.env.example`에 키 이름만 추가.
8. **웹 UI (apps/web, 디자인 토큰만 — WP-05·frontend-design-taste 하드룰 유지)**:
   - 물건 상세에 관심 등록/해제 버튼(로그인 상태), 비로그인 클릭 시 로그인 화면 `/login`으로 (되돌아올 경로 유지)
   - `/login`: 카카오·네이버 버튼 2개 (각 브랜드 가이드 준수), `/favorites`: 관심 목록(기존 목록 카드 문법 재사용)
   - 헤더/내비에 로그인 상태 표시는 최소(닉네임+로그아웃) — 화면 신설 최소화 (AGENTS 규칙 22)
   - **공용 컴포넌트·유틸 중복 점검 먼저** — 기존 `api-client.ts`·카드·배지 재사용, 새 fetch 헬퍼 만들지 말 것
9. **판단·권유 문구 금지(D-011) 유지**: 관심 등록 유도 카피도 사실 서술만 ("관심 등록하면 기일 변경 알림을 받아요"는
   WP-09 전이므로 아직 금지 — 알림 약속 카피는 푸시가 실제 동작할 때 추가).

## §2. 완료 기준 (전부 pass/fail — 순서대로)

- [ ] a. 마이그레이션 002 적용·재실행 멱등 확인 (기존 러너)
- [ ] b. API 단위/통합 테스트: JWT 발급·검증·만료, 리프레시 회전·**재사용 감지 시 계열 폐기**, state 불일치 거부,
      guard(쿠키·헤더), favorites CRUD·중복 등록 멱등·타 유저 격리 — `pnpm --filter @auction/api test` 전체 통과
- [ ] c. `pnpm -r lint && pnpm -r build` 통과
- [ ] d. 로그인 E2E (Playwright MCP, §0 완료 후): `/login` → 카카오 실계정 로그인 1회 → 쿠키 세션 확인 →
      물건 상세에서 관심 등록 → `/favorites`에 표시 → 해제 → 목록에서 제거. 네이버는 콜백까지만 확인해도 됨
- [ ] e. 비로그인 회귀: 지도·목록·상세·권리분석 전부 무로그인 접근 가능 (T-04) — 기존 화면 라우트 4개 열어 확인
- [ ] f. 적대적 리뷰 1회(새 컨텍스트, diff + 이 완료 기준만) 후 지적 반영
- [ ] g. 규칙 18 형식 완료 보고. §0 미완으로 d가 막혔으면 "사용자 액션 대기"로 명시 보고

## §3. 이 레포의 알려진 함정

1. Playwright MCP 스크린샷은 5초 타임아웃으로 실패한다 — `browser_snapshot`/`browser_evaluate`로 단언 (WP-07 §2-d와 동일).
2. 웹 dev 서버·API·DB 기동 상태 확인: API는 루트 `.env`를 `main.ts`의 dotenv 다중 경로로 읽는다. DB는 `docker compose up -d`.
3. pre-push 훅이 전체 모노레포 lint/test/build를 돌린다 — 커밋 전 `pnpm -r build`로 미리 확인.
4. 전역 `ValidationPipe({ whitelist, forbidNonWhitelisted })`가 켜져 있다 — 콜백 쿼리 DTO에 없는 파라미터가 오면 400이
   나므로 provider가 붙이는 추가 쿼리(예: 카카오 `error_description`)를 DTO에 명시하거나 해당 라우트만 허용 전략을 정할 것.
5. Next rewrites 프록시(`/api/:path*` → API)는 Set-Cookie를 그대로 통과시킨다 — 쿠키 Path는 `/`로 둘 것
   (프록시 경로 `/api`로 한정하면 새로고침 시 서버 컴포넌트 fetch에 쿠키가 안 붙는 실수 주의).
6. 네이버 로그인은 OIDC가 아니다 — id_token이 없고 `/v1/nid/me` 프로필 API를 호출해야 한다. 카카오와 같은
   인터페이스로 억지 통일하려고 id_token 파싱을 공용화하지 말 것 (provider 어댑터에서 흡수).

## 범위 제외

- 애플 로그인(D-015로 제외 — iOS 출시 시 지침 4.8 재검토), 모바일 로그인·관심 탭(WP-08b), 푸시·변동 감지(WP-09),
  마케팅 푸시 동의(T-07 — WP-09), 익명 앱 토큰·rate limiting·JWT 키 회전 운영(로드맵 3-2),
  본인인증·포트원(유료화 시점), 회원 탈퇴 화면(스토어 심사 요건 — WP-08b에서 모바일과 함께).
