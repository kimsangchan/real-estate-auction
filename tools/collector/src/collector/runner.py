from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Protocol

from collector.court_client import CourtRequestError
from collector.court_parser import (
    SaleResult,
    SearchPage,
    parse_case_sale_results,
    parse_sale_result_page,
)
from collector.repository import UpsertResult


logger = logging.getLogger(__name__)

# 물건상세검색 화면(PGJ151F01) 기본값 — 부동산·기일입찰·법원별검색, 오늘부터 2주 후 매각기일까지
SEARCH_PERIOD_DAYS = 14
PAGE_SIZE = 10

# 매각결과검색은 pageSize 100을 HTTP 400으로 거부한다 — 10~20만 허용
SALE_RESULT_PAGE_SIZE = 20


class SearchClient(Protocol):
    def search_items(self, payload: dict[str, Any]) -> dict[str, Any]: ...


class AuctionRepository(Protocol):
    def upsert_items(self, items: list[Any]) -> UpsertResult: ...


class SaleResultSearchClient(Protocol):
    def search_sale_results(self, payload: dict[str, Any]) -> dict[str, Any]: ...


class CaseSearchClient(Protocol):
    def search_case(self, payload: dict[str, Any]) -> dict[str, Any]: ...


class SaleResultRepository(Protocol):
    def upsert_sale_results(self, results: list[SaleResult]) -> UpsertResult: ...


class BackfillRepository(Protocol):
    def find_items_pending_sale_result(self) -> list[dict[str, Any]]: ...

    def upsert_sale_results(self, results: list[SaleResult]) -> UpsertResult: ...


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


def build_sale_result_payload(
    court_office_code: str,
    *,
    page_no: int = 1,
    status_code: str = "",
) -> dict[str, Any]:
    """매각결과검색 submission(sbm_selectDspslSchdRsltSrch)이 기대하는 페이로드를 만든다.

    물건상세검색 페이로드에서 파생 — 화면 PGJ158M01 기준으로 statNum "3"이며,
    날짜 조건이 없고(최근 7일 스냅샷 고정) auctnGdsStatCd ""=전체 | "02"=매각 | "03"=유찰.
    """
    payload = build_search_payload(
        CollectionTarget(court_office_code=court_office_code, page_no=page_no)
    )
    payload["dma_pageInfo"]["pageSize"] = SALE_RESULT_PAGE_SIZE
    search_info = payload["dma_srchGdsDtlSrchInfo"]
    search_info["statNum"] = "3"
    search_info["pgmId"] = "PGJ158M01"
    search_info["auctnGdsStatCd"] = status_code
    search_info["bidBgngYmd"] = ""
    search_info["bidEndYmd"] = ""
    return payload


def build_case_search_payload(court_office_code: str, case_no: str) -> dict[str, Any]:
    """경매사건검색(sbm_selectAuctnCsSrchRslt) 페이로드 — 사람이 읽는 사건번호 그대로 보낸다."""
    return {"dma_srchCsDtlInf": {"cortOfcCd": court_office_code, "csNo": case_no}}


def run_sale_result_sweep(
    *,
    run_id: str,
    court_office_code: str,
    client: SaleResultSearchClient,
    repository: SaleResultRepository,
    status_code: str = "",
    max_pages: int = 50,
) -> UpsertResult:
    """매각결과검색으로 최근 7일 매각/유찰 결과를 페이지 순회하며 수집한다."""
    total_inserted = 0
    total_skipped = 0

    for page_no in range(1, max_pages + 1):
        payload = build_sale_result_payload(
            court_office_code, page_no=page_no, status_code=status_code
        )
        page = parse_sale_result_page(client.search_sale_results(payload))
        result = repository.upsert_sale_results(page.results)
        total_inserted += result.inserted
        total_skipped += result.skipped

        logger.info(
            "sale_result_sweep run_id=%s court=%s page=%s total=%s rows=%s inserted=%s skipped=%s",
            run_id,
            court_office_code,
            page_no,
            page.total_count,
            len(page.results),
            result.inserted,
            result.skipped,
        )

        if page_no * SALE_RESULT_PAGE_SIZE >= page.total_count:
            break

    return UpsertResult(inserted=total_inserted, updated=0, skipped=total_skipped)


def run_sale_result_backfill(
    *,
    run_id: str,
    client: CaseSearchClient,
    repository: BackfillRepository,
    limit: int | None = None,
) -> UpsertResult:
    """매각기일이 지났는데 결과가 없는 물건을 사건검색으로 조회해 결과를 채운다.

    한 사건에 물건이 여러 개일 수 있으므로 사건 단위로 중복 제거해 요청한다.
    사건 하나가 실패해도(종국 등) 다음 사건을 계속 처리하되, 차단 신호는 즉시 전파한다.
    """
    pending = repository.find_items_pending_sale_result()
    cases: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for row in pending:
        key = (row["court_office_code"], row["case_no"])
        if key not in seen:
            seen.add(key)
            cases.append(key)
    if limit is not None:
        cases = cases[:limit]

    total_inserted = 0
    total_skipped = 0
    failed_cases = 0

    for court_office_code, case_no in cases:
        try:
            response = client.search_case(build_case_search_payload(court_office_code, case_no))
        except CourtRequestError as exc:
            failed_cases += 1
            logger.warning(
                "sale_result_backfill_case_failed run_id=%s court=%s case=%s error=%s",
                run_id,
                court_office_code,
                case_no,
                exc,
            )
            continue

        results = parse_case_sale_results(
            response, court_office_code=court_office_code, case_no=case_no
        )
        result = repository.upsert_sale_results(results)
        total_inserted += result.inserted
        total_skipped += result.skipped

        logger.info(
            "sale_result_backfill_case run_id=%s court=%s case=%s rows=%s inserted=%s skipped=%s",
            run_id,
            court_office_code,
            case_no,
            len(results),
            result.inserted,
            result.skipped,
        )

    logger.info(
        "sale_result_backfill_done run_id=%s pending=%s cases=%s inserted=%s skipped=%s failed=%s",
        run_id,
        len(pending),
        len(cases),
        total_inserted,
        total_skipped,
        failed_cases,
    )

    return UpsertResult(inserted=total_inserted, updated=0, skipped=total_skipped)
