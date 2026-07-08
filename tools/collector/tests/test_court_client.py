import json

import pytest

from collector import court_client
from collector.court_client import BlockedByCourtError, CourtAuctionClient


class FakeResponse:
    def __init__(self, status_code: int, payload: dict | None = None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self) -> dict:
        return self._payload


def test_client_stops_immediately_on_block_response():
    calls: list[dict] = []

    def transport(url: str, payload: dict) -> FakeResponse:
        calls.append({"url": url, "payload": payload})
        return FakeResponse(403)

    client = CourtAuctionClient(
        base_url="https://www.courtauction.go.kr",
        request_interval_ms=0,
        max_retry=3,
        transport=transport,
    )

    with pytest.raises(BlockedByCourtError):
        client.search_items({"pageNo": 1})

    assert len(calls) == 1


def test_client_retries_transient_errors_then_returns_payload():
    statuses = [500, 502, 200]
    sleeps: list[int] = []

    def transport(url: str, payload: dict) -> FakeResponse:
        return FakeResponse(statuses.pop(0), {"data": {"totalCnt": 0, "items": []}})

    client = CourtAuctionClient(
        base_url="https://www.courtauction.go.kr",
        request_interval_ms=0,
        max_retry=3,
        transport=transport,
        sleep_ms=sleeps.append,
    )

    assert client.search_items({"pageNo": 1}) == {"data": {"totalCnt": 0, "items": []}}
    assert sleeps == [1500, 3000]


def test_client_wraps_transport_http_error_as_request_error():
    def transport(url: str, payload: dict) -> FakeResponse:
        raise OSError("HTTP Error 500: Internal Server Error")

    client = CourtAuctionClient(
        base_url="https://www.courtauction.go.kr",
        request_interval_ms=0,
        max_retry=1,
        transport=transport,
    )

    with pytest.raises(Exception, match="transport failed"):
        client.search_items({"pageNo": 1})


class _FakeUrlopenResponse:
    def __init__(self, payload: dict):
        self.status = 200
        self._body = json.dumps(payload).encode("utf-8")

    def read(self) -> bytes:
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def test_urllib_transport_sends_real_courtauction_contract(monkeypatch):
    captured: dict = {}

    def fake_urlopen(req, timeout):
        captured["url"] = req.full_url
        captured["headers"] = {k.lower(): v for k, v in req.headers.items()}
        return _FakeUrlopenResponse({"data": {}})

    monkeypatch.setattr(court_client.request, "urlopen", fake_urlopen)

    court_client._urllib_transport(
        "https://www.courtauction.go.kr/pgj/pgjsearch/searchControllerMain.on",
        {"dma_pageInfo": {}},
    )

    assert captured["url"] == "https://www.courtauction.go.kr/pgj/pgjsearch/searchControllerMain.on"
    assert captured["headers"]["sc-userid"] == "SYSTEM"
    assert captured["headers"]["submissionid"] == court_client.SUBMISSION_ID
    assert captured["headers"]["referer"] == court_client.REFERER
    assert captured["headers"]["accept"] == "application/json"
