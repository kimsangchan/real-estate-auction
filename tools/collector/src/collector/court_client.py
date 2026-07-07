from __future__ import annotations

import json
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any
from urllib import request

from collector.backoff import backoff_delay_ms


SEARCH_PATH = "/pgj//pgjsearch/searchControllerMain.on"


class BlockedByCourtError(RuntimeError):
    """차단 또는 접근제한 신호가 감지되면 우회하지 않고 즉시 중단한다."""


class CourtRequestError(RuntimeError):
    """재시도 후에도 법원 요청이 실패했을 때 발생한다."""


@dataclass(frozen=True)
class HttpResponse:
    status_code: int
    payload: dict[str, Any]

    def json(self) -> dict[str, Any]:
        return self.payload


Transport = Callable[[str, dict[str, Any]], Any]
SleepMs = Callable[[int], None]


class CourtAuctionClient:
    def __init__(
        self,
        *,
        base_url: str,
        request_interval_ms: int,
        max_retry: int,
        transport: Transport | None = None,
        sleep_ms: SleepMs | None = None,
    ) -> None:
        if request_interval_ms < 0:
            raise ValueError("request_interval_ms는 음수일 수 없습니다")
        if max_retry < 1:
            raise ValueError("max_retry는 1 이상이어야 합니다")

        self._base_url = base_url.rstrip("/")
        self._request_interval_ms = request_interval_ms
        self._max_retry = max_retry
        self._transport = transport or _urllib_transport
        self._sleep_ms = sleep_ms or _sleep_ms

    def search_items(self, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self._base_url}{SEARCH_PATH}"
        last_status: int | None = None

        for attempt in range(1, self._max_retry + 1):
            if attempt > 1:
                self._sleep_ms(backoff_delay_ms(attempt - 1))
            elif self._request_interval_ms:
                self._sleep_ms(self._request_interval_ms)

            try:
                response = self._transport(url, dict(payload))
            except OSError as exc:
                raise CourtRequestError(f"courtauction transport failed: {exc}") from exc
            status_code = int(response.status_code)
            last_status = status_code

            if status_code in {403, 429}:
                raise BlockedByCourtError(f"courtauction blocked collector: HTTP {status_code}")
            if 200 <= status_code < 300:
                return response.json()
            if status_code < 500:
                raise CourtRequestError(f"courtauction request failed: HTTP {status_code}")

        raise CourtRequestError(f"courtauction request failed after retries: HTTP {last_status}")


def _urllib_transport(url: str, payload: dict[str, Any]) -> HttpResponse:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json;charset=UTF-8",
            "User-Agent": "real-estate-auction-collector/0.1",
        },
        method="POST",
    )
    with request.urlopen(req, timeout=30) as response:  # noqa: S310 - configured public endpoint
        return HttpResponse(
            status_code=response.status,
            payload=json.loads(response.read().decode("utf-8")),
        )


def _sleep_ms(milliseconds: int) -> None:
    time.sleep(milliseconds / 1000)
