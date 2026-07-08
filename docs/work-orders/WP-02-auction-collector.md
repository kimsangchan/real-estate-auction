# WP-02. 법원경매 수집기 v1

- 상태: **완료 (2026-07-08)** — 브라우저(Playwright MCP)로 물건상세검색 화면의 실제 검색 요청/응답을 캡처해 계약을 확정하고, 파싱·클라이언트·payload를 실제 계약으로 갱신했다. 카텍(KATEC) 좌표 변환, 서울중앙지방법원(B000210) 5페이지 50건 실수집 E2E, 재실행 멱등성(신규 0) 확인 완료.
  | 선행: WP-01 | 담당 에이전트: Codex
- 시작 전 필독: `AGENTS.md`, `solution-planning/realestate-auction-platform/phase0-findings.md`(§0-1 API·필드 모델), `06-tech-blueprint.md` §2, `decision-log.md` D-007

## 목적
courtauction.go.kr에서 진행 중 경매 사건·물건·기일을 수집해 PostGIS에 적재하는 Python 배치(`tools/collector`)를 만든다.

## 요구사항
1. **대상 API** (phase0-findings §0-1 + 브라우저 실캡처로 확정, 2026-07-08):
   - 공개 화면 정의: `GET /pgj/ui/pgj100/PGJ151F00.xml`
   - 물건상세검색 submission: `POST /pgj/pgjsearch/searchControllerMain.on` (단일 슬래시 — 공개 XML의 `action` 속성은 이중 슬래시로 되어 있으나 실제 요청 경로는 단일 슬래시). 필수 헤더: `sc-userid: SYSTEM`, `submissionid: mf_wfm_mainFrame_sbm_selectGdsDtlSrch`, `Referer`. 세션 쿠키 불필요(무상태 재현 확인됨). 실제 요청/응답은 `tools/collector/tests/fixtures/court_search_request.json`, `court_search_page.json` 참고.
2. **DB 스키마** (마이그레이션 도구 사용, 06 §2 원칙):
   - `auction_case`(사건), `auction_item`(물건, `geom geometry(Point,4326)` + GiST 인덱스), `auction_schedule`(기일 이력), `auction_item_raw`(원본 JSON 보존)
   - **개인정보 분리**: 소유자·채무자명 등은 `case_person` 전용 테이블로만 (A-08). 주민번호 필드 생성 금지
3. **멱등성** (규칙 10): 자연키(법원코드+사건번호+물건번호) upsert. 재실행 시 중복 0. 변경 감지 시 이력 기록(기일 변경·유찰)
4. **수집 예절** (D-007 — 법적 전제): 요청 간격 `COLLECTOR_REQUEST_INTERVAL_MS`(기본 1500ms), 지수 백오프 재시도 최대 `COLLECTOR_MAX_RETRY`, 403/429/차단 패턴 감지 시 **즉시 중단 + 에러 로그** (우회 시도 코드 작성 금지)
5. **로깅** (규칙 7): 실행 ID, 법원·페이지 단위 처리 건수, 신규/변경/스킵 카운트, 실패 원인. 개인정보 값 로그 금지 (규칙 8)
6. 단위 테스트 (규칙 11): 파싱(fixture 기반) 정상/필드 누락/빈 페이지, upsert 멱등성, 백오프 로직

## 완료 기준
- [x] 법원 1곳 대상 실수집 E2E 1회 성공 (물건 ≥ 50건 적재, 재실행 시 신규 0) — 서울중앙지방법원(B000210) 50건, 재실행 시 inserted=0/skipped=10×5
- [x] `ruff check . && pytest` 통과 (커버리지: 파싱·upsert 핵심 경로)
- [x] bbox 쿼리 스모크: `ST_Intersects`로 서울 영역 물건 조회 동작
- [x] 차단 감지 시나리오 테스트 (mock 403 → 중단·로그 확인)
- [x] 규칙 18 보고 + README에 실행·장애 확인 방법 (규칙 17)

## 범위 제외
법원 서류 PDF 파싱(추후 WP), 전국 스케줄 운영, 개인정보 마스킹 배치(추후 WP — 단 스키마 분리는 이번에).
