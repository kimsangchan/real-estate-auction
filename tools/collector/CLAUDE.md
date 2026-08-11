# tools/collector/ — 스코프 작업 지침

이 폴더의 파일을 다룰 때만 로드된다(온디맨드). 공통 행동규칙은 루트 `CLAUDE.md`,
프로젝트 표준·구현기준 22개는 `AGENTS.md`, 다음-할일은 `NEXT.md`를 따른다.

## 목표

Python 수집 배치. courtauction.go.kr에서 물건·매각공고·임차인 표를 수집해 PostgreSQL에 적재한다.

## 소유 경로

`src/collector/*.py`, `migrations/NNN_*.sql`, `tests/`, `pyproject.toml`, `run_daily.cmd`
DB 스키마의 소유자는 이 폴더다 — `apps/api`는 읽기 소비자다.

## 핵심 관례

- **수집 예절 (D-007, 위반 시 사업 리스크).** 요청 간격 제한·백오프를 반드시 넣는다(`backoff.py`).
  차단 조치가 감지되면 **우회하지 않고 중단·알림**한다.
- `run_daily.cmd`는 Docker와 DB를 먼저 기동한 뒤 배치를 돈다 (`50bfdbd`). 순서를 바꾸지 말 것.
- 임차인 표는 레이아웃 변종이 여러 개다 (`ded25af`). 파서가 행을 조용히 버리지 않도록,
  버린 행 수를 공고별로 기록한다 (`notice_tenant_reject_count`, WP-11 §4-7).
- 마스킹: 임차인·소유자명은 마스킹 후 저장. 주민등록번호 필드는 만들지 않는다 (D-011a).
- **`run_migrations`는 추적 테이블 없이 매 실행마다 `migrations/*.sql` 전부를 sorted 순서로 재실행한다**
  (`postgres_repository.py:316`). 그래서 모든 마이그레이션은 **재실행해도 안전(idempotent)** 해야 한다 —
  `ADD COLUMN IF NOT EXISTS`, 조건부 `UPDATE ... WHERE col IS NULL` 처럼. 다음 번호는 `016_`부터 쓴다.
- **`auction_item_raw`는 물건당 여러 스냅샷이 쌓인다** (실측 2,979 물건 / 63,479행 / 120MB).
  이 테이블을 `auction_item_id`로 조회하는 쿼리를 새로 쓸 때 인덱스를 확인할 것 —
  015 마이그레이션 전까지 API 목록 조회가 행마다 전체 순차 스캔을 해서 20초가 걸렸다.

## 검증

```
cd tools/collector && ruff check . && pytest
```
