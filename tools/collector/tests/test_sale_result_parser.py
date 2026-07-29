# 매각 결과 파서 단위 테스트 — 결과코드 분기·금액 없음·필드 누락을 실측 fixture로 검증
import json
from datetime import date
from pathlib import Path

from collector.court_parser import (
    SOURCE_CASE_SEARCH,
    SOURCE_SCHEDULE_RESULT_SEARCH,
    parse_case_sale_results,
    parse_sale_result_page,
)


SALE_RESULT_FIXTURE = Path(__file__).parent / "fixtures" / "court_sale_result_page.json"
CASE_SEARCH_FIXTURE = Path(__file__).parent / "fixtures" / "court_case_search_page.json"


def _load_sale_result_payload() -> dict:
    return json.loads(SALE_RESULT_FIXTURE.read_text(encoding="utf-8"))


def _load_case_search_payload() -> dict:
    return json.loads(CASE_SEARCH_FIXTURE.read_text(encoding="utf-8"))


def test_parse_sale_result_page_maps_sold_and_failed_rows():
    page = parse_sale_result_page(_load_sale_result_payload())

    assert page.total_count == 3
    assert page.page_no == 1
    assert len(page.results) == 3

    sold = page.results[0]
    assert sold.court_office_code == "B000210"
    assert sold.case_no == "2024타경106335"
    assert sold.item_no == "1"
    assert sold.dxdy_date == date(2026, 7, 22)
    assert sold.dxdy_kind_code == "01"
    assert sold.result_code == "001"
    assert sold.sale_amount == 512_555_000
    assert sold.minimum_sale_price == 296_000_000
    assert sold.failed_bid_count == 1
    assert sold.source == SOURCE_SCHEDULE_RESULT_SEARCH

    failed = page.results[1]
    assert failed.result_code == "002"
    assert failed.sale_amount is None  # maeAmt "0"은 낙찰가 없음
    assert failed.minimum_sale_price == 88_184_767

    # 물건번호(maemulSer)와 목적물번호(mokmulSer)가 갈라지는 사건 — item_no는 mokmulSer 기준
    diverged = page.results[2]
    assert diverged.case_no == "2024타경109389"
    assert diverged.item_no == "3"
    assert diverged.failed_bid_count == 8


def test_parse_sale_result_page_skips_row_with_unknown_status():
    payload = _load_sale_result_payload()
    payload["data"]["dlt_srchResult"][0]["mulStatcd"] = "01"  # 진행 중 — 결과 아님

    page = parse_sale_result_page(payload)

    assert len(page.results) == 2
    assert {r.case_no for r in page.results} == {"2022타경101244", "2024타경109389"}


def test_parse_sale_result_page_skips_row_with_missing_fields_only():
    payload = _load_sale_result_payload()
    del payload["data"]["dlt_srchResult"][0]["mokmulSer"]
    payload["data"]["dlt_srchResult"][1]["maeGiil"] = ""

    page = parse_sale_result_page(payload)

    assert len(page.results) == 1
    assert page.results[0].case_no == "2024타경109389"


def test_parse_sale_result_page_skips_row_with_invalid_amount():
    payload = _load_sale_result_payload()
    payload["data"]["dlt_srchResult"][0]["maeAmt"] = "abc"

    page = parse_sale_result_page(payload)

    assert len(page.results) == 2


def test_parse_sale_result_page_allows_empty_page():
    page = parse_sale_result_page(
        {"data": {"dma_pageInfo": {"totalCnt": 0, "pageNo": 1}, "dlt_srchResult": []}}
    )

    assert page.total_count == 0
    assert page.results == []


def test_parse_case_sale_results_maps_sale_and_decision_days():
    results = parse_case_sale_results(
        _load_case_search_payload(), court_office_code="B000210", case_no="2023타경4722"
    )

    assert len(results) == 2

    sale_day = results[0]
    assert sale_day.court_office_code == "B000210"
    assert sale_day.case_no == "2023타경4722"
    assert sale_day.item_no == "1"
    assert sale_day.dxdy_date == date(2026, 7, 16)
    assert sale_day.dxdy_kind_code == "01"
    assert sale_day.result_code == "001"
    assert sale_day.sale_amount == 5_210_000
    assert sale_day.minimum_sale_price == 5_201_000
    assert sale_day.failed_bid_count is None  # 사건검색은 유찰 횟수를 주지 않는다
    assert sale_day.source == SOURCE_CASE_SEARCH

    decision_day = results[1]
    assert decision_day.dxdy_date == date(2026, 7, 23)
    assert decision_day.dxdy_kind_code == "02"
    assert decision_day.result_code == "003"
    assert decision_day.sale_amount is None
    assert decision_day.minimum_sale_price is None


def test_parse_case_sale_results_returns_empty_without_case_info():
    # 종국 사건 등 "조회 되는 사건번호 정보가 없습니다" 응답
    results = parse_case_sale_results(
        {"status": 200, "data": {"ipcheck": True}},
        court_office_code="B000210",
        case_no="2020타경1",
    )

    assert results == []


def test_parse_case_sale_results_skips_day_without_result_code():
    payload = _load_case_search_payload()
    payload["data"]["dlt_rletCsGdsDtsDxdyInf"][0]["auctnDxdyRsltCd"] = None  # 결과 없는 기일

    results = parse_case_sale_results(
        payload, court_office_code="B000210", case_no="2023타경4722"
    )

    assert len(results) == 1
    assert results[0].dxdy_kind_code == "02"


def test_parse_case_sale_results_skips_day_without_matching_goods():
    payload = _load_case_search_payload()
    payload["data"]["dlt_dspslGdsDspslObjctLst"] = []  # 물건 목록 없음 → item_no를 알 수 없다

    results = parse_case_sale_results(
        payload, court_office_code="B000210", case_no="2023타경4722"
    )

    assert results == []


def test_parse_case_sale_results_drops_amounts_for_other_announcement_day():
    payload = _load_case_search_payload()
    # 물건의 현재 공고 기일이 다른 날이면 낙찰가·최저가를 그 기일 것으로 붙이지 않는다
    payload["data"]["dlt_dspslGdsDspslObjctLst"][0]["dspslDxdyYmd"] = "20260801"

    results = parse_case_sale_results(
        payload, court_office_code="B000210", case_no="2023타경4722"
    )

    assert len(results) == 2
    assert results[0].sale_amount is None
    assert results[0].minimum_sale_price is None
