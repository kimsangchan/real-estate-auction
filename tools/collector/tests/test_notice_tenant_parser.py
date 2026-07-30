# 명세서 PDF 텍스트 레이어 → 점유자 표 파싱 테스트 (실측 좌표 픽스처 + 경계값)
import json
from datetime import date
from pathlib import Path

from collector.notice_tenant_parser import parse_tenant_table

PAGE0_FIXTURE = Path(__file__).parent / "fixtures" / "notice_pdf_texts_page0.json"


def _page0() -> list[dict]:
    return json.loads(PAGE0_FIXTURE.read_text(encoding="utf-8"))


def test_parses_two_source_rows_of_same_property():
    table = parse_tenant_table([_page0()])

    assert len(table.tenants) == 2
    assert [t.source_kind for t in table.tenants] == ["등기사항전부증명서", "권리신고"]
    assert [t.occupied_part for t in table.tenants] == ["206호", "206호"]


def test_reassembles_cells_wrapped_across_lines():
    first, second = parse_tenant_table([_page0()]).tenants

    # 컬럼 폭보다 긴 값은 셀 안에서 줄바꿈된다 — 위→아래로 이어붙여야 원문이 된다
    assert first.source_kind == "등기사항전부증명서"
    assert first.possession_basis == "주거 주택임차권자"
    assert second.tenant_name == "주택도시보증공사"
    assert second.possession_basis == "주거 임차인"


def test_extracts_dates_amounts_and_distribution_demand():
    first, second = parse_tenant_table([_page0()]).tenants

    assert first.deposit_amount == 230_000_000
    assert first.move_in_date == date(2021, 6, 4)
    assert first.fixed_date == date(2021, 6, 4)
    assert first.monthly_rent is None  # 차임 공란은 흔하다
    assert first.lease_period == "2021.06.04~"
    assert first.demanded_distribution is None  # 공란 — 요구 안 했다고 단정하지 않는다

    assert second.demanded_distribution is True
    assert second.demanded_distribution_date == date(2023, 11, 30)


def test_assigns_tenant_seq_per_person_not_per_row():
    tenants = parse_tenant_table([_page0()]).tenants

    # 이름이 다르면 순번도 다르다
    assert [t.tenant_seq for t in tenants] == [1, 2]


def test_marks_table_as_terminated_when_remarks_section_present():
    assert parse_tenant_table([_page0()]).continued is False


def test_returns_empty_when_header_absent():
    table = parse_tenant_table([[{"text": "부동산의 표시", "rect": [{"left": 1, "right": 2, "bottom": 3, "top": 4}]}]])

    assert table.tenants == ()


def test_ignores_malformed_lines():
    assert parse_tenant_table([[{"text": None}, "not-a-dict", {"rect": []}]]).tenants == ()


def test_parses_korean_amount_notation_of_old_cases():
    from collector.notice_tenant_parser import _parse_amount

    assert _parse_amount("230,000,000") == 230_000_000
    assert _parse_amount("천만원") == 10_000_000
    assert _parse_amount("1억 5천만원") == 150_000_000
    assert _parse_amount("2억원") == 200_000_000
    assert _parse_amount("미상") is None
    assert _parse_amount("보증금 없음") is None
    assert _parse_amount(None) is None


def test_unknown_fixed_date_becomes_null():
    from collector.notice_tenant_parser import _parse_date

    assert _parse_date("2021.06.04") == date(2021, 6, 4)
    assert _parse_date("미상") is None
    assert _parse_date("2021.13.40") is None
    assert _parse_date(None) is None
