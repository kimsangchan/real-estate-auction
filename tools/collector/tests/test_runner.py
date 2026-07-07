import json
import logging
from pathlib import Path

from collector.court_parser import parse_search_page
from collector.repository import InMemoryAuctionRepository
from collector.runner import CollectionTarget, build_search_payload, run_collection


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "court_search_page.json"


class FakeClient:
    def search_items(self, payload: dict) -> dict:
        assert payload["dma_srchGdsDtlSrchInfo"]["cortOfcCd"] == "B000210"
        assert payload["dma_pageInfo"]["pageNo"] == "1"
        return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def test_run_collection_logs_counts_without_personal_values(caplog):
    caplog.set_level(logging.INFO)
    repository = InMemoryAuctionRepository()

    result = run_collection(
        run_id="run-001",
        target=CollectionTarget(court_office_code="B000210", page_no=1),
        client=FakeClient(),
        repository=repository,
        parse_search_page=parse_search_page,
    )

    assert result.inserted == 2
    assert result.updated == 0
    assert result.skipped == 0
    messages = "\n".join(record.getMessage() for record in caplog.records)
    assert "run_id=run-001" in messages
    assert "court=B000210" in messages
    assert "processed=2" in messages
    assert "서울특별시" not in messages


def test_build_search_payload_matches_websquare_submission_shape():
    payload = build_search_payload(CollectionTarget(court_office_code="B000210", page_no=3))

    assert payload == {
        "dma_pageInfo": {
            "pageNo": "3",
            "startRowNo": "40",
            "totalYn": "N",
        },
        "dma_srchGdsDtlSrchInfo": {
            "cortOfcCd": "B000210",
            "pgmId": "PGJ151M01",
            "mvprpRletDvsCd": "R",
        },
    }
