# WP-04 TDD Evidence — CODEF 등기부 커넥터

작성일: 2026-07-08

## Source

- 작업지시서: `docs/work-orders/WP-04-codef-registry-connector.md` (확정된 요청/응답 스키마 전문 기록)
- 구현 위치: `apps/api/src/codef-registry/`

## User Journeys

1. 서비스는 CODEF OAuth2 토큰을 발급받아 만료 전까지 재사용한다.
2. 서비스는 재열람용 4자리 PIN을 CODEF 공개키로 RSA(PKCS#1 v1.5) 암호화해 전송한다.
3. 서비스는 확정된 요청 스키마로 등기부를 조회하고, CODEF의 form-urlencoded 인코딩 응답을 올바르게 디코딩한다.
4. 서비스는 주소 검색이 여러 물건과 매칭되면(2-Way 인증) 자동으로 재요청한다.
5. 서비스는 등기부 응답(헤더행+데이터행 표 구조)을 WP-03 `RegisteredRightDto[]`로 정규화한다.
6. 서비스는 동일 물건(사건)을 재조회하거나 동시에 조회해도 실제 발급(과금) 호출은 1회만 발생시키고, 정확히 그 호출만 `billed=true`로 로그한다.
7. 서비스는 일시 오류(타임아웃·5xx)와 도메인 오류를 구분해 재시도 여부를 판단한다.

## RED/GREEN Evidence

| Stage | Command | Result | Evidence |
|---|---|---|---|
| GREEN (전체) | `pnpm --filter api test` | PASS | 23 suites, 145 tests |
| Lint | `pnpm --filter api lint` | PASS | eslint 오류 0건 |
| Build | `pnpm --filter api build` | PASS | `nest build` 성공 |
| 실호출 검증 | 데모 API 엔드포인트·요청 스키마·RSA 패딩(PKCS#1 v1.5 vs OAEP) 확인 | PASS | 요청 구조 전부 실증 |
| **실호출 성공** | 실제 부동산 주소로 열람 성공 (`CF-00000`, "성공") | PASS | `test/fixtures/codef-registry-real-response.json` (익명화) |
| 프로덕션 버그 발견·수정 | `response.json()`이 CODEF의 실제 응답(text/plain, form-urlencoded 전체 인코딩)에서 항상 실패함을 발견 | FIXED | `client/codef-registry.client.ts`의 `parseCodefResponseBody` |

## Test Specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | 토큰 발급·만료 캐시·재발급, HTTP/네트워크 오류 처리 | `auth/codef-token.client.spec.ts` | unit | PASS |
| 2 | PIN을 RSA(PKCS#1 v1.5)로 암호화, 매번 다른 암호문, 잘못된 공개키는 오류 | `crypto/rsa-encrypt.spec.ts` | unit | PASS |
| 3 | 고유번호/주소 중 하나로 요청 구성, PIN 암호화, ePrepayPass는 평문 | `client/registry-lookup-request.spec.ts` | unit | PASS |
| 4 | Bearer 토큰으로 확정된 경로 조회, 5xx/네트워크 오류·CODEF 실패코드 분류 | `client/codef-registry.client.spec.ts`, `client/codef-errors.spec.ts` | unit | PASS |
| 5 | **CODEF의 실제 form-urlencoded(text/plain) 응답을 올바르게 디코딩한다** | `client/codef-registry.client.spec.ts` | unit | PASS |
| 6 | 2-Way 응답 감지·후보 1건 자동 재요청·여러 건/미지원 방식은 명시적 오류 | `client/codef-two-way.spec.ts`, `client/codef-registry.client.spec.ts` | unit | PASS |
| 7 | 등기목적 문구(근저당권설정·가압류·강제경매개시결정 등)를 WP-03 타입으로 매핑 | `mapper/registration-purpose.spec.ts` | unit | PASS |
| 8 | 접수정보 컬럼에서 날짜, 주요등기사항/등기원인 컬럼에서 채권최고액·청구금액 추출 | `mapper/registry-text-parser.spec.ts` | unit | PASS |
| 9 | 헤더행+데이터행 표 구조를 파싱해 WP-03 범위 밖 등기목적(소유권보존 등)은 제외 | `mapper/registry-response.mapper.spec.ts` | unit | PASS |
| 10 | 접수일자를 추출할 수 없는 행은 명시적 오류를 던진다 | `mapper/registry-response.mapper.spec.ts` | unit | PASS |
| 11 | **2026-07-08 실호출로 캡처한 실제 응답(익명화)을 정확히 변환한다** | `mapper/registry-response.mapper.spec.ts` | unit | PASS |
| 12 | 동일 물건 캐시 재사용·동시 요청 dedup·billed 로그 정확성·오류 전파 | `cache/registry-request-cache.spec.ts`, `service/codef-registry.service.spec.ts` | integration | PASS |
| 13 | **토큰 발급→실제 캡처 응답 조회→매핑→WP-03 권리분석까지 전체 파이프라인** | `codef-to-rights-analysis.e2e.spec.ts` | integration | PASS |

## 확정된 사실 (요약 — 전체 기록은 work order 참고)

- 엔드포인트: `POST https://development.codef.io/v1/kr/public/ck/real-estate-register/status`
- `password` 필드는 인터넷등기소 로그인 비밀번호가 아니라 **재열람용 4자리 숫자 PIN**(요청 시 임의 설정, RSA 암호화)
- `ePrepayPass`는 RSA 암호화하지 않고 평문 전송
- `IROS_MEMBER_ID`/`IROS_MEMBER_PW`는 이 흐름에서 쓰이지 않음 — phoneNo + PIN + 전자민원캐시로 인증·결제 완료
- RSA 패딩은 PKCS#1 v1.5
- CODEF 응답은 `Content-Type: text/plain`이며 본문 전체가 form-urlencoded로 인코딩됨 — 프로덕션 코드에서 이를 놓치면 모든 실호출이 예외로 실패하는 치명적 버그였음(발견 즉시 수정)
- 갑구/을구는 헤더행+데이터행 표 구조, `resRegistrationSumList`는 말소 제외 현재 유효 권리만 포함

## Known Gaps

- **2-Way "추가인증방식" 외 다른 방식 미지원**: SMS/ARS 등 사용자 입력이 필요한 2-Way 방식은 만나면 별도 비동기 흐름 설계가 필요하다 — 현재는 `UnsupportedTwoWayMethodError`로 명시적 실패.
- **텍스트 파싱은 이번에 캡처한 사건(가압류·강제경매개시결정 위주)으로만 검증됨** — 근저당권설정·전세권설정 등 다른 등기목적의 실제 텍스트 형태는 추후 다른 물건 캡처 시 재검증 권장.
- **지역 티어(RegionTier)·주소→고유번호 해석은 이 커넥터 범위 밖** — WP-03과 동일하게 호출자 책임.
