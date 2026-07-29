# backfill/sweep 실행 로직 테스트 — 사건 중복 제거, 페이지 순회, 멱등성, 부분 실패 계속
import json
import logging
from pathlib import Path

import pytest

from collector.court_client import BlockedByCourtError, CourtRequestError
from collector.repository import InMemorySaleResultRepository
from collector.runner import (
    SALE_RESULT_PAGE_SIZE,
    build_sale_result_payload,
    run_sale_result_backfill,
    run_sale_result_sweep,
)


SALE_RESULT_FIXTURE = Path(__file__).parent / "fixtures" / "court_sale_result_page.json"
CASE_SEARCH_FIXTURE = Path(__file__).parent / "fixtures" / "court_case_search_page.json"

PENDING_ITEMS = [
    {"court_office_code": "B000210", "case_no": "2023타경4722", "item_no": "1"},
    {"court_office_code": "B000210", "case_no": "2025타경939", "item_no": "1"},
    {"court_office_code": "B000210", "case_no": "2025타경939", "item_no": "2"},
]


class FakeCaseSearchClient:
    def __init__(self, failing_cases: set[str] | None = None):
        self.requested: list[dict] = []
        self._failing_cases = failing_cases or set()

    def search_case(self, payload: dict) -> dict:
        self.requested.append(payload)
        cs_no = payload["dma_srchCsDtlInf"]["csNo"]
        if cs_no in self._failing_cases:
            raise CourtRequestError("courtauction request failed: HTTP 400")
        return json.loads(CASE_SEARCH_FIXTURE.read_text(encoding="utf-8"))


def test_backfill_deduplicates_cases_and_upserts(caplog):
    caplog.set_level(logging.INFO)
    client = FakeCaseSearchClient()
    repository = InMemorySaleResultRepository(pending_items=PENDING_ITEMS)

    result = run_sale_result_backfill(run_id="run-bf", client=client, repository=repository)

    # 물건 3개지만 사건은 2개 — 사건 단위로만 요청한다
    assert len(client.requested) == 2
    assert [p["dma_srchCsDtlInf"]["csNo"] for p in client.requested] == [
        "2023타경4722",
        "2025타경939",
    ]
    # fixture 응답(기일 2행)이 사건마다 돌아온다 — 사건 2개 × 2행
    assert result.inserted == 4
    messages = "\n".join(record.getMessage() for record in caplog.records)
    assert "sale_result_backfill_done run_id=run-bf pending=3 cases=2" in messages


def test_backfill_respects_limit():
    client = FakeCaseSearchClient()
    repository = InMemorySaleResultRepository(pending_items=PENDING_ITEMS)

    run_sale_result_backfill(run_id="run-bf", client=client, repository=repository, limit=1)

    assert len(client.requested) == 1


def test_backfill_is_idempotent_across_runs():
    client = FakeCaseSearchClient()
    repository = InMemorySaleResultRepository(pending_items=PENDING_ITEMS)

    first = run_sale_result_backfill(run_id="run-1", client=client, repository=repository)
    second = run_sale_result_backfill(run_id="run-2", client=client, repository=repository)

    assert first.inserted == 4
    assert second.inserted == 0
    assert len(repository.rows) == 4


def test_backfill_continues_after_single_case_failure(caplog):
    caplog.set_level(logging.INFO)
    client = FakeCaseSearchClient(failing_cases={"2023타경4722"})
    repository = InMemorySaleResultRepository(pending_items=PENDING_ITEMS)

    result = run_sale_result_backfill(run_id="run-bf", client=client, repository=repository)

    assert len(client.requested) == 2
    assert result.inserted == 2
    messages = "\n".join(record.getMessage() for record in caplog.records)
    assert "sale_result_backfill_case_failed" in messages


def test_backfill_propagates_block_signal():
    class BlockedClient:
        def search_case(self, payload: dict) -> dict:
            raise BlockedByCourtError("courtauction blocked collector: HTTP 403")

    repository = InMemorySaleResultRepository(pending_items=PENDING_ITEMS)

    with pytest.raises(BlockedByCourtError):
        run_sale_result_backfill(run_id="run-bf", client=BlockedClient(), repository=repository)


class FakeSweepClient:
    def __init__(self, total_count: int):
        self.requested_pages: list[int] = []
        self._total_count = total_count

    def search_sale_results(self, payload: dict) -> dict:
        self.requested_pages.append(payload["dma_pageInfo"]["pageNo"])
        page = json.loads(SALE_RESULT_FIXTURE.read_text(encoding="utf-8"))
        page["data"]["dma_pageInfo"]["totalCnt"] = str(self._total_count)
        page["data"]["dma_pageInfo"]["pageNo"] = payload["dma_pageInfo"]["pageNo"]
        return page


def test_sweep_stops_after_last_page():
    client = FakeSweepClient(total_count=3)
    repository = InMemorySaleResultRepository()

    result = run_sale_result_sweep(
        run_id="run-sw", court_office_code="B000210", client=client, repository=repository
    )

    assert client.requested_pages == [1]
    assert result.inserted == 3


def test_sweep_pages_until_total_count():
    client = FakeSweepClient(total_count=SALE_RESULT_PAGE_SIZE + 5)
    repository = InMemorySaleResultRepository()

    run_sale_result_sweep(
        run_id="run-sw", court_office_code="B000210", client=client, repository=repository
    )

    assert client.requested_pages == [1, 2]


def test_build_sale_result_payload_overrides_detail_search_fields():
    payload = build_sale_result_payload("B000210", page_no=2, status_code="02")

    assert payload["dma_pageInfo"]["pageNo"] == 2
    assert payload["dma_pageInfo"]["pageSize"] == SALE_RESULT_PAGE_SIZE
    search_info = payload["dma_srchGdsDtlSrchInfo"]
    assert search_info["statNum"] == "3"
    assert search_info["pgmId"] == "PGJ158M01"
    assert search_info["auctnGdsStatCd"] == "02"
    assert search_info["cortOfcCd"] == "B000210"
    # 매각결과검색은 날짜 조건이 없다 — 최근 7일 스냅샷 고정
    assert search_info["bidBgngYmd"] == ""
    assert search_info["bidEndYmd"] == ""
