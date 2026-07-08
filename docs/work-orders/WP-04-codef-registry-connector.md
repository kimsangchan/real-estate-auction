# WP-04. CODEF 등기부 커넥터

- 상태: **완료 (2026-07-08)** — OAuth 토큰·RSA 암호화·요청 빌더·전송 클라이언트·2-Way 인증 흐름·오류 분류·사건 단위 캐시/동시성·응답 매퍼(실제 표 구조 파싱)·오케스트레이션 서비스·WP-03 연동까지 구현 완료. **실제 데모 API로 등기부등본 열람 성공**(서울중앙지방법원 중부등기소, 2023타경4722 관련 부동산) — 캡처한 실응답을 익명화해 fixture로 보존. 23 suites, 145 tests 통과. | 선행: WP-01(완료), WP-03(완료, 출력 스키마 정합)
- 시작 전 필독: `AGENTS.md`, `decision-log.md` D-008, `06-tech-blueprint.md` §2-3, CODEF 개발가이드(https://developer.codef.io — 부동산등기부등본 상품)

## 목적
CODEF API로 특정 부동산의 등기사항전부증명서를 열람·파싱해 WP-03 룰 엔진의 입력(권리 목록)으로 정규화하는 NestJS 모듈. **on-demand + 사건 단위 캐시** (D-008 — 원가 통제 핵심).

## 필요 자격증명 (.env — 채팅·코드·로그에 노출 금지, 규칙 8)
| 항목 | env 키 | 상태 |
|---|---|---|
| CODEF 공개키 (RSA 암호화용, 비밀 아님) | `CODEF_PUBLIC_KEY` | ✅ 확보·검증 완료 |
| CODEF Client ID / Secret (데모) | `CODEF_CLIENT_ID/SECRET` | ✅ 확보·검증 완료 |
| CODEF 요청의 phoneNo (전자민원캐시 연결 전화번호) | `IROS_PHONE_NO` | ✅ 확보·검증 완료 |
| 전자민원캐시 번호/비번 (열람 실비 700원 결제, https://minwon.cashgate.co.kr/mcIros.do 에서 충전) | `IROS_EPREPAY_NO/PASS` | ✅ 확보·검증 완료 |
| 인터넷등기소 회원 ID/PW | `IROS_MEMBER_ID/PW` | ⚪ 이 API 흐름에서는 사용되지 않음(아래 "확정된 사실" 참고) — 다른 용도로 남겨둠 |

## 요구사항
1. **인증**: OAuth2 client_credentials 토큰 발급·갱신(만료 캐시). 데모 도메인 `CODEF_API_BASE` 사용 (규칙 13)
2. **암호화 유틸**: `CODEF_PUBLIC_KEY`로 비밀번호(재열람용 PIN) 필드 RSA 암호화 (node:crypto, PKCS#1 v1.5)
3. **정규화**: 응답(갑구·을구 권리 내역) → WP-03 입력 DTO 매핑
4. **캐시** (규칙 10): 물건(사건) 단위 — 동일 물건 재조회 시 발급 호출 0회
5. **동시성**: 같은 물건 동시 요청 시 발급 1회만 (in-flight dedup — 700원 중복 과금 방지)
6. **예외 구분** (규칙 6): 재시도 가능(타임아웃/5xx) vs 불가(도메인 오류) — 불가 예외는 명확한 도메인 에러로
7. 로그: 요청 ID·물건 키·과금 발생 여부 기록, 계정·비밀번호·등기부 내 개인정보 값 로그 금지 (규칙 7·8)
8. 테스트: 실 API 응답은 fixture 녹화 후 mock (개인정보는 익명화)

## 완료 기준
- [x] 데모 환경 실호출 1회 성공 → 응답 fixture 보존 — `apps/api/test/fixtures/codef-registry-real-response.json` (익명화)
- [x] 등기부 1건 → WP-03 입력 DTO 변환 E2E 테스트 통과 — `apps/api/src/codef-registry/codef-to-rights-analysis.e2e.spec.ts` (실 캡처 fixture 사용)
- [x] 동일 물건 2회 조회 시 외부 호출 1회 검증 (캐시·동시성 테스트) — `cache/registry-request-cache.spec.ts`, `service/codef-registry.service.spec.ts`
- [x] `pnpm --filter api lint && test` 통과, 규칙 18 보고 — `docs/testing/WP-04-codef-registry-connector.tdd.md`

## 확정된 사실 (실호출·CODEF 문서로 검증, 2026-07-08)

### 요청(input)
`POST https://development.codef.io/v1/kr/public/ck/real-estate-register/status`

- `organization: "0002"` (대법원 인터넷등기소, 고정값)
- `password`: **인터넷등기소 로그인 비밀번호가 아니라, 이 조회 건 재열람용으로 매 요청 시 임의로 정하는 4자리 숫자 PIN**이다(RSA PKCS#1 v1.5로 암호화). CODEF의 다른 상품(법인등기부등본) 예제 코드 주석에서 이 설계가 명시된 것을 확인 후, 부동산등기부등본도 동일함을 실호출로 검증(4자리는 통과, 8자리는 "비밀번호 자릿수 오류" CF-12826).
- `ePrepayNo`/`ePrepayPass`: 전자민원캐시(선불 결제수단, https://minwon.cashgate.co.kr/mcIros.do 충전) 번호와 비밀번호. **`ePrepayPass`는 RSA 암호화하지 않고 평문 그대로 보낸다** — 암호화하면 `CF-13334`(자리수 오류) 발생.
- `phoneNo`: 전자민원캐시에 연결된 실제 등록 전화번호.
- `IROS_MEMBER_ID`/`IROS_MEMBER_PW`(인터넷등기소 로그인 계정)는 **이 API 흐름에서 사용되지 않는다** — 계정 인증 없이 phoneNo+password(PIN)+전자민원캐시만으로 열람이 완료된다.
- 고유번호(`uniqueNo`) 또는 주소(`addr_sido`/`addr_sigungu`/`addr_roadName`/`addr_buildingNumber`/`dong`/`ho` 등) 중 하나로 조회. `addr_roadName`은 빈 문자열 불가.
- 구현: `client/registry-lookup-request.ts` (`buildRegistryLookupRequest`)

### 2-Way(2단계) 인증 흐름
주소 검색이 여러 물건과 매칭되면 1차 응답이 `continue2Way: true` + `jobIndex`/`threadIndex`/`jti`/`twoWayTimestamp`를 반환하고, 이 값을 그대로 실어 재요청해야 최종 응답을 받는다. 구현: `client/codef-two-way.ts` + `CodefRegistryClient.lookupWithTwoWay()` — 주소 후보가 1건일 때만 자동 진행, 여러 건/미지원 방식은 명시적 오류.

### 응답(output) — 실제 캡처로 구조 확정
- **응답 전체가 `Content-Type: text/plain`으로 오고, 본문이 application/x-www-form-urlencoded 방식(`%XX` + `'+'`는 공백)으로 인코딩돼 있다.** `response.json()`은 항상 실패하므로 `client/codef-registry.client.ts`가 텍스트로 받아 직접 디코딩한다(정상 JSON이면 그대로 파싱 — 테스트 mock과도 호환).
- 갑구/을구는 구조화된 개별 필드가 아니라 **[헤더행(`resType2="1"`), 데이터행(`resType2="2"`)...] 표 구조**다. 데이터행의 `resDetailList`는 위치(`resNumber`)로 헤더행의 같은 위치 컬럼명과 대응한다 (`mapper/registry-row-table.ts`).
- `resRegistrationSumList`(요약)는 이미 말소된 권리를 제외한 **현재 유효 권리만** 담고 있다 — WP-03이 날짜 비교로 인수/말소를 직접 판정하므로 이걸 그대로 쓴다(`resRegistrationHisList`의 전체 이력은 쓰지 않음).
- "등기목적" 컬럼이 있는 구획만 권리 표다 — 소유지분현황·개별공시지가·토지이용계획 등은 자동으로 제외된다(`mapper/registry-row-table.ts`의 `hasColumn`).
- 접수일자는 "접수정보"/"접수" 컬럼 값("OOOO년 O월 O일\n제OOOO호", "접수"라는 단어는 포함 안 함)에서, 금액은 "주요등기사항"/"등기원인" 컬럼의 "채권최고액"(근저당) 또는 "청구금액"(가압류·강제경매) 문구에서 추출한다 (`mapper/registry-text-parser.ts`).
- 구현: `mapper/codef-register-response.ts`(타입), `mapper/registration-purpose.ts`(등기목적→WP-03 타입 매핑), `mapper/registry-response.mapper.ts`(조합)

### 실제 캡처 fixture
`apps/api/test/fixtures/codef-registry-real-response.json` — WP-02가 수집한 실제 경매물건 주소(서울특별시 중구 동호로33길 15, 2023타경4722)로 실호출해 캡처. 소유자명·채권자명·주민등록번호는 익명화(구조·등기 내역·금액은 실제 그대로). 가압류 3건 + 강제경매개시결정 1건이 매핑되어 WP-03 권리분석(말소기준 판별·인수말소 분류)까지 정상 동작함을 E2E로 확인.
