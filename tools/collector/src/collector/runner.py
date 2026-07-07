from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Protocol

from collector.court_parser import SearchPage
from collector.repository import UpsertResult


logger = logging.getLogger(__name__)


class SearchClient(Protocol):
    def search_items(self, payload: dict[str, Any]) -> dict[str, Any]: ...


class AuctionRepository(Protocol):
    def upsert_items(self, items: list[Any]) -> UpsertResult: ...


ParseSearchPage = Callable[[dict[str, Any]], SearchPage]


@dataclass(frozen=True)
class CollectionTarget:
    court_office_code: str
    page_no: int = 1


def run_collection(
    *,
    run_id: str,
    target: CollectionTarget,
    client: SearchClient,
    repository: AuctionRepository,
    parse_search_page: ParseSearchPage,
) -> UpsertResult:
    payload = {
        "cortOfcCd": target.court_office_code,
        "pageNo": target.page_no,
    }
    raw_page = client.search_items(payload)
    page = parse_search_page(raw_page)
    result = repository.upsert_items(page.items)

    logger.info(
        "collector_page run_id=%s court=%s page=%s processed=%s inserted=%s updated=%s skipped=%s",
        run_id,
        target.court_office_code,
        target.page_no,
        len(page.items),
        result.inserted,
        result.updated,
        result.skipped,
    )

    return result
