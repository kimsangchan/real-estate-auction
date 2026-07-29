from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from collector.court_parser import AuctionItem, SaleResult


@dataclass(frozen=True)
class UpsertResult:
    inserted: int
    updated: int
    skipped: int


class InMemoryAuctionRepository:
    """멱등 upsert 규칙을 검증하기 위한 테스트용 저장소."""

    def __init__(self) -> None:
        self._items: dict[tuple[str, str, str], AuctionItem] = {}

    def upsert_items(self, items: list[AuctionItem]) -> UpsertResult:
        inserted = 0
        updated = 0
        skipped = 0

        for item in items:
            current = self._items.get(item.natural_key)
            if current is None:
                self._items = {**self._items, item.natural_key: item}
                inserted += 1
                continue
            if current == item:
                skipped += 1
                continue
            self._items = {**self._items, item.natural_key: item}
            updated += 1

        return UpsertResult(inserted=inserted, updated=updated, skipped=skipped)


class InMemorySaleResultRepository:
    """매각 결과 멱등 저장 규칙(같은 관측 튜플 중복 금지)을 검증하기 위한 테스트용 저장소."""

    def __init__(self, pending_items: list[dict[str, Any]] | None = None) -> None:
        self._pending_items = list(pending_items or [])
        self.rows: set[tuple[Any, ...]] = set()

    def find_items_pending_sale_result(self) -> list[dict[str, Any]]:
        return list(self._pending_items)

    def upsert_sale_results(self, results: list[SaleResult]) -> UpsertResult:
        inserted = 0
        skipped = 0

        for result in results:
            key = (
                result.court_office_code,
                result.case_no,
                result.item_no,
                result.dxdy_date,
                result.dxdy_kind_code,
                result.result_code,
                result.sale_amount,
            )
            if key in self.rows:
                skipped += 1
                continue
            self.rows = {*self.rows, key}
            inserted += 1

        return UpsertResult(inserted=inserted, updated=0, skipped=skipped)
