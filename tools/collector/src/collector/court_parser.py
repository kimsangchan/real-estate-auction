from __future__ import annotations

import re
from dataclasses import dataclass, replace
from datetime import date
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


# 수집 출처 코드 — auction_sale_result.source 컬럼 값
SOURCE_SCHEDULE_RESULT_SEARCH = "SCHEDULE_RESULT_SEARCH"
SOURCE_CASE_SEARCH = "CASE_SEARCH"

# 매각결과검색 mulStatcd → 기일 결과코드(LJH-AUCTN_DXDY_RSLT_CD) 대응 (04=매각→001, 03=유찰→002)
_MUL_STAT_TO_RESULT_CODE = {"04": "001", "03": "002"}


@dataclass(frozen=True)
class SaleResult:
    """auction_sale_result 한 행에 해당하는 기일 결과 관측값."""

    court_office_code: str
    case_no: str
    item_no: str
    dxdy_date: date
    dxdy_kind_code: str
    result_code: str
    sale_amount: int | None
    minimum_sale_price: int | None
    failed_bid_count: int | None
    source: str


@dataclass(frozen=True)
class SaleResultPage:
    total_count: int
    page_no: int
    results: list[SaleResult]


def parse_sale_result_page(payload: dict[str, Any]) -> SaleResultPage:
    """매각결과검색(PGJ158M00) 응답을 매각 결과 행으로 변환한다.

    결과가 아닌 행(진행 중 등)과 필드가 깨진 행은 그 행만 건너뛴다 — 전체 실패로 만들지 않는다.
    """
    data = _object_at(payload, "data")
    page_info = _object_at(data, "dma_pageInfo")
    results = []
    for row in _list_at(data, "dlt_srchResult"):
        parsed = _parse_sale_result_row(row)
        if parsed is not None:
            results.append(parsed)
    return SaleResultPage(
        total_count=_optional_int(page_info.get("totalCnt")) or 0,
        page_no=_optional_int(page_info.get("pageNo")) or 1,
        results=results,
    )


def _parse_sale_result_row(row: Any) -> SaleResult | None:
    if not isinstance(row, dict):
        return None
    try:
        result_code = _MUL_STAT_TO_RESULT_CODE.get(_optional_str(row.get("mulStatcd")) or "")
        court_office_code = _optional_str(row.get("boCd"))
        case_no = _optional_str(row.get("srnSaNo"))
        item_no = _optional_str(row.get("mokmulSer"))
        dxdy_date = _date_from_yyyymmdd(row.get("maeGiil"))
        if None in (result_code, court_office_code, case_no, item_no, dxdy_date):
            return None
        return SaleResult(
            court_office_code=court_office_code,
            case_no=case_no,
            item_no=item_no,
            dxdy_date=dxdy_date,
            dxdy_kind_code="01",  # 매각결과검색 행은 매각기일 결과다
            result_code=result_code,
            sale_amount=_amount_or_none(row.get("maeAmt")),
            minimum_sale_price=_amount_or_none(row.get("minmaePrice")),
            failed_bid_count=_optional_int(row.get("yuchalCnt")),
            source=SOURCE_SCHEDULE_RESULT_SEARCH,
        )
    except CourtPayloadError:
        return None


def parse_case_sale_results(
    payload: dict[str, Any],
    *,
    court_office_code: str,
    case_no: str,
) -> list[SaleResult]:
    """경매사건검색(PGJ159M00) 응답의 기일내역을 매각 결과 행으로 변환한다.

    종국 사건 등으로 사건 기본정보가 없으면 빈 목록을 돌려준다.
    기일 행의 dspslGdsSeq(물건번호)는 물건별 목록의 dspslObjctSeq(목적물번호=우리 item_no)로
    바꿔 매핑한다 — 실측: 2024타경109389에서 물건 2번=목적물 3번으로 두 체계가 갈라진다.
    """
    data = payload.get("data")
    if not isinstance(data, dict) or not isinstance(data.get("dma_csBasInf"), dict):
        return []

    goods_by_seq: dict[str, list[dict[str, Any]]] = {}
    goods_list = data.get("dlt_dspslGdsDspslObjctLst")
    for entry in goods_list if isinstance(goods_list, list) else []:
        if not isinstance(entry, dict):
            continue
        seq = _optional_str(entry.get("dspslGdsSeq"))
        if seq is not None:
            goods_by_seq.setdefault(seq, []).append(entry)

    results = []
    dxdy_list = data.get("dlt_rletCsGdsDtsDxdyInf")
    for row in dxdy_list if isinstance(dxdy_list, list) else []:
        results.extend(
            _parse_case_dxdy_row(
                row, goods_by_seq, court_office_code=court_office_code, case_no=case_no
            )
        )
    return results


def _parse_case_dxdy_row(
    row: Any,
    goods_by_seq: dict[str, list[dict[str, Any]]],
    *,
    court_office_code: str,
    case_no: str,
) -> list[SaleResult]:
    if not isinstance(row, dict):
        return []
    try:
        kind_code = _optional_str(row.get("auctnDxdyKndCd"))
        result_code = _optional_str(row.get("auctnDxdyRsltCd"))  # 결과 없는 미래 기일은 스킵
        dxdy_ymd = _optional_str(row.get("dxdyYmd"))
        dxdy_date = _date_from_yyyymmdd(dxdy_ymd)
        goods_seq = _optional_str(row.get("dspslGdsSeq"))
        if None in (kind_code, result_code, dxdy_date, goods_seq):
            return []

        results = []
        for goods in goods_by_seq.get(goods_seq, []):
            item_no = _optional_str(goods.get("dspslObjctSeq"))
            if item_no is None:
                continue
            # 물건별 목록의 낙찰가·최저가는 현재 공고의 매각기일(dspslDxdyYmd) 것만 신뢰한다
            same_dxdy = _optional_str(goods.get("dspslDxdyYmd")) == dxdy_ymd
            results.append(
                SaleResult(
                    court_office_code=court_office_code,
                    case_no=case_no,
                    item_no=item_no,
                    dxdy_date=dxdy_date,
                    dxdy_kind_code=kind_code,
                    result_code=result_code,
                    sale_amount=(
                        _amount_or_none(goods.get("dspslAmt"))
                        if kind_code == "01" and same_dxdy
                        else None
                    ),
                    minimum_sale_price=(
                        _amount_or_none(goods.get("fstPbancLwsDspslPrc")) if same_dxdy else None
                    ),
                    failed_bid_count=None,  # 사건검색은 유찰 횟수를 제공하지 않는다
                    source=SOURCE_CASE_SEARCH,
                )
            )
        return results
    except CourtPayloadError:
        return []


@dataclass(frozen=True)
class ItemNotice:
    """auction_item_notice 한 행에 해당하는 매각물건명세서 기재사항.

    개인정보(A-08): 임차인·신고인 실명을 담는 필드를 두지 않는다. 점유자 표는 명세서 PDF에만
    있고 이 응답에는 없다.
    """

    court_office_code: str
    case_no: str
    item_no: str
    document_date: date | None
    baseline_raw: str | None
    baseline_date: date | None
    distribution_demand_deadline: date | None
    assumed_rights_note: str | None
    superficies_note: str | None
    remarks: str | None


# 최선순위 설정 원문의 날짜 표기 — "2008.07.09", "2022.1.12.", "2024. 12. 11." 모두 실측된 형태다
_BASELINE_DATE_PATTERN = re.compile(r"(\d{4})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})")

# 비고란 등 자유서술에 신고인·점유자 실명이 마스킹 없이 실린다 (실측: "2008.11.28. 이재선
# 유치권신고(879,596,895원)"). 우리는 이름을 쓰지 않으므로 저장 전에 지운다 (A-08).
# 사람 이름은 신고·제출 같은 행위 명사 앞에 온다는 실측 패턴만 좁게 잡는다.
_PERSON_ACTION = r"(?:유치권신고|권리신고|배당요구|신고|제출|접수)"
_PERSON_NAME_PATTERN = re.compile(rf"(?<![가-힣])([가-힣]{{2,4}})(\s*{_PERSON_ACTION})")

# 사람 이름이 아니라 역할·지위를 가리키는 낱말 — 마스킹하면 문장 뜻이 망가진다
_NOT_PERSON_NAMES = frozenset(
    {
        "임차인",
        "점유자",
        "소유자",
        "채권자",
        "채무자",
        "신청인",
        "대리인",
        "관리인",
        "공유자",
        "매수인",
        "세입자",
        "임대인",
        "전세권자",
        "유치권",
        "근저당",
        "가압류",
    }
)


def mask_person_names(text: str | None) -> str | None:
    """자유서술에서 사람 이름을 법원 표기 방식(첫 글자 + OO)으로 가린다.

    휴리스틱이므로 완벽하지 않다. 새로운 표기가 나오면 패턴을 넓혀야 한다 (WP-11 §5).
    """
    if text is None:
        return None

    def replace(match: re.Match[str]) -> str:
        name, tail = match.group(1), match.group(2)
        if name in _NOT_PERSON_NAMES:
            return match.group(0)
        return f"{name[0]}OO{tail}"

    return _PERSON_NAME_PATTERN.sub(replace, text)


def parse_item_notice(
    payload: dict[str, Any],
    *,
    court_office_code: str,
    case_no: str,
    item_no: str,
) -> ItemNotice | None:
    """물건상세(PGJ15BM01) 응답에서 매각물건명세서 기재사항을 뽑는다.

    항목이 없으면 그 필드만 None으로 두고 전체를 실패시키지 않는다. 명세서 자체가 아직
    작성되지 않은 물건(작성일 없음)이면 None을 돌려준다.
    """
    data = payload.get("data")
    if not isinstance(data, dict):
        return None
    result = data.get("dma_result")
    if not isinstance(result, dict):
        return None
    dxdy = result.get("dspslGdsDxdyInfo")
    if not isinstance(dxdy, dict):
        return None

    document_date = _date_from_yyyymmdd(dxdy.get("gdsSpcfcWrtYmd"))
    baseline_raw = _optional_str(dxdy.get("tprtyRnkHypthcStngDts"))
    if document_date is None and baseline_raw is None:
        return None

    return ItemNotice(
        court_office_code=court_office_code,
        case_no=case_no,
        item_no=item_no,
        document_date=document_date,
        baseline_raw=baseline_raw,
        baseline_date=_baseline_date(baseline_raw),
        distribution_demand_deadline=_distribution_demand_deadline(result),
        # 자유서술 3종은 실명이 실릴 수 있어 저장 전에 이름을 가린다 (A-08)
        assumed_rights_note=mask_person_names(_optional_str(dxdy.get("ndstrcRghCtt"))),
        superficies_note=mask_person_names(_optional_str(dxdy.get("sprfcExstcDts"))),
        remarks=mask_person_names(_optional_str(dxdy.get("gdsSpcfcRmk"))),
    )


def _baseline_date(baseline_raw: str | None) -> date | None:
    """최선순위 설정 원문에서 가장 이른 날짜를 고른다.

    토지와 집합건물의 최선순위를 따로 적는 사건이 있어 날짜가 여러 개다. 말소기준은 그중
    가장 이른 날짜다.
    """
    if baseline_raw is None:
        return None
    parsed = []
    for year, month, day in _BASELINE_DATE_PATTERN.findall(baseline_raw):
        try:
            parsed.append(date(int(year), int(month), int(day)))
        except ValueError:
            continue
    return min(parsed) if parsed else None


def _distribution_demand_deadline(result: dict[str, Any]) -> date | None:
    entries = result.get("dstrtDemnInfo")
    for entry in entries if isinstance(entries, list) else []:
        if not isinstance(entry, dict):
            continue
        deadline = _date_from_yyyymmdd(entry.get("dstrtDemnLstprdYmd"))
        if deadline is not None:
            return deadline
    return None


def _date_from_yyyymmdd(value: Any) -> date | None:
    text = _optional_str(value)
    if text is None or len(text) != 8 or not text.isdigit():
        return None
    try:
        return date(int(text[0:4]), int(text[4:6]), int(text[6:8]))
    except ValueError:
        return None


def _amount_or_none(value: Any) -> int | None:
    """금액 필드 변환 — 법원 응답은 '없음'을 0/빈값으로 주므로 None으로 통일한다."""
    amount = _optional_int(value)
    return amount if amount else None


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
