# 명세서 PDF 텍스트 레이어 → 점유자 표 파싱 테스트 (실측 좌표 픽스처 + 경계값)
# notice_pdf_texts_*.json은 서울동부 실측 응답이며 사람 이름만 같은 길이의 가명으로 바꿨다
import json
from datetime import date
from pathlib import Path

import pytest

from collector.notice_tenant_parser import parse_tenant_table

FIXTURES = Path(__file__).parent / "fixtures"
PAGE0_FIXTURE = FIXTURES / "notice_pdf_texts_page0.json"


def _page0() -> list[dict]:
    return json.loads(PAGE0_FIXTURE.read_text(encoding="utf-8"))


def _pages(name: str) -> list[list[dict]]:
    return [json.loads((FIXTURES / name).read_text(encoding="utf-8"))]


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


def test_multi_line_occupied_part_does_not_split_rows():
    # 2022타경52802 물건2 — 점유부분이 5줄로 감싸이며 §4-7 수율 붕괴를 일으킨 실측 문서.
    # 표의 실제 행은 3개: 현황조사(전부 미상 → 게이트 거부), 현황조사, 권리신고
    table = parse_tenant_table(_pages("notice_pdf_texts_52802_2.json"))

    assert len(table.tenants) == 2
    assert table.rejected == 1  # 전입일·보증금이 모두 미상인 진짜 임차인 행 — 게이트 설계대로

    survey, claim = table.tenants
    assert survey.tenant_name == "이영희"
    assert survey.source_kind == "현황조사"
    assert survey.occupied_part == "공부상 505호(실제표시 605호)"
    assert survey.move_in_date == date(2002, 2, 2)
    assert survey.fixed_date is None  # 미상
    assert survey.deposit_amount is None  # 미상

    assert claim.source_kind == "권리신고"
    assert claim.occupied_part == "505호"
    assert claim.lease_period == "2002.02.01.~ 현재까지"
    assert claim.deposit_amount == 50_000_000
    assert claim.move_in_date == date(2002, 2, 2)
    assert claim.fixed_date == date(2002, 2, 19)
    assert claim.demanded_distribution is True
    assert claim.demanded_distribution_date == date(2022, 7, 13)


def test_corporate_name_wrapped_over_five_lines_stays_one_row():
    # 2022타경2593 물건1 — 법인 성명이 5줄로 감싸인 1행 문서 (마지막 조각까지 붙어야 한다)
    table = parse_tenant_table(_pages("notice_pdf_texts_2593_1.json"))

    assert table.rejected == 0
    (tenant,) = table.tenants
    assert tenant.tenant_name == "에이파이낸셜대부주식회사"
    assert tenant.source_kind == "등기사항전부증명서"
    assert tenant.occupied_part == "302호"
    assert tenant.possession_basis == "주거 전세권자"
    assert tenant.lease_period == "2022.5.12.~2024.5.11."
    assert tenant.deposit_amount == 5_000_000


@pytest.mark.parametrize("goods_seq", [1, 2, 3, 4])
def test_explicit_no_tenant_notice_is_empty_not_rejected(goods_seq):
    # 2022타경55450 — 표 안에 "조사된 임차내역없음" 한 줄만 렌더되는 빈 표.
    # 행이 아니므로 거부 카운트에도 넣지 않는다 (rejected>0을 파싱 불신 신호로 쓰기 위함)
    table = parse_tenant_table(_pages(f"notice_pdf_texts_55450_{goods_seq}.json"))

    assert table.tenants == ()
    assert table.rejected == 0


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


def test_rowspan_tenant_shares_one_seq():
    """같은 점유자가 정보출처별로 두 행에 걸치면 성명은 병합 셀에 한 번만 렌더된다.

    실측(52802-2): 현황조사 행에 성명이 있고 권리신고 행은 성명이 비어 있는데 같은 사람이다.
    행 순번을 그대로 쓰면 1명이 2명으로 세어져 H3(임차인 수)이 어긋난다 (WP-11 §4-8).
    """
    table = parse_tenant_table(_pages("notice_pdf_texts_52802_2.json"))

    assert len(table.tenants) >= 2
    named = [t for t in table.tenants if t.tenant_name is not None]
    nameless = [t for t in table.tenants if t.tenant_name is None]
    assert named and nameless, "이 픽스처는 rowspan 사례여야 한다"
    # 성명 없는 행은 직전 점유자의 순번을 잇는다 — 서로 다른 사람으로 갈리면 안 된다
    assert {t.tenant_seq for t in table.tenants} == {t.tenant_seq for t in named}


def test_distinct_named_tenants_get_distinct_seq():
    """서로 다른 성명은 각자 다른 순번을 받는다 — 연속 규칙이 다른 사람까지 묶으면 안 된다."""
    rows = [
        {"tenant_name": "김철수", "source_kind": "권리신고", "deposit_amount": "10,000,000"},
        {"tenant_name": None, "source_kind": "현황조사", "deposit_amount": "10,000,000"},
        {"tenant_name": "이영희", "source_kind": "권리신고", "deposit_amount": "20,000,000"},
    ]
    from collector.notice_tenant_parser import _to_tenants

    tenants = _to_tenants(rows)

    assert [t.tenant_seq for t in tenants] == [1, 1, 2]


def test_deposit_increase_does_not_split_a_tenant_into_fragment_rows():
    """보증금 증액 사건 — 한 셀에 금액이 여러 줄로 적혀도 임차인이 쪼개지지 않는다.

    2025타경908 물건1 실측. 예전에는 금액·확정일자를 행 기준선(anchor)으로 써서
    `1)190,000,000` / `2)200,000,000` 두 줄이 각각 가짜 행이 됐고, 쪼개진 조각은
    정보출처가 없어 버려지면서 보증금이 통째로 사라졌다.
    """
    table = parse_tenant_table(_pages("notice_pdf_texts_908_1.json"))

    # 정보출처가 온전해야 한다 — 쪼개지면 '등기사항전' / '부증명서'로 잘린다
    assert all(
        t.source_kind in ("현황조사", "권리신고", "등기사항전부증명서") for t in table.tenants
    )
    assert len(table.tenants) == 10

    # 증액 표기 두 형태가 모두 현재 보증금으로 읽혀야 한다
    deposits = [t.deposit_amount for t in table.tenants if t.deposit_amount is not None]
    assert deposits == [200_000_000, 200_000_000, 200_000_000, 210_000_000, 210_000_000, 10_000_000, 15_000_000]


def test_tenant_row_without_move_in_date_still_parses():
    """전세권자처럼 전입신고일자·배당요구여부가 없는 문서는 금액·확정일자로 행을 잡는다."""
    table = parse_tenant_table(_pages("notice_pdf_texts_2593_1.json"))

    (tenant,) = table.tenants
    assert tenant.move_in_date is None
    assert tenant.deposit_amount == 5_000_000


@pytest.mark.parametrize(
    ("cell", "expected"),
    [
        ("15,000,000", 15_000_000),
        # 순번 표기는 뒤 번호가 증액 후 현재 보증금이다 (줄이 붙어 와도 경계가 흐트러지면 안 된다)
        ("1)200,000,0002)210,000,000", 210_000_000),
        ("1)190,000,000 2)200,000,000", 200_000_000),
        # 괄호 앞이 현재 보증금이고 괄호 안은 증액 내역 — 괄호 안을 집으면 2.1억을 1천만으로 읽는다
        ("210,000,000(2022.6.1.10,000,000증액)", 210_000_000),
        ("200,000,000(2023.2.2. 10,000,000 증액)", 200_000_000),
        ("미상", None),
        ("", None),
        (None, None),
        # 구사건 한글 표기는 그대로 살아 있어야 한다
        ("1억5천만원", 150_000_000),
    ],
)
def test_parse_amount_handles_increase_notations(cell, expected):
    from collector.notice_tenant_parser import _parse_amount

    assert _parse_amount(cell) == expected
