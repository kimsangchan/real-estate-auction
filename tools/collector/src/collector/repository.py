from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from collector.court_parser import AuctionItem, CasePhoto, ItemNotice, SaleResult


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


class InMemoryNoticeRepository:
    """명세서 멱등 저장 규칙(같은 물건·작성일 중복 금지)을 검증하기 위한 테스트용 저장소."""

    def __init__(self) -> None:
        self.notices: dict[tuple[str, str, str, Any], ItemNotice] = {}

    def upsert_notices(self, notices: list[ItemNotice]) -> UpsertResult:
        inserted = 0
        updated = 0
        skipped = 0

        for notice in notices:
            key = (notice.court_office_code, notice.case_no, notice.item_no, notice.document_date)
            current = self.notices.get(key)
            if current is None:
                inserted += 1
            elif current == notice:
                skipped += 1
                continue
            else:
                updated += 1
            self.notices = {**self.notices, key: notice}

        return UpsertResult(inserted=inserted, updated=updated, skipped=skipped)


class InMemoryPhotoRepository:
    """사진 멱등 저장 규칙(같은 사건·출처·순번 중복 금지)을 검증하기 위한 테스트용 저장소."""

    def __init__(self, pending_cases: list[dict[str, Any]] | None = None) -> None:
        self._pending_cases = list(pending_cases or [])
        self.photos: dict[tuple[str, str, str, int], CasePhoto] = {}

    def find_cases_missing_photos(
        self, court_office_code: str | None = None
    ) -> list[dict[str, Any]]:
        rows = [
            row
            for row in self._pending_cases
            if court_office_code is None or row["court_office_code"] == court_office_code
        ]
        collected = {(key[0], key[1]) for key in self.photos}
        return [
            row for row in rows if (row["court_office_code"], row["case_no"]) not in collected
        ]

    def upsert_case_photos(
        self, court_office_code: str, case_no: str, photos: list[CasePhoto]
    ) -> UpsertResult:
        inserted = 0
        updated = 0
        skipped = 0

        for photo in photos:
            key = (court_office_code, case_no, photo.source, photo.seq)
            current = self.photos.get(key)
            if current is None:
                inserted += 1
            elif current == photo:
                skipped += 1
                continue
            else:
                updated += 1
            self.photos = {**self.photos, key: photo}

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
