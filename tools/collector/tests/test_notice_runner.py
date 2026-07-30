# notices 실행 로직 테스트 — 물건번호 매핑, limit, 멱등성, 부분 실패 계속, 차단 전파, 점유자 표 수집
import json
import logging
from pathlib import Path

import pytest

from collector.court_client import BlockedByCourtError, CourtRequestError
from collector.notice_document_client import NoticeDocumentSession
from collector.repository import InMemoryNoticeRepository
from collector.runner import CollectionTarget, build_item_detail_payload, run_notice_collection


SEARCH_FIXTURE = Path(__file__).parent / "fixtures" / "court_search_page.json"
DETAIL_FIXTURE = Path(__file__).parent / "fixtures" / "court_item_detail_page.json"
TEXTS_FIXTURE = Path(__file__).parent / "fixtures" / "notice_pdf_texts_page0.json"

TARGET = CollectionTarget(court_office_code="B000210")


class FakeDetailClient:
    def __init__(self, failing_cases: set[str] | None = None):
        self.detail_requests: list[dict] = []
        self._failing_cases = failing_cases or set()

    def search_items(self, payload: dict) -> dict:
        return json.loads(SEARCH_FIXTURE.read_text(encoding="utf-8"))

    def search_item_detail(self, payload: dict) -> dict:
        self.detail_requests.append(payload)
        case_no = payload["dma_srchGdsDtlSrch"]["csNo"]
        if case_no in self._failing_cases:
            raise CourtRequestError("courtauction request failed: HTTP 400")
        return json.loads(DETAIL_FIXTURE.read_text(encoding="utf-8"))


def test_notice_collection_requests_detail_per_item_and_stores(caplog):
    caplog.set_level(logging.INFO)
    client = FakeDetailClient()
    repository = InMemoryNoticeRepository()

    result = run_notice_collection(
        run_id="run-nt", target=TARGET, client=client, repository=repository
    )

    assert [p["dma_srchGdsDtlSrch"]["csNo"] for p in client.detail_requests] == [
        "2022타경101244",
        "2023타경4722",
    ]
    assert result.inserted == 2
    messages = "\n".join(record.getMessage() for record in caplog.records)
    assert "notice_collection run_id=run-nt court=B000210 items=2 parsed=2" in messages


def test_notice_collection_keys_rows_by_object_number_not_goods_number():
    client = FakeDetailClient()
    repository = InMemoryNoticeRepository()

    run_notice_collection(run_id="run-nt", target=TARGET, client=client, repository=repository)

    # 상세조회는 물건번호(maemulSer)로 보내고, 저장 키는 목적물번호(mokmulSer)를 쓴다
    assert client.detail_requests[0]["dma_srchGdsDtlSrch"]["dspslGdsSeq"] == "1"
    assert {key[2] for key in repository.notices} == {"1"}


def test_notice_collection_respects_limit():
    client = FakeDetailClient()
    repository = InMemoryNoticeRepository()

    run_notice_collection(
        run_id="run-nt", target=TARGET, client=client, repository=repository, limit=1
    )

    assert len(client.detail_requests) == 1


def test_notice_collection_is_idempotent_across_runs():
    client = FakeDetailClient()
    repository = InMemoryNoticeRepository()

    first = run_notice_collection(
        run_id="run-1", target=TARGET, client=client, repository=repository
    )
    second = run_notice_collection(
        run_id="run-2", target=TARGET, client=client, repository=repository
    )

    assert first.inserted == 2
    assert second.inserted == 0
    assert second.skipped == 2
    assert len(repository.notices) == 2


def test_notice_collection_continues_after_single_item_failure(caplog):
    caplog.set_level(logging.INFO)
    client = FakeDetailClient(failing_cases={"2022타경101244"})
    repository = InMemoryNoticeRepository()

    result = run_notice_collection(
        run_id="run-nt", target=TARGET, client=client, repository=repository
    )

    assert len(client.detail_requests) == 2
    assert result.inserted == 1
    messages = "\n".join(record.getMessage() for record in caplog.records)
    assert "notice_item_failed" in messages


def test_notice_collection_propagates_block_signal():
    class BlockedClient(FakeDetailClient):
        def search_item_detail(self, payload: dict) -> dict:
            raise BlockedByCourtError("courtauction blocked collector: HTTP 403")

    with pytest.raises(BlockedByCourtError):
        run_notice_collection(
            run_id="run-nt",
            target=TARGET,
            client=BlockedClient(),
            repository=InMemoryNoticeRepository(),
        )


def test_notice_collection_stores_nothing_when_notice_absent():
    class NoNoticeClient(FakeDetailClient):
        def search_item_detail(self, payload: dict) -> dict:
            return {"status": 200, "data": {"ipcheck": True}}

    repository = InMemoryNoticeRepository()
    result = run_notice_collection(
        run_id="run-nt", target=TARGET, client=NoNoticeClient(), repository=repository
    )

    assert result.inserted == 0
    assert repository.notices == {}


class FakeDocumentReader:
    """명세서 PDF 경로를 흉내낸다 — 문서 열기 1회, 페이지별 텍스트 1회."""

    def __init__(self, *, available: bool = True):
        self.opened: list[str] = []
        self.pages_read: list[int] = []
        self._available = available

    def open_document(self, ref):
        self.opened.append(ref.ecdoc_id)
        if not self._available:
            return None
        return NoticeDocumentSession(streamdocs_id="doc-1", access_token="token-1")

    def fetch_text_page(self, session, page: int):
        self.pages_read.append(page)
        if page == 0:
            return json.loads(TEXTS_FIXTURE.read_text(encoding="utf-8"))
        return []


def test_notice_collection_fills_tenant_table_when_document_reader_given(caplog):
    caplog.set_level(logging.INFO)
    reader = FakeDocumentReader()
    repository = InMemoryNoticeRepository()

    run_notice_collection(
        run_id="run-nt",
        target=TARGET,
        client=FakeDetailClient(),
        repository=repository,
        limit=1,
        document_reader=reader,
    )

    notice = next(iter(repository.notices.values()))
    assert [t.tenant_name for t in notice.tenants] == ["홍길동", "주택도시보증공사"]
    assert notice.tenants[0].deposit_amount == 230_000_000
    # 표가 비고란으로 끝나므로 다음 쪽은 받지 않는다 (법원 요청 절약)
    assert reader.pages_read == [0]
    assert "tenants=2" in "\n".join(record.getMessage() for record in caplog.records)


def test_notice_collection_keeps_notice_when_document_unavailable(caplog):
    caplog.set_level(logging.INFO)
    reader = FakeDocumentReader(available=False)
    repository = InMemoryNoticeRepository()

    result = run_notice_collection(
        run_id="run-nt",
        target=TARGET,
        client=FakeDetailClient(),
        repository=repository,
        limit=1,
        document_reader=reader,
    )

    # 열람 창 밖이면 표만 비어 있고 기재사항 수집은 그대로 성공한다
    assert result.inserted == 1
    assert next(iter(repository.notices.values())).tenants == ()
    assert "notice_document_unavailable" in "\n".join(r.getMessage() for r in caplog.records)


def test_notice_collection_skips_document_path_by_default():
    reader = FakeDocumentReader()

    run_notice_collection(
        run_id="run-nt",
        target=TARGET,
        client=FakeDetailClient(),
        repository=InMemoryNoticeRepository(),
        limit=1,
    )

    assert reader.opened == []


def test_build_item_detail_payload_uses_detail_search_context():
    payload = build_item_detail_payload(TARGET, case_no="2022타경101244", goods_seq="2", row_index=3)

    detail = payload["dma_srchGdsDtlSrch"]
    assert detail["csNo"] == "2022타경101244"
    assert detail["cortOfcCd"] == "B000210"
    assert detail["dspslGdsSeq"] == "2"
    assert detail["pgmId"] == "PGJ151F01"
    assert detail["srchInfo"]["sideDvsCd"] == "2"
    assert detail["srchInfo"]["srchRowIndex"] == 3
    assert detail["srchInfo"]["menuNm"] == "물건상세검색"
