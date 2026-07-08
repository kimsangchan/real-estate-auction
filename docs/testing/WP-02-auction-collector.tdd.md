# WP-02 TDD Evidence — 법원경매 수집기 v1

작성일: 2026-07-07

## Source

- 작업지시서: `docs/work-orders/WP-02-auction-collector.md`
- 기획 근거: `solution-planning/realestate-auction-platform/phase0-findings.md` §0-1, `06-tech-blueprint.md` §2, `decision-log.md` D-007

## User Journeys

1. 수집 배치는 법원 물건상세검색 응답을 안정적으로 파싱해 사건·물건 자연키를 만든다.
2. 수집 배치는 403/429 차단 신호를 감지하면 우회하지 않고 즉시 중단한다.
3. 수집 배치는 같은 자연키를 재처리해도 중복을 만들지 않고 변경만 감지한다.
4. 저장 스키마는 위치 검색을 위한 PostGIS 지오메트리와 개인정보 분리 테이블을 제공한다.

## RED/GREEN Evidence

| Stage | Command | Result | Evidence |
|---|---|---|---|
| RED | `.\.venv\Scripts\python.exe -m pytest` | FAIL | `ModuleNotFoundError: No module named 'collector.court_client'`, `collector.court_parser`, `collector.repository` |
| GREEN | `.\.venv\Scripts\python.exe -m pytest` | PASS | 11 tests passed |
| Lint | `.\.venv\Scripts\python.exe -m ruff check .` | PASS | All checks passed |
| DB smoke | `COLLECTOR_RUN_DB_TESTS=1 DATABASE_URL=postgresql://app:changeme@localhost:55432/auction .\.venv\Scripts\python.exe -m pytest tests/test_postgres_repository.py` | PASS | 2 tests passed against temporary `postgis/postgis:18-3.6` |
| Screen contract | `.\.venv\Scripts\python.exe -m pytest` | PASS | 16 passed, 1 skipped after adding `PGJ151F00.xml` fixture |
| 실계약 캡처 | Playwright MCP로 물건상세검색 화면에서 검색 버튼 클릭 → 실제 요청/응답 캡처 (2026-07-08) | PASS | 실제 경로는 `/pgj/pgjsearch/searchControllerMain.on` (단일 슬래시) — 공개 XML의 `action` 속성(이중 슬래시)과 다름. 이전 세션의 HTTP 500은 경로 오류가 원인이었음 |
| 무세션 재현 | `curl`로 동일 payload를 쿠키 없이 재요청 | PASS | 200 OK, 세션 쿠키 불필요 — 배치 수집기가 브라우저 없이 동일 계약을 재현 가능함을 확인 |
| GREEN (실계약 반영 후) | `.\.venv\Scripts\python.exe -m pytest` | PASS | 18 passed, 1 skipped |
| Lint (실계약 반영 후) | `.\.venv\Scripts\python.exe -m ruff check .` | PASS | All checks passed |
| 실수집 E2E | `DATABASE_URL=... python -m collector --court-office-code B000210 --page-no {1..5} --migrate` | PASS | 서울중앙지방법원(B000210) 5페이지 × 10건 = 50건 신규 적재 (2026-07-08) |
| 멱등성 재실행 | 동일 페이지(1~5) 재실행 | PASS | 5회 모두 `inserted=0 skipped=10` |
| PostGIS 검증 | `docker exec auction-db psql ...` | PASS | 50/50건 geom 생성, 서울 bbox(`ST_Intersects`) 50/50건 포함, 사건 37건 |

## Test Specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | 법원 검색 fixture가 필수 자연키·금액·좌표 필드로 파싱된다 | `tools/collector/tests/test_court_parser.py` | unit | PASS |
| 2 | 빈 검색 페이지가 오류 없이 빈 목록으로 처리된다 | `tools/collector/tests/test_court_parser.py` | unit | PASS |
| 3 | 자연키 필드 누락은 명시적 파싱 오류로 차단된다 | `tools/collector/tests/test_court_parser.py` | unit | PASS |
| 4 | HTTP 403 차단 신호는 재시도 없이 즉시 중단된다 | `tools/collector/tests/test_court_client.py` | unit | PASS |
| 5 | 5xx 일시 오류는 지수 백오프 후 재시도된다 | `tools/collector/tests/test_court_client.py` | unit | PASS |
| 6 | 같은 자연키 재실행은 inserted 0, skipped N으로 멱등 처리된다 | `tools/collector/tests/test_repository.py` | unit | PASS |
| 7 | 가격·기일 등 값 변경은 updated로 감지된다 | `tools/collector/tests/test_repository.py` | unit | PASS |
| 8 | DDL은 `case_person` 분리 테이블과 GiST 인덱스를 포함하고 주민번호 필드를 만들지 않는다 | `tools/collector/tests/test_schema.py` | static | PASS |
| 9 | PostgreSQL repository는 migration 후 동일 fixture를 중복 없이 upsert한다 | `tools/collector/tests/test_postgres_repository.py` | integration | PASS |
| 10 | PostGIS `ST_Intersects` bbox 조회가 서울 좌표 fixture 2건을 반환한다 | `tools/collector/tests/test_postgres_repository.py` | integration | PASS |
| 11 | 수집 runner는 실행 ID·법원·페이지·처리 건수·insert/update/skip을 로그로 남기고 주소값은 남기지 않는다 | `tools/collector/tests/test_runner.py` | unit | PASS |
| 12 | 공개 화면 XML은 물건상세검색 submission이 `dma_pageInfo`/`dma_srchGdsDtlSrchInfo`를 사용함을 보장한다 | `tools/collector/tests/test_court_screen_contract.py` | static | PASS |
| 13 | 검색 payload는 브라우저 캡처와 동일한 실제 요청(`tests/fixtures/court_search_request.json`)을 만든다 | `tools/collector/tests/test_runner.py` | unit | PASS |
| 14 | transport HTTP 오류는 수집기 도메인 오류로 감싸진다 | `tools/collector/tests/test_court_client.py` | unit | PASS |
| 15 | `_urllib_transport`는 실제 경로·필수 헤더(`sc-userid`, `submissionid`, `referer`, `accept`)로 요청을 만든다 | `tools/collector/tests/test_court_client.py` | unit | PASS |
| 16 | 실제 응답 필드(`dlt_srchResult`, `boCd`, `srnSaNo`, `mokmulSer`, `printSt` 등)가 `AuctionItem`으로 매핑된다 | `tools/collector/tests/test_court_parser.py` | unit | PASS |
| 17 | 카텍(KATEC) 좌표(`xCordi`/`yCordi`)가 WGS84 위경도로 변환된다 | `tools/collector/tests/test_court_parser.py` | unit | PASS |

## 좌표계 확인 (카텍 → WGS84)

- 응답의 `wgs84Xcordi`/`wgs84Ycordi` 필드는 정수로 반올림되어 있어(`"127"`/`"37"`) 사실상 정밀도가 없다 — 지도 표시용으로 사용 불가.
- `xCordi`/`yCordi`는 카텍(KATEC, 내비게이션용) 평면좌표로 확인됨: `+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 +ellps=bessel +towgs84=-146.43,507.89,681.46`.
- 검증: 서울 4개 실주소(강남구 논현동/중구 오장동/관악구 남현동/중구 남창동) 좌표를 역산해 실제 주소 위치와 일치함을 확인 (`tools/collector/src/collector/geo.py`).
- 실수집 E2E 50건 전량 geom 생성 성공, 서울 bbox(`ST_Intersects`) 50/50건 포함 확인.

## Known Gaps

- 실제 요청/응답 계약, 좌표 변환, 실수집 E2E까지 모두 검증 완료. 남은 공식적인 Known Gap 없음.
- (참고) 로컬 개발 환경에서 Windows 호스트에 네이티브 PostgreSQL이 5432 포트를 점유하고 있어, docker-compose의 `db` 서비스 포트를 `55432:5432`로 변경함 (`.env`/`.env.example` 동기화 완료). 다른 환경에서 재현 시 호스트 5432 포트 점유 여부를 먼저 확인할 것.
