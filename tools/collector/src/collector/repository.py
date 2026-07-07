from __future__ import annotations

from dataclasses import dataclass

from collector.court_parser import AuctionItem


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
