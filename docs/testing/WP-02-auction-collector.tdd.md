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

## Known Gaps

- 현재 fixture는 phase0 필드 모델 기반 샘플이다. 실제 브라우저 개발자도구 캡처 응답으로 교체해야 한다.
- 법원 1곳 대상 실수집 E2E는 아직 실행하지 않았다.
