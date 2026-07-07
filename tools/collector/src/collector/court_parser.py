from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any


class CourtPayloadError(ValueError):
    """법원 응답이 수집기가 기대하는 최소 필드 계약을 만족하지 않을 때 발생한다."""


@dataclass(frozen=True)
class AuctionItem:
    court_office_code: str
    case_no: str
    item_no: str
    court_name: str | None
    usage_code: str | None
    address: str | None
    appraisal_amount: int | None
    minimum_sale_price: int | None
    failed_bid_count: int | None
    bid_datetime: str | None
    location: tuple[float, float] | None
    raw: dict[str, Any]

    @property
    def natural_key(self) -> tuple[str, str, str]:
        return (self.court_office_code, self.case_no, self.item_no)

    def with_updates(self, **changes: Any) -> AuctionItem:
        return replace(self, **changes)


@dataclass(frozen=True)
class SearchPage:
    total_count: int
    page_no: int
    items: list[AuctionItem]


def parse_search_page(payload: dict[str, Any]) -> SearchPage:
    data = _object_at(payload, "data")
    rows = _list_at(data, "items")
    return SearchPage(
        total_count=_optional_int(data.get("totalCnt")) or 0,
        page_no=_optional_int(data.get("pageNo")) or 1,
        items=[_parse_item(row, index) for index, row in enumerate(rows)],
    )


def _parse_item(row: Any, index: int) -> AuctionItem:
    if not isinstance(row, dict):
        raise CourtPayloadError(f"items[{index}] must be an object")

    court_office_code = _required_str(row, "cortOfcCd")
    case_no = _required_str(row, "csNo")
    item_no = _required_str(row, "gdsNo")
    lat = _optional_float(row.get("lat"))
    lng = _optional_float(row.get("lng"))

    return AuctionItem(
        court_office_code=court_office_code,
        case_no=case_no,
        item_no=item_no,
        court_name=_optional_str(row.get("cortNm")),
        usage_code=_optional_str(row.get("lclDspslGdsLstUsgCd")),
        address=_optional_str(row.get("gdsDtlAddr")),
        appraisal_amount=_optional_int(row.get("aeeEvlAmt")),
        minimum_sale_price=_optional_int(row.get("minDspslPrc")),
        failed_bid_count=_optional_int(row.get("flbdNcnt")),
        bid_datetime=_optional_str(row.get("bidDtm")),
        location=(lng, lat) if lat is not None and lng is not None else None,
        raw=dict(row),
    )


def _object_at(payload: dict[str, Any], key: str) -> dict[str, Any]:
    value = payload.get(key)
    if not isinstance(value, dict):
        raise CourtPayloadError(f"{key} must be an object")
    return value


def _list_at(payload: dict[str, Any], key: str) -> list[Any]:
    value = payload.get(key)
    if value is None:
        return []
    if not isinstance(value, list):
        raise CourtPayloadError(f"{key} must be a list")
    return value


def _required_str(payload: dict[str, Any], key: str) -> str:
    value = _optional_str(payload.get(key))
    if value is None:
        raise CourtPayloadError(f"missing required field: {key}")
    return value


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _optional_int(value: Any) -> int | None:
    text = _optional_str(value)
    if text is None:
        return None
    try:
        return int(text.replace(",", ""))
    except ValueError as exc:
        raise CourtPayloadError(f"invalid integer: {text}") from exc


def _optional_float(value: Any) -> float | None:
    text = _optional_str(value)
    if text is None:
        return None
    try:
        return float(text)
    except ValueError as exc:
        raise CourtPayloadError(f"invalid float: {text}") from exc
