from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import date, timedelta
from typing import Any, Protocol

from collector.court_client import CourtRequestError
from collector.court_parser import (
    ItemNotice,
    SaleResult,
    SearchPage,
    parse_case_sale_results,
    parse_item_notice,
    parse_sale_result_page,
)
from collector.notice_document_client import (
    NoticeDocumentRef,
    NoticeDocumentSession,
    notice_document_ref,
)
from collector.notice_tenant_parser import NoticeTenant, parse_tenant_table
from collector.repository import UpsertResult


logger = logging.getLogger(__name__)

# 점유자 표는 명세서 1쪽에 있고, 점유자가 많으면 다음 쪽으로 이어진다 — 이어질 때만 더 받는다
NOTICE_TEXT_MAX_PAGES = 2

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


class ItemDetailClient(Protocol):
    def search_items(self, payload: dict[str, Any]) -> dict[str, Any]: ...

    def search_item_detail(self, payload: dict[str, Any]) -> dict[str, Any]: ...


class NoticeRepository(Protocol):
    def upsert_notices(self, notices: list[ItemNotice]) -> UpsertResult: ...


class NoticeDocumentReader(Protocol):
    def open_document(self, ref: NoticeDocumentRef) -> NoticeDocumentSession | None: ...

    def fetch_text_page(self, session: NoticeDocumentSession, page: int) -> list[Any]: ...


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


def build_item_detail_payload(
    target: CollectionTarget,
    *,
    case_no: str,
    goods_seq: str,
    row_index: int = 0,
) -> dict[str, Any]:
    """물건상세(sbm_selectGdsDtlSrchDtlInfo) 페이로드를 만든다.

    `goods_seq`는 물건번호(검색 결과의 maemulSer)다. 목적물번호(mokmulSer=우리 item_no)와
    다른 사건이 있으므로 섞어 쓰면 다른 물건의 명세서를 받는다 (WP-11 §4-2).
    """
    search_info = build_search_payload(target)["dma_srchGdsDtlSrchInfo"]
    search_info["sideDvsCd"] = "2"
    search_info["srchRowIndex"] = row_index
    search_info["menuNm"] = "물건상세검색"

    return {
        "dma_srchGdsDtlSrch": {
            "csNo": case_no,
            "cortOfcCd": target.court_office_code,
            "dspslGdsSeq": goods_seq,
            "pgmId": "PGJ151F01",
            "srchInfo": search_info,
        }
    }


def run_notice_collection(
    *,
    run_id: str,
    target: CollectionTarget,
    client: ItemDetailClient,
    repository: NoticeRepository,
    limit: int | None = None,
    document_reader: NoticeDocumentReader | None = None,
) -> UpsertResult:
    """지금 공고 중인 물건의 매각물건명세서 기재사항을 수집한다.

    검색 결과 한 페이지의 물건을 하나씩 상세조회한다 — 상세조회가 물건당 1회 요청이므로
    limit으로 한 번에 도는 물건 수를 제한한다. 물건 하나가 실패해도 다음 물건을 계속
    처리하되, 차단 신호는 즉시 전파한다.

    `document_reader`를 주면 명세서 PDF까지 열어 점유자(임차인) 표를 함께 채운다.
    물건당 요청이 3회 이상 늘어나므로 필요한 실행에서만 넘긴다.
    """
    rows = _search_result_rows(client.search_items(build_search_payload(target)))
    if limit is not None:
        rows = rows[:limit]

    notices: list[ItemNotice] = []
    failed_items = 0
    tenant_rows = 0
    tenant_rejected = 0

    for row_index, row in enumerate(rows):
        case_no = str(row.get("srnSaNo") or "")
        goods_seq = str(row.get("maemulSer") or "")
        item_no = str(row.get("mokmulSer") or "")
        if not (case_no and goods_seq and item_no):
            failed_items += 1
            continue

        payload = build_item_detail_payload(
            target, case_no=case_no, goods_seq=goods_seq, row_index=row_index
        )
        try:
            response = client.search_item_detail(payload)
        except CourtRequestError as exc:
            failed_items += 1
            logger.warning(
                "notice_item_failed run_id=%s court=%s case=%s item=%s error=%s",
                run_id,
                target.court_office_code,
                case_no,
                item_no,
                exc,
            )
            continue

        notice = parse_item_notice(
            response,
            court_office_code=target.court_office_code,
            case_no=case_no,
            item_no=item_no,
        )
        if notice is None:
            continue

        if document_reader is not None:
            tenants, rejected = _collect_notice_tenants(
                run_id=run_id, reader=document_reader, detail_payload=response, case_no=case_no
            )
            notice = replace(notice, tenants=tenants)
            tenant_rows += len(tenants)
            tenant_rejected += rejected
        notices.append(notice)

    result = repository.upsert_notices(notices)

    logger.info(
        "notice_collection run_id=%s court=%s items=%s parsed=%s tenants=%s "
        "tenants_rejected=%s inserted=%s updated=%s skipped=%s failed=%s",
        run_id,
        target.court_office_code,
        len(rows),
        len(notices),
        tenant_rows,
        tenant_rejected,
        result.inserted,
        result.updated,
        result.skipped,
        failed_items,
    )

    return result


def _collect_notice_tenants(
    *,
    run_id: str,
    reader: NoticeDocumentReader,
    detail_payload: dict[str, Any],
    case_no: str,
) -> tuple[tuple[NoticeTenant, ...], int]:
    """명세서 PDF에서 점유자 표를 읽어 (저장할 행, 검증에서 버린 행 수)를 돌려준다.

    열람 창(매각기일 1주 전~기일) 밖이면 문서를 열 수 없어 빈 값을 돌려준다 — 기재사항 수집은
    그대로 진행한다. 표가 다음 쪽으로 이어질 때만 쪽을 더 받는다.
    """
    ref = notice_document_ref(detail_payload)
    if ref is None:
        return ((), 0)

    session = reader.open_document(ref)
    if session is None:
        logger.info("notice_document_unavailable run_id=%s case=%s", run_id, case_no)
        return ((), 0)

    pages: list[list[Any]] = []
    for page in range(NOTICE_TEXT_MAX_PAGES):
        pages.append(reader.fetch_text_page(session, page))
        table = parse_tenant_table(pages)
        if not table.continued:
            return (table.tenants, table.rejected)
    final = parse_tenant_table(pages)
    return (final.tenants, final.rejected)


def _search_result_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    data = payload.get("data")
    rows = data.get("dlt_srchResult") if isinstance(data, dict) else None
    return [row for row in rows if isinstance(row, dict)] if isinstance(rows, list) else []


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
