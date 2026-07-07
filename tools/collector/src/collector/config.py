from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class CollectorConfig:
    database_url: str
    court_base_url: str
    request_interval_ms: int
    max_retry: int


def load_config() -> CollectorConfig:
    database_url = _required_env("DATABASE_URL")
    return CollectorConfig(
        database_url=database_url,
        court_base_url=os.getenv("COURT_AUCTION_BASE_URL", "https://www.courtauction.go.kr"),
        request_interval_ms=_int_env("COLLECTOR_REQUEST_INTERVAL_MS", 1500),
        max_retry=_int_env("COLLECTOR_MAX_RETRY", 3),
    )


def _required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ValueError(f"{name} is required")
    return value


def _int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    try:
        parsed = int(value)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer") from exc
    if parsed < 0:
        raise ValueError(f"{name} must be non-negative")
    return parsed
