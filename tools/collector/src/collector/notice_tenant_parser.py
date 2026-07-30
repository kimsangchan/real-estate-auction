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
# 금액·날짜는 감싸지지 않으므로 행마다 정확히 한 줄이다.
_ANCHOR_FIELDS = (
    "occupied_part",
    "deposit_amount",
    "monthly_rent",
    "move_in_date",
    "fixed_date",
    "demanded_distribution",
)

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
# 구사건은 보증금을 "천만원"·"1억5천만원" 같은 한글로 적는다 (실측).
# 억·만은 앞의 값을 묶는 큰 단위, 천·백·십은 그 안에서 더해지는 작은 단위다
_KOREAN_BIG_UNITS = {"억": 100_000_000, "만": 10_000}
_KOREAN_SMALL_UNITS = {"천": 1_000, "백": 100, "십": 10}
_UNKNOWN_VALUES = ("미상", "불명", "없음", "-")

# 행 기준선을 묶는 허용 오차와, 조각을 가장 가까운 기준선에 붙일 때의 최대 거리 (실측 줄높이 ~13pt)
_ANCHOR_MERGE_TOLERANCE = 8
_ROW_ASSIGN_LIMIT = 30


@dataclass(frozen=True)
class NoticeTenant:
    """auction_item_notice_tenant 한 행 — 명세서 점유자 표의 셀 값.

    같은 임차인이 정보출처별로 여러 행에 나오므로 행을 합치지 않고 source_kind로 구분해
    각각 저장한다. tenant_seq는 이름으로 묶은 동일인 순번이다 (WP-11 §4-3).
    """

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
    """표 영역의 조각을 행으로 묶고 컬럼별 문자열 셀을 만든다."""
    region = [f for f in fragments if bottom < f["y2"] < top]
    if not region:
        return []

    anchors = _row_anchors(region)
    if not anchors:
        return []

    buckets: list[list[dict[str, Any]]] = [[] for _ in anchors]
    for fragment in region:
        distances = [abs(fragment["y2"] - anchor) for anchor in anchors]
        nearest = min(range(len(anchors)), key=distances.__getitem__)
        if distances[nearest] <= _ROW_ASSIGN_LIMIT:
            buckets[nearest].append(fragment)

    return [cells for cells in (_cells(bucket) for bucket in buckets) if cells]


def _row_anchors(region: list[dict[str, Any]]) -> list[float]:
    """행 기준선 y 목록. 한 줄로만 적히는 컬럼에 값이 있는 라인을 기준선으로 삼는다."""
    candidates = sorted(
        {
            fragment["y2"]
            for fragment in region
            if _column_of(fragment) in _ANCHOR_FIELDS and not fragment["char"].isspace()
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
    """셀 문자열 행을 저장용 값으로 바꾸고 이름으로 동일인 순번(tenant_seq)을 부여한다."""
    seq_by_name: dict[str, int] = {}
    tenants: list[NoticeTenant] = []

    for index, row in enumerate(rows, start=1):
        name = row.get("tenant_name")
        if name is None:
            seq = index
        else:
            seq = seq_by_name.setdefault(name, len(seq_by_name) + 1)

        demanded_text = row.get("demanded_distribution")
        demanded_date = _parse_date(demanded_text)
        tenants.append(
            NoticeTenant(
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
    """금액 셀을 정수로 바꾼다. 숫자 표기와 한글 표기(구사건)를 모두 받고, 모르면 None."""
    if text is None:
        return None
    cleaned = text.replace(" ", "").removesuffix("원")
    if not cleaned or any(unknown in cleaned for unknown in _UNKNOWN_VALUES):
        return None
    if _DIGIT_AMOUNT_PATTERN.match(cleaned):
        return int(cleaned.replace(",", ""))
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
