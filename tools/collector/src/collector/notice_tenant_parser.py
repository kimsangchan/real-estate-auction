# 매각물건명세서 PDF 텍스트 레이어(streamdocs texts)에서 점유자(임차인) 표를 좌표로 복원한다
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from typing import Any


# 점유자 표 컬럼의 x 경계 (실측 — 대법원 매각물건명세서 표준 양식, 좌표 단위는 PDF 포인트).
# 셀 값이 컬럼 폭보다 길면 같은 셀 안에서 여러 줄로 나뉘므로 x로 컬럼을, y로 행을 정한다.
_COLUMNS: tuple[tuple[str, int, int], ...] = (
    ("tenant_name", 30, 73),
    ("occupied_part", 73, 110),
    ("source_kind", 110, 160),
    ("possession_basis", 160, 198),
    ("lease_period", 198, 268),
    ("deposit_amount", 268, 325),
    ("monthly_rent", 325, 381),
    ("move_in_date", 381, 447),
    ("fixed_date", 447, 506),
    ("demanded_distribution", 506, 570),
)

# 값이 줄바꿈 없이 한 줄로만 적히는 컬럼들 — 행의 기준선(anchor)을 잡는 데 쓴다.
# 점유부분은 앵커가 아니다 — "공부상 505호(실제표시 605호)"처럼 5줄로 감싸인 실측이 있다.
# 앵커로 쓰면 감싸인 줄마다 가짜 행이 생긴다 (WP-11 §4-7의 수율 붕괴 원인).
#
# 보증금·차임·확정일자도 같은 이유로 뺐다. "한 줄"이라던 전제가 틀렸다 — 보증금 증액 사건은
# 한 셀에 `1)190,000,000` / `2)200,000,000`을, 등기 임차권은 `200,000,000` / `(2023.2.2.` /
# `10,000,000` / `증액)`을 여러 줄로 적는다(실측 B000210 2025타경908). 확정일자도 증액분마다
# `1)`,`2)`로 나뉜다. 이들을 앵커로 쓰면 한 임차인이 3~4행으로 쪼개지고, 쪼개진 조각은
# 정보출처가 없어 검증 게이트에서 버려진다 — 보증금이 통째로 사라지는 경로였다.
#
# 전입신고일자와 배당요구여부는 값이 날짜 하나뿐이라 실제로 행마다 한 줄이다
# (실측 같은 문서: 전입일 앵커 간격 최소 32pt, 셀 내부 줄바꿈 간격 6.5pt).
_ANCHOR_FIELDS = (
    "move_in_date",
    "demanded_distribution",
)

# 전세권자처럼 전입신고일자·배당요구여부가 아예 없는 행만 있는 문서를 위한 대비책
# (실측 2022타경2593 물건1 — 등기 전세권 1행). 이때만 금액·확정일자로 행을 잡는다.
# 두 종류가 섞인 문서에서는 전입일이 있는 행만 잡히므로 완전하지 않다.
_FALLBACK_ANCHOR_FIELDS = ("deposit_amount", "monthly_rent", "fixed_date")

# 표 머리글 식별 — "점유자"와 "정보출처"가 같은 줄에 오는 것이 이 표의 특징이다
_HEADER_KEYWORDS = (
    "정보출처",
    "점유의",
    "임대차기간",
    "보 증 금",
    "확정일자",
    "요구여부",
    "성  명",
    "(점유기간)",
    "(배당요구일자)",
    "신청일자",
    "류지변경신고)",
)

# 표 아래 경계 — 명세서 양식에서 표 다음에 반드시 오는 란
_TABLE_END_MARKERS = ("<비고>", "비고란", "※")

_DATE_PATTERN = re.compile(r"(\d{4})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})")
_DIGIT_AMOUNT_PATTERN = re.compile(r"^[0-9][0-9,]*$")
# 한 셀에 금액이 여러 개 적힌 증액 사건에서 금액만 골라낸다. 천단위 콤마를 요구해야
# `1)200,000,0002)210,000,000`처럼 줄이 붙어버린 문자열에서도 경계가 흐트러지지 않는다.
_AMOUNT_IN_TEXT_PATTERN = re.compile(r"\d{1,3}(?:,\d{3})+")
# `1)…2)…` 형태의 순번 표기 — 뒤 번호가 현재(증액 후) 보증금이다.
_NUMBERED_AMOUNT_PATTERN = re.compile(r"\d\)\s*\d")
# 구사건은 보증금을 "천만원"·"1억5천만원" 같은 한글로 적는다 (실측).
# 억·만은 앞의 값을 묶는 큰 단위, 천·백·십은 그 안에서 더해지는 작은 단위다
_KOREAN_BIG_UNITS = {"억": 100_000_000, "만": 10_000}
_KOREAN_SMALL_UNITS = {"천": 1_000, "백": 100, "십": 10}
_UNKNOWN_VALUES = ("미상", "불명", "없음", "-")

# 같은 행의 앵커 후보(한 줄 컬럼 값들의 세로 중앙)를 하나로 묶는 허용 오차.
# 실측 줄높이 ~10pt, 인접 행의 앵커 간격은 45pt 이상이라 8이면 안전하다
_ANCHOR_MERGE_TOLERANCE = 8

# 법원이 점유자 없음을 명시할 때 표 안에 이 문구 한 줄만 렌더된다 (실측: "조사된 임차내역없음").
# 행이 아니라 빈 표이므로 파싱 대상에서 제외한다
_NO_TENANT_MARKER = "임차내역없음"


@dataclass(frozen=True)
class NoticeTenant:
    """auction_item_notice_tenant 한 행 — 명세서 점유자 표의 셀 값.

    같은 임차인이 정보출처별로 여러 행에 나오므로 행을 합치지 않고 source_kind로 구분해
    각각 저장한다. tenant_seq는 이름으로 묶은 동일인 순번이다 (WP-11 §4-3).

    row_no는 문서상 행 순서(1부터)다. 저장소의 고유키라서 필요하다 — 한 사람이 같은 정보출처로
    두 행을 갖는 문서가 실제로 있어 (tenant_seq, source_kind)로는 행을 구분할 수 없다.
    """

    row_no: int
    tenant_seq: int
    tenant_name: str | None
    source_kind: str | None
    occupied_part: str | None
    possession_basis: str | None
    lease_period: str | None
    deposit_amount: int | None
    monthly_rent: int | None
    move_in_date: date | None
    fixed_date: date | None
    demanded_distribution: bool | None
    demanded_distribution_date: date | None


@dataclass(frozen=True)
class TenantTable:
    """파싱 결과. `continued`는 표가 다음 페이지로 이어질 수 있음을 뜻한다.

    `rejected`는 검증 게이트에서 버린 행 수다. 좌표 기반 표 복원이 양식에 따라 셀 조각을
    별개 행으로 쪼개는 경우가 있어(실측: 10개 문서에서 20행 중 15행이 조각), 최소 요건을
    못 갖춘 행은 저장하지 않고 세기만 한다 — 쓰레기를 DB에 넣는 것보다 낫다 (WP-11 §4-6).
    """

    tenants: tuple[NoticeTenant, ...]
    continued: bool
    rejected: int = 0


# 정보출처 정상값 — 이 셋 중 하나가 아니면 행 경계 자체가 잘못 잡힌 것으로 본다
_VALID_SOURCE_KINDS = ("현황조사", "권리신고", "등기사항전부증명서")


def _is_usable(tenant: NoticeTenant) -> bool:
    """저장할 가치가 있는 행인지 판정한다.

    정보출처가 정상값이어야 하고(행 경계가 제대로 잡혔다는 신호), 그 위에 권리분석에 쓸 값이
    하나라도 있어야 한다. 전입일은 엔진 `Tenant`의 필수 입력이고, 보증금은 인수액 계산의 기초다.
    """
    if tenant.source_kind not in _VALID_SOURCE_KINDS:
        return False
    return tenant.move_in_date is not None or tenant.deposit_amount is not None


def parse_tenant_table(pages: list[list[Any]]) -> TenantTable:
    """streamdocs texts 응답(페이지별 라인 목록)에서 점유자 표를 복원한다.

    표 머리글을 못 찾으면 빈 결과를 돌려준다 — 양식이 다른 문서에서 엉뚱한 값을 만들지 않는다.
    """
    rows: list[dict[str, str]] = []
    continued = False

    for lines in pages:
        fragments = _fragments(lines)
        bounds = _table_bounds(fragments)
        if bounds is None:
            continue
        top, bottom, has_end_marker = bounds
        rows.extend(_rows_in_region(fragments, top=top, bottom=bottom))
        continued = not has_end_marker

    parsed = _to_tenants(rows)
    usable = tuple(tenant for tenant in parsed if _is_usable(tenant))
    return TenantTable(
        tenants=usable, continued=continued, rejected=len(parsed) - len(usable)
    )


def _fragments(lines: list[Any]) -> list[dict[str, Any]]:
    """라인 목록을 문자 단위 조각으로 펼친다 — 한 라인에 여러 셀이 섞여 있어 문자로 나눠야 한다."""
    fragments: list[dict[str, Any]] = []
    for line in lines:
        if not isinstance(line, dict):
            continue
        text = line.get("text")
        rects = line.get("rect")
        if not isinstance(text, str) or not isinstance(rects, list):
            continue
        last_index = len(text) - 1
        for index, (char, rect) in enumerate(zip(text, rects, strict=False)):
            if not isinstance(rect, dict):
                continue
            fragments.append(
                {
                    "char": char,
                    "x1": _number(rect.get("left")),
                    "x2": _number(rect.get("right")),
                    "y1": _number(rect.get("bottom")),
                    "y2": _number(rect.get("top")),
                    # 원문 라인의 마지막 문자인지 — 셀 사이를 벌리는 공백과 셀 안의 공백을 가른다
                    "at_line_end": index == last_index,
                }
            )
    return fragments


def _table_bounds(fragments: list[dict[str, Any]]) -> tuple[float, float, bool] | None:
    """표 영역의 위/아래 y 경계와, 아래 경계가 명세서의 종료 표시였는지를 돌려준다."""
    lines = _group_lines(fragments)
    header_index = next(
        (
            index
            for index, line in enumerate(lines)
            if "점유자" in line["text"] and "정보출처" in line["text"]
        ),
        None,
    )
    if header_index is None:
        return None

    # 머리글은 여러 줄로 감싸진다 — 아래로 내려가며 머리글 단어가 계속 나오는 동안 이어붙인다
    header_bottom = lines[header_index]["y1"]
    for line in lines[header_index + 1 :]:
        if not any(keyword in line["text"] for keyword in _HEADER_KEYWORDS):
            break
        header_bottom = line["y1"]

    for line in lines:
        if line["y2"] < header_bottom and any(
            line["text"].lstrip().startswith(marker) for marker in _TABLE_END_MARKERS
        ):
            return (header_bottom, line["y2"], True)
    return (header_bottom, 0.0, False)


def _group_lines(fragments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """문자 조각을 y 밴드로 묶어 라인으로 되돌린다 (y 내림차순)."""
    lines: list[list[dict[str, Any]]] = []
    for fragment in sorted(fragments, key=lambda f: (-f["y2"], f["x1"])):
        for line in lines:
            if abs(line[0]["y2"] - fragment["y2"]) <= 3:
                line.append(fragment)
                break
        else:
            lines.append([fragment])
    return [
        {
            "y1": min(f["y1"] for f in line),
            "y2": line[0]["y2"],
            "text": "".join(f["char"] for f in sorted(line, key=lambda f: f["x1"])),
        }
        for line in lines
    ]


def _rows_in_region(
    fragments: list[dict[str, Any]], *, top: float, bottom: float
) -> list[dict[str, str]]:
    """표 영역의 조각을 행으로 묶고 컬럼별 문자열 셀을 만든다.

    셀은 행 상자 안에서 세로 중앙정렬로 렌더된다 (실측). 앵커(한 줄 컬럼 값)가 행의 세로
    중앙이므로, 행의 위 경계가 b이면 아래 경계는 2*앵커 - b다. 이 경계로 조각을 나누면
    여러 줄로 감싸인 셀(점유부분·성명 등)이 인접 행으로 새거나 행을 쪼개지 않는다.
    """
    region = [f for f in fragments if bottom < f["y2"] < top]
    if not region:
        return []

    anchors = _row_anchors(region)
    if not anchors:
        return []

    buckets: list[list[dict[str, Any]]] = [[] for _ in anchors]
    upper = top
    for index, anchor in enumerate(anchors):
        lower = 2 * anchor - upper
        following = anchors[index + 1] if index + 1 < len(anchors) else None
        if following is not None and lower <= following:
            # 중앙정렬 전제가 깨진 문서 — 다음 앵커를 침범하지 않게 두 앵커의 중점으로 물러선다
            lower = (anchor + following) / 2
        for fragment in region:
            if lower < (fragment["y1"] + fragment["y2"]) / 2 <= upper:
                buckets[index].append(fragment)
        upper = lower

    rows = [cells for cells in (_cells(bucket) for bucket in buckets) if cells]
    return [
        row
        for row in rows
        if _NO_TENANT_MARKER not in "".join(row.values()).replace(" ", "")
    ]


def _row_anchors(region: list[dict[str, Any]]) -> list[float]:
    """행의 세로 중앙 y 목록. 한 줄로만 적히는 컬럼 값의 세로 중앙이 행의 중앙과 일치한다."""
    anchors = _anchors_from(region, _ANCHOR_FIELDS)
    return anchors if anchors else _anchors_from(region, _FALLBACK_ANCHOR_FIELDS)


def _anchors_from(region: list[dict[str, Any]], fields: tuple[str, ...]) -> list[float]:
    candidates = sorted(
        {
            (fragment["y1"] + fragment["y2"]) / 2
            for fragment in region
            if _column_of(fragment) in fields and not fragment["char"].isspace()
        },
        reverse=True,
    )
    anchors: list[float] = []
    for y in candidates:
        if not anchors or anchors[-1] - y > _ANCHOR_MERGE_TOLERANCE:
            anchors.append(y)
    return anchors


def _cells(fragments: list[dict[str, Any]]) -> dict[str, str]:
    """한 행의 조각을 컬럼별 문자열로 만든다.

    셀 안에서 줄바꿈된 값은 위에서 아래 순으로 이어붙인다. 이때 원문 라인 끝의 공백만 살린다 —
    한 라인에 여러 셀이 함께 렌더링되므로, 라인 중간의 공백은 셀 사이를 벌리는 간격이라
    이어붙일 때 붙여 쓰면 "주거 주택임차권자"가 "주거 주택임 차권자"로 어긋난다.
    """
    by_column: dict[str, list[dict[str, Any]]] = {}
    for fragment in fragments:
        if fragment["char"].isspace() and not fragment["at_line_end"]:
            continue
        column = _column_of(fragment)
        if column is not None:
            by_column.setdefault(column, []).append(fragment)

    cells: dict[str, str] = {}
    for column, items in by_column.items():
        items.sort(key=lambda f: (-f["y2"], f["x1"]))
        text = " ".join("".join(f["char"] for f in items).split())
        if text:
            cells[column] = text
    return cells


def _column_of(fragment: dict[str, Any]) -> str | None:
    center = (fragment["x1"] + fragment["x2"]) / 2
    for name, left, right in _COLUMNS:
        if left <= center < right:
            return name
    return None


def _to_tenants(rows: list[dict[str, str]]) -> tuple[NoticeTenant, ...]:
    """셀 문자열 행을 저장용 값으로 바꾸고 동일인 순번(tenant_seq)을 부여한다.

    한 점유자가 정보출처별로 여러 행에 걸칠 때(rowspan) 성명은 **병합 셀에 한 번만** 렌더된다.
    따라서 성명이 없는 행은 직전 점유자의 연속으로 보고 같은 순번을 잇는다 —
    행 순번을 그대로 쓰면 한 사람이 여럿으로 세어져 H3(임차인 수)이 어긋난다 (WP-11 §4-8).
    """
    seq_by_name: dict[str, int] = {}
    tenants: list[NoticeTenant] = []
    previous_seq: int | None = None

    # row_no는 검증 게이트 이전의 문서상 순서다 — 버려진 행 자리에 번호가 비지만 고유하면 된다
    for row_no, row in enumerate(rows, start=1):
        name = row.get("tenant_name")
        if name is None:
            # 첫 행부터 성명이 없으면 이을 앞 행이 없으므로 새 순번을 연다
            seq = previous_seq if previous_seq is not None else len(seq_by_name) + 1
        else:
            seq = seq_by_name.setdefault(name, len(seq_by_name) + 1)
        previous_seq = seq

        demanded_text = row.get("demanded_distribution")
        demanded_date = _parse_date(demanded_text)
        tenants.append(
            NoticeTenant(
                row_no=row_no,
                tenant_seq=seq,
                tenant_name=name,
                source_kind=row.get("source_kind"),
                occupied_part=row.get("occupied_part"),
                possession_basis=row.get("possession_basis"),
                lease_period=row.get("lease_period"),
                deposit_amount=_parse_amount(row.get("deposit_amount")),
                monthly_rent=_parse_amount(row.get("monthly_rent")),
                move_in_date=_parse_date(row.get("move_in_date")),
                fixed_date=_parse_date(row.get("fixed_date")),
                demanded_distribution=_parse_demanded(demanded_text, demanded_date),
                demanded_distribution_date=demanded_date,
            )
        )
    return tuple(tenants)


def _parse_date(text: str | None) -> date | None:
    """"2021.06.04" 형태를 날짜로 바꾼다. "미상" 등은 None (실측 — 확정일자에 자주 나온다)."""
    if text is None or any(unknown in text for unknown in _UNKNOWN_VALUES):
        return None
    match = _DATE_PATTERN.search(text)
    if match is None:
        return None
    try:
        return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
    except ValueError:
        return None


def _parse_amount(text: str | None) -> int | None:
    """금액 셀을 정수로 바꾼다. 숫자 표기와 한글 표기(구사건)를 모두 받고, 모르면 None.

    보증금 증액 사건은 한 셀에 금액을 여러 개 적는다 (실측 B000210 2025타경908):

    - `1)200,000,000 2)210,000,000` — 순번이 붙으면 **뒤 번호가 증액 후 현재 보증금**이다.
    - `210,000,000(2022.6.1. 10,000,000 증액)` — 괄호 앞이 현재 보증금이고
      괄호 안은 증액된 금액과 시점이다. 괄호 안 금액을 집으면 2.1억을 1천만으로 읽는다.

    권리분석에 필요한 값은 어느 쪽이든 **현재 보증금**이라 그것만 남긴다.
    """
    if text is None:
        return None
    cleaned = text.replace(" ", "").removesuffix("원")
    if not cleaned or any(unknown in cleaned for unknown in _UNKNOWN_VALUES):
        return None
    if _DIGIT_AMOUNT_PATTERN.match(cleaned):
        return int(cleaned.replace(",", ""))

    amounts = _AMOUNT_IN_TEXT_PATTERN.findall(cleaned)
    if amounts:
        chosen = amounts[-1] if _NUMBERED_AMOUNT_PATTERN.search(cleaned) else amounts[0]
        return int(chosen.replace(",", ""))

    return _parse_korean_amount(cleaned)


def _parse_korean_amount(text: str) -> int | None:
    """"천만", "1억5천만", "2억" 같은 한글 금액 표기를 정수로 바꾼다. 해석 못하면 None."""
    total = 0
    section = 0
    digits = ""
    for char in text.replace(",", ""):
        if char.isdigit():
            digits += char
            continue
        value = int(digits) if digits else 1
        digits = ""
        if char in _KOREAN_SMALL_UNITS:
            section += value * _KOREAN_SMALL_UNITS[char]
        elif char in _KOREAN_BIG_UNITS:
            total += (section + value if section == 0 else section) * _KOREAN_BIG_UNITS[char]
            section = 0
        else:
            return None  # 해석할 수 없는 글자가 섞이면 금액을 지어내지 않는다
    result = total + section + (int(digits) if digits else 0)
    return result or None


def _parse_demanded(text: str | None, parsed_date: date | None) -> bool | None:
    """배당요구여부 — 일자가 적혀 있으면 요구한 것이다. 공란이면 판단하지 않고 None."""
    if parsed_date is not None:
        return True
    if text is None:
        return None
    return "없" not in text


def _number(value: Any) -> float:
    return float(value) if isinstance(value, (int, float)) else 0.0
