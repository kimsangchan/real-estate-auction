from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any

from collector.geo import katec_to_wgs84


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
    page_info = _object_at(data, "dma_pageInfo")
    rows = _list_at(data, "dlt_srchResult")
    return SearchPage(
        total_count=_optional_int(page_info.get("totalCnt")) or 0,
        page_no=_optional_int(page_info.get("pageNo")) or 1,
        items=[_parse_item(row, index) for index, row in enumerate(rows)],
    )


def _parse_item(row: Any, index: int) -> AuctionItem:
    if not isinstance(row, dict):
        raise CourtPayloadError(f"items[{index}] must be an object")

    court_office_code = _required_str(row, "boCd")
    case_no = _required_str(row, "srnSaNo")
    item_no = _required_str(row, "mokmulSer")
    x = _optional_float(row.get("xCordi"))
    y = _optional_float(row.get("yCordi"))

    return AuctionItem(
        court_office_code=court_office_code,
        case_no=case_no,
        item_no=item_no,
        court_name=_optional_str(row.get("jiwonNm")),
        usage_code=_optional_str(row.get("sclsUtilCd")),
        address=_optional_str(row.get("printSt")),
        appraisal_amount=_optional_int(row.get("gamevalAmt")),
        minimum_sale_price=_optional_int(row.get("minmaePrice")),
        failed_bid_count=_optional_int(row.get("yuchalCnt")),
        bid_datetime=_combine_bid_datetime(row),
        location=katec_to_wgs84(x, y) if x is not None and y is not None else None,
        raw=dict(row),
    )


def _combine_bid_datetime(row: dict[str, Any]) -> str | None:
    """매각기일(maeGiil, YYYYMMDD)과 1회차 매각시각(maeHh1, HHmm)을 합쳐 타임스탬프 문자열을 만든다.

    법원 값은 한국 표준시(KST, UTC+9) 기준이라 +09:00을 명시한다 — 오프셋 없이 저장하면 DB 세션
    시간대(UTC)로 해석돼 실제보다 9시간 늦은 시각으로 조회되는 버그가 있었다.
    """
    date_part = _optional_str(row.get("maeGiil"))
    if date_part is None or len(date_part) != 8:
        return None
    formatted_date = f"{date_part[0:4]}-{date_part[4:6]}-{date_part[6:8]}"

    time_part = _optional_str(row.get("maeHh1"))
    if time_part is not None and len(time_part) == 4:
        return f"{formatted_date} {time_part[0:2]}:{time_part[2:4]}:00+09:00"
    return f"{formatted_date}+09:00"


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
