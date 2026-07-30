# photos 실행 로직 테스트 — 내부 사건번호 변환, 사건당 1요청, limit, 페이지 이어받기, 차단 전파
import json
import logging
from pathlib import Path

import pytest

from collector.court_client import BlockedByCourtError, CourtRequestError
from collector.repository import InMemoryPhotoRepository
from collector.runner import (
    PHOTO_MAX_PAGES,
    build_photo_payload,
    internal_case_no,
    run_photo_collection,
)


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "court_photo_page.json"

PENDING = [
    {"court_office_code": "B000210", "case_no": "2022타경101244"},
    {"court_office_code": "B000210", "case_no": "2023타경4722"},
]


class FakePhotoClient:
    def __init__(
        self,
        failing_cs_nos: set[str] | None = None,
        blocked_cs_nos: set[str] | None = None,
    ):
        self.requests: list[dict] = []
        self._failing = failing_cs_nos or set()
        self._blocked = blocked_cs_nos or set()

    def search_photos(self, payload: dict) -> dict:
        self.requests.append(payload)
        cs_no = payload["dma_srchPicInf"]["csNo"]
        if cs_no in self._blocked:
            raise BlockedByCourtError("courtauction blocked collector: HTTP 403")
        if cs_no in self._failing:
            raise CourtRequestError("courtauction request failed: HTTP 400")
        return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def test_internal_case_no_pads_serial_to_six_digits():
    # 실측: 2025타경52037 → 20250130052037 (타경 = 사건부호 0130)
    assert internal_case_no("2025타경52037") == "20250130052037"
    assert internal_case_no("2024타경119676") == "20240130119676"


def test_internal_case_no_rejects_unsupported_case_no():
    assert internal_case_no("2025가단1234") is None
    assert internal_case_no("타경12345") is None


def test_build_photo_payload_matches_captured_request():
    payload = build_photo_payload("B000211", "20250130052037")

    assert payload["dma_srchPicInf"] == {
        "cortOfcCd": "B000211",
        "csNo": "20250130052037",
        "ordTsCnt": "",
        "auctnInfOriginDvsCd": "",
        "pgmId": "PGJ15BP06",
        "cortAuctnPicDvsCd": "",
        "flag": "",
    }
    assert payload["dma_pageInfo"]["pageNo"] == 1
    assert payload["dma_pageInfo"]["totalYn"] == "Y"
    assert build_photo_payload("B000211", "20250130052037", page_no=2)["dma_pageInfo"][
        "totalYn"
    ] == "N"


def test_photo_collection_requests_once_per_case_and_stores(caplog):
    caplog.set_level(logging.INFO)
    client = FakePhotoClient()
    repository = InMemoryPhotoRepository(PENDING)

    result = run_photo_collection(run_id="run-ph", client=client, repository=repository)

    assert [p["dma_srchPicInf"]["csNo"] for p in client.requests] == [
        "20220130101244",
        "20230130004722",
    ]
    assert result.inserted == 6  # 사건 2건 × 사진 3장
    messages = "\n".join(record.getMessage() for record in caplog.records)
    assert "photo_case run_id=run-ph court=B000210 case=2022타경101244 photos=3" in messages
    assert "bytes=" in messages


def test_photo_collection_respects_limit():
    client = FakePhotoClient()
    repository = InMemoryPhotoRepository(PENDING)

    run_photo_collection(run_id="run-ph", client=client, repository=repository, limit=1)

    assert len(client.requests) == 1


def test_photo_collection_second_run_skips_collected_cases():
    client = FakePhotoClient()
    repository = InMemoryPhotoRepository(PENDING)

    first = run_photo_collection(run_id="run-1", client=client, repository=repository)
    second = run_photo_collection(run_id="run-2", client=client, repository=repository)

    assert first.inserted == 6
    assert second.inserted == 0
    assert len(client.requests) == 2  # 두 번째 실행은 요청 자체가 없다


def test_photo_collection_fetches_next_page_when_total_exceeds_page():
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    page1 = json.loads(json.dumps(fixture))
    page1["data"]["dma_pageInfo"]["totalCnt"] = 5
    page2 = json.loads(json.dumps(fixture))
    page2["data"]["dma_pageInfo"]["totalCnt"] = 5
    page2["data"]["dlt_csPicLst"] = page2["data"]["dlt_csPicLst"][:2]
    page2["data"]["picLst"] = page2["data"]["picLst"][:2]
    for row in page2["data"]["dlt_csPicLst"]:
        row["cortAuctnPicSeq"] += 10

    class PagingClient:
        def __init__(self):
            self.requests = []

        def search_photos(self, payload: dict) -> dict:
            self.requests.append(payload)
            return page1 if payload["dma_pageInfo"]["pageNo"] == 1 else page2

    client = PagingClient()
    repository = InMemoryPhotoRepository(PENDING[:1])

    result = run_photo_collection(run_id="run-ph", client=client, repository=repository)

    assert [p["dma_pageInfo"]["pageNo"] for p in client.requests] == [1, 2]
    assert result.inserted == 5


def test_photo_collection_stops_paging_at_max_pages():
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    fixture["data"]["dma_pageInfo"]["totalCnt"] = 999  # 항상 남아 있다고 주장하는 응답

    class EndlessClient:
        def __init__(self):
            self.requests = []

        def search_photos(self, payload: dict) -> dict:
            self.requests.append(payload)
            return fixture

    client = EndlessClient()
    repository = InMemoryPhotoRepository(PENDING[:1])

    run_photo_collection(run_id="run-ph", client=client, repository=repository)

    assert len(client.requests) == PHOTO_MAX_PAGES


def test_photo_collection_continues_after_single_case_failure(caplog):
    caplog.set_level(logging.INFO)
    client = FakePhotoClient(failing_cs_nos={"20220130101244"})
    repository = InMemoryPhotoRepository(PENDING)

    result = run_photo_collection(run_id="run-ph", client=client, repository=repository)

    assert result.inserted == 3  # 실패한 사건을 건너뛰고 다음 사건은 저장된다
    messages = "\n".join(record.getMessage() for record in caplog.records)
    assert "photo_case_failed run_id=run-ph court=B000210 case=2022타경101244" in messages
    assert "failed=1" in messages


def test_photo_collection_skips_unsupported_case_no(caplog):
    caplog.set_level(logging.INFO)
    client = FakePhotoClient()
    repository = InMemoryPhotoRepository(
        [{"court_office_code": "B000210", "case_no": "2025가단1234"}]
    )

    result = run_photo_collection(run_id="run-ph", client=client, repository=repository)

    assert client.requests == []
    assert result.inserted == 0
    messages = "\n".join(record.getMessage() for record in caplog.records)
    assert "photo_case_skipped" in messages


def test_photo_collection_propagates_block_signal():
    client = FakePhotoClient(blocked_cs_nos={"20220130101244"})
    repository = InMemoryPhotoRepository(PENDING)

    with pytest.raises(BlockedByCourtError):
        run_photo_collection(run_id="run-ph", client=client, repository=repository)
