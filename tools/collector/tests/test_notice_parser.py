# 매각물건명세서 파서 단위 테스트 — 최선순위 설정 표기 변형·항목 누락·개인정보 미저장을 검증
import json
from dataclasses import fields
from datetime import date
from pathlib import Path

from collector.court_parser import ItemNotice, mask_person_names, parse_item_notice


FIXTURE = Path(__file__).parent / "fixtures" / "court_item_detail_page.json"


def _load() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def _parse(payload: dict) -> ItemNotice | None:
    return parse_item_notice(
        payload,
        court_office_code="B000210",
        case_no="2022타경101244",
        item_no="1",
    )


def test_parse_item_notice_maps_all_present_fields():
    notice = _parse(_load())

    assert notice is not None
    assert notice.court_office_code == "B000210"
    assert notice.case_no == "2022타경101244"
    assert notice.item_no == "1"
    assert notice.document_date == date(2026, 7, 3)
    assert notice.distribution_demand_deadline == date(2025, 3, 10)
    # 토지와 집합건물의 최선순위를 따로 적는 사건 — 원문을 그대로 두고 가장 이른 날짜를 고른다
    assert notice.baseline_raw is not None
    assert "집합건물" in notice.baseline_raw
    assert notice.baseline_date == date(2003, 5, 23)
    assert notice.remarks is not None and "토지 별도등기" in notice.remarks
    # 공란인 항목은 None — 인수되는 권리 없음
    assert notice.assumed_rights_note is None
    assert notice.superficies_note is None


def test_parse_item_notice_reads_dotted_and_padded_date_formats():
    payload = _load()
    dxdy = payload["data"]["dma_result"]["dspslGdsDxdyInfo"]
    dxdy["tprtyRnkHypthcStngDts"] = "2024.12.11. 경매개시결정\n2022.1.12.압류"

    notice = _parse(payload)

    assert notice is not None
    assert notice.baseline_date == date(2022, 1, 12)


def test_parse_item_notice_keeps_baseline_raw_when_date_is_unparsable():
    payload = _load()
    dxdy = payload["data"]["dma_result"]["dspslGdsDxdyInfo"]
    dxdy["tprtyRnkHypthcStngDts"] = "최선순위 설정일자 미상"

    notice = _parse(payload)

    assert notice is not None
    assert notice.baseline_raw == "최선순위 설정일자 미상"
    assert notice.baseline_date is None


def test_parse_item_notice_ignores_impossible_date_in_baseline():
    payload = _load()
    dxdy = payload["data"]["dma_result"]["dspslGdsDxdyInfo"]
    dxdy["tprtyRnkHypthcStngDts"] = "2024.02.31. 근저당권\n2024.03.01. 압류"

    notice = _parse(payload)

    assert notice is not None
    assert notice.baseline_date == date(2024, 3, 1)


def test_parse_item_notice_survives_missing_optional_blocks():
    payload = _load()
    del payload["data"]["dma_result"]["dstrtDemnInfo"]
    payload["data"]["dma_result"]["dspslGdsDxdyInfo"]["gdsSpcfcRmk"] = "   "

    notice = _parse(payload)

    assert notice is not None
    assert notice.distribution_demand_deadline is None
    assert notice.remarks is None
    assert notice.document_date == date(2026, 7, 3)


def test_parse_item_notice_returns_none_when_notice_not_written_yet():
    payload = _load()
    dxdy = payload["data"]["dma_result"]["dspslGdsDxdyInfo"]
    dxdy["gdsSpcfcWrtYmd"] = None
    dxdy["tprtyRnkHypthcStngDts"] = None

    assert _parse(payload) is None


def test_parse_item_notice_returns_none_for_broken_payload():
    assert _parse({"status": 200, "data": {"ipcheck": True}}) is None
    assert _parse({}) is None
    assert _parse({"data": {"dma_result": []}}) is None


def test_item_notice_has_no_personal_name_field():
    """개인정보(A-08): 명세서에는 실명이 있지만 저장 구조에는 이름 필드를 두지 않는다."""
    field_names = {field.name for field in fields(ItemNotice)}

    assert not {name for name in field_names if "name" in name or "nm" in name.lower()}


def test_mask_person_names_hides_lien_filer_name():
    """실측된 비고란 — 유치권 신고인 실명이 그대로 실린다 (2026-07-29 수집분에서 발견)."""
    raw = "-2008.11.28. 이재선 유치권신고(879,596,895원)하였으나, 성립여부 불분명함"

    masked = mask_person_names(raw)

    assert "이재선" not in masked
    assert "이OO 유치권신고" in masked
    # 위험 신호(금액·성립여부)는 그대로 남아야 한다
    assert "879,596,895원" in masked
    assert "성립여부 불분명함" in masked


def test_mask_person_names_keeps_role_words():
    """역할 낱말을 이름으로 오인해 가리면 문장 뜻이 망가진다."""
    raw = "임차인 권리신고 및 배당요구신청서 제출, 점유자 신고 있음"

    masked = mask_person_names(raw)

    assert masked == raw


def test_mask_person_names_leaves_factual_remarks_untouched():
    """실측 비고란 중 개인정보가 없는 줄은 한 글자도 바뀌지 않아야 한다."""
    for raw in (
        "-개시결정 당시에는 대지권 미등기이나, 이후 대지권등기가 완료되어 이를 포함하여 매각함",
        "-건축법상 사용승인 받지 않은 장기미준공 건물(사전입주 및 5층 무단증축으로 인해)",
        "-102호 누수 있음",
        "-토지 별도등기 있음(가등기, 근저당권)",
    ):
        assert mask_person_names(raw) == raw


def test_mask_person_names_handles_none():
    assert mask_person_names(None) is None


def test_parse_item_notice_masks_names_in_free_text():
    payload = _load()
    dxdy = payload["data"]["dma_result"]["dspslGdsDxdyInfo"]
    dxdy["gdsSpcfcRmk"] = "2008.11.28. 이재선 유치권신고(879,596,895원)"
    dxdy["ndstrcRghCtt"] = "박상우 권리신고 있음"

    notice = _parse(payload)

    assert notice is not None
    assert "이재선" not in (notice.remarks or "")
    assert "박상우" not in (notice.assumed_rights_note or "")
