import json
from pathlib import Path

import pytest

from collector.court_parser import CourtPayloadError, parse_search_page


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "court_search_page.json"


def test_parse_search_page_maps_required_fields():
    payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))

    page = parse_search_page(payload)

    assert page.total_count == 2
    assert page.page_no == 1
    assert len(page.items) == 2
    first = page.items[0]
    assert first.court_office_code == "B000210"
    assert first.case_no == "2024타경12345"
    assert first.item_no == "1"
    assert first.appraisal_amount == 500_000_000
    assert first.minimum_sale_price == 400_000_000
    assert first.location == (127.013292, 37.492361)


def test_parse_search_page_allows_empty_page():
    page = parse_search_page({"data": {"totalCnt": 0, "pageNo": 3, "items": []}})

    assert page.total_count == 0
    assert page.page_no == 3
    assert page.items == []


def test_parse_search_page_rejects_missing_natural_key():
    payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    del payload["data"]["items"][0]["csNo"]

    with pytest.raises(CourtPayloadError, match="csNo"):
        parse_search_page(payload)
