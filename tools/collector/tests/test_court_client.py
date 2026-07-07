import pytest

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
