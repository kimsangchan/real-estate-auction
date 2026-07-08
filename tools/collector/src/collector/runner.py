from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Protocol

from collector.court_parser import SearchPage
from collector.repository import UpsertResult


logger = logging.getLogger(__name__)

# 물건상세검색 화면(PGJ151F01) 기본값 — 부동산·기일입찰·법원별검색, 오늘부터 2주 후 매각기일까지
SEARCH_PERIOD_DAYS = 14
PAGE_SIZE = 10


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
    payload = build_search_payload(target)
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


def build_search_payload(target: CollectionTarget, *, today: date | None = None) -> dict[str, Any]:
    """WebSquare submission `sbm_selectGdsDtlSrch`가 기대하는 실제 페이로드를 만든다.

    필드 목록·상수값은 브라우저에서 물건상세검색(부동산/기일입찰/법원별검색) 기본값으로
    검색 버튼을 눌러 캡처한 실제 요청을 기준으로 한다 (`tests/fixtures/court_search_request.json`).
    """
    bid_begin = today or date.today()
    bid_end = bid_begin + timedelta(days=SEARCH_PERIOD_DAYS)

    return {
        "dma_pageInfo": {
            "pageNo": target.page_no,
            "pageSize": PAGE_SIZE,
            "bfPageNo": "",
            "startRowNo": "",
            "totalCnt": "",
            "totalYn": "Y" if target.page_no == 1 else "N",
            "groupTotalCount": "",
        },
        "dma_srchGdsDtlSrchInfo": {
            "rletDspslSpcCondCd": "",
            "bidDvsCd": "000331",
            "mvprpRletDvsCd": "00031R",
            "cortAuctnSrchCondCd": "0004601",
            "rprsAdongSdCd": "",
            "rprsAdongSggCd": "",
            "rprsAdongEmdCd": "",
            "rdnmSdCd": "",
            "rdnmSggCd": "",
            "rdnmNo": "",
            "mvprpDspslPlcAdongSdCd": "",
            "mvprpDspslPlcAdongSggCd": "",
            "mvprpDspslPlcAdongEmdCd": "",
            "rdDspslPlcAdongSdCd": "",
            "rdDspslPlcAdongSggCd": "",
            "rdDspslPlcAdongEmdCd": "",
            "cortOfcCd": target.court_office_code,
            "jdbnCd": "",
            "execrOfcDvsCd": "",
            "lclDspslGdsLstUsgCd": "",
            "mclDspslGdsLstUsgCd": "",
            "sclDspslGdsLstUsgCd": "",
            "cortAuctnMbrsId": "",
            "aeeEvlAmtMin": "",
            "aeeEvlAmtMax": "",
            "lwsDspslPrcRateMin": "",
            "lwsDspslPrcRateMax": "",
            "flbdNcntMin": "",
            "flbdNcntMax": "",
            "objctArDtsMin": "",
            "objctArDtsMax": "",
            "mvprpArtclKndCd": "",
            "mvprpArtclNm": "",
            "mvprpAtchmPlcTypCd": "",
            "notifyLoc": "off",
            "lafjOrderBy": "",
            "pgmId": "PGJ151F01",
            "csNo": "",
            "cortStDvs": "1",
            "statNum": 1,
            "bidBgngYmd": bid_begin.strftime("%Y%m%d"),
            "bidEndYmd": bid_end.strftime("%Y%m%d"),
            "dspslDxdyYmd": "",
            "fstDspslHm": "",
            "scndDspslHm": "",
            "thrdDspslHm": "",
            "fothDspslHm": "",
            "dspslPlcNm": "",
            "lwsDspslPrcMin": "",
            "lwsDspslPrcMax": "",
            "grbxTypCd": "",
            "gdsVendNm": "",
            "fuelKndCd": "",
            "carMdyrMax": "",
            "carMdyrMin": "",
            "carMdlNm": "",
            "sideDvsCd": "",
        },
    }
