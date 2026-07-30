# 사진조회 응답 파싱 테스트 — 출처 매핑, 매직 바이트 형식 판별, 깨진 행 스킵
import base64
import json
from pathlib import Path

import pytest

from collector.court_parser import (
    PHOTO_SOURCE_APPRAISAL,
    PHOTO_SOURCE_ITEM,
    CourtPayloadError,
    parse_photo_page,
)


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "court_photo_page.json"


def _load_fixture() -> dict:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def test_parse_photo_page_maps_rows_to_photos():
    page = parse_photo_page(
        _load_fixture(), court_office_code="B000210", case_no="2022타경101244"
    )

    assert page.total_count == 3
    assert page.page_no == 1
    assert [p.seq for p in page.photos] == [1, 2, 8]
    assert [p.source for p in page.photos] == [
        PHOTO_SOURCE_ITEM,
        PHOTO_SOURCE_ITEM,
        PHOTO_SOURCE_APPRAISAL,
    ]
    first = page.photos[0]
    assert first.court_office_code == "B000210"
    assert first.case_no == "2022타경101244"
    assert first.url == "/nas_e_image_pgj/kj/2022/0101/B000210202201301012441.jpg"
    assert first.caption == "도로명"
    assert first.image == b"\xff\xd8\xff\xe0JFIF-fixture"


def test_parse_photo_page_detects_content_type_from_magic_bytes():
    # 실측: 확장자가 .jpg여도 실제 바이트가 GIF인 사진이 있다 — 확장자를 믿지 않는다
    page = parse_photo_page(
        _load_fixture(), court_office_code="B000210", case_no="2022타경101244"
    )

    assert [p.content_type for p in page.photos] == ["image/jpeg", None, "image/gif"]


def test_parse_photo_page_skips_broken_base64_row_only():
    payload = _load_fixture()
    payload["data"]["picLst"][1] = "!!!깨진base64!!!"

    page = parse_photo_page(payload, court_office_code="B000210", case_no="2022타경101244")

    assert [p.seq for p in page.photos] == [1, 8]


def test_parse_photo_page_zips_meta_and_blobs_to_shorter_side():
    payload = _load_fixture()
    payload["data"]["picLst"] = payload["data"]["picLst"][:2]

    page = parse_photo_page(payload, court_office_code="B000210", case_no="2022타경101244")

    assert [p.seq for p in page.photos] == [1, 2]


def test_parse_photo_page_handles_missing_lists_as_empty():
    payload = _load_fixture()
    del payload["data"]["dlt_csPicLst"]
    del payload["data"]["picLst"]

    page = parse_photo_page(payload, court_office_code="B000210", case_no="2022타경101244")

    assert page.photos == []
    assert page.total_count == 3


def test_parse_photo_page_requires_data_object():
    with pytest.raises(CourtPayloadError):
        parse_photo_page({}, court_office_code="B000210", case_no="2022타경101244")


def test_parse_photo_page_skips_empty_image():
    payload = _load_fixture()
    payload["data"]["picLst"][0] = base64.b64encode(b"").decode()

    page = parse_photo_page(payload, court_office_code="B000210", case_no="2022타경101244")

    assert [p.seq for p in page.photos] == [2, 8]
