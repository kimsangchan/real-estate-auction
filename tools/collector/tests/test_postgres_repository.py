import json
import os
from dataclasses import replace
from datetime import date
from pathlib import Path

import psycopg
import pytest

from collector.court_parser import (
    SOURCE_CASE_SEARCH,
    ItemNotice,
    SaleResult,
    parse_photo_page,
    parse_search_page,
)
from collector.notice_tenant_parser import NoticeTenant
from collector.postgres_repository import PostgresAuctionRepository, run_migrations


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "court_search_page.json"


def test_postgres_repository_requires_database_url():
    with pytest.raises(ValueError):
        PostgresAuctionRepository("")


@pytest.mark.skipif(
    os.getenv("COLLECTOR_RUN_DB_TESTS") != "1",
    reason="set COLLECTOR_RUN_DB_TESTS=1 to run PostGIS integration tests",
)
def test_postgres_repository_upsert_and_bbox_smoke():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        pytest.skip("DATABASE_URL is required")

    repository = PostgresAuctionRepository(database_url)
    run_migrations(database_url)
    repository.truncate_for_test()

    page = parse_search_page(json.loads(FIXTURE_PATH.read_text(encoding="utf-8")))

    first = repository.upsert_items(page.items)
    second = repository.upsert_items(page.items)
    seoul_items = repository.find_items_in_bbox(
        min_lng=126.7,
        min_lat=37.3,
        max_lng=127.2,
        max_lat=37.8,
    )

    assert first.inserted == 2
    assert second.inserted == 0
    assert second.skipped == 2
    assert len(seoul_items) == 2


@pytest.mark.skipif(
    os.getenv("COLLECTOR_RUN_DB_TESTS") != "1",
    reason="set COLLECTOR_RUN_DB_TESTS=1 to run PostGIS integration tests",
)
def test_postgres_sale_result_upsert_is_idempotent_including_null_amount():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        pytest.skip("DATABASE_URL is required")

    repository = PostgresAuctionRepository(database_url)
    run_migrations(database_url)
    repository.truncate_for_test()
    page = parse_search_page(json.loads(FIXTURE_PATH.read_text(encoding="utf-8")))
    repository.upsert_items(page.items)

    # fixture의 매각기일(2026-07-16/22)은 이미 지났고 결과가 없다 — 둘 다 backfill 대상
    assert len(repository.find_items_pending_sale_result()) == 2

    results = [
        SaleResult(
            court_office_code="B000210",
            case_no="2023타경4722",
            item_no="1",
            dxdy_date=date(2026, 7, 16),
            dxdy_kind_code="01",
            result_code="001",
            sale_amount=5_210_000,
            minimum_sale_price=5_201_000,
            failed_bid_count=None,
            source=SOURCE_CASE_SEARCH,
        ),
        # 유찰 — 낙찰가 NULL이어도 재실행 시 행이 늘면 안 된다 (UNIQUE 제약은 NULL을 구분 못함)
        SaleResult(
            court_office_code="B000210",
            case_no="2022타경101244",
            item_no="1",
            dxdy_date=date(2026, 7, 22),
            dxdy_kind_code="01",
            result_code="002",
            sale_amount=None,
            minimum_sale_price=88_184_767,
            failed_bid_count=1,
            source=SOURCE_CASE_SEARCH,
        ),
        # DB에 없는 물건 — 조용히 건너뛴다
        SaleResult(
            court_office_code="B000210",
            case_no="2024타경999999",
            item_no="1",
            dxdy_date=date(2026, 7, 22),
            dxdy_kind_code="01",
            result_code="001",
            sale_amount=1,
            minimum_sale_price=None,
            failed_bid_count=None,
            source=SOURCE_CASE_SEARCH,
        ),
    ]

    first = repository.upsert_sale_results(results)
    second = repository.upsert_sale_results(results)

    assert first.inserted == 2
    assert first.skipped == 1
    assert second.inserted == 0
    assert second.skipped == 3
    # 결과가 채워진 물건은 더 이상 backfill 대상이 아니다
    assert repository.find_items_pending_sale_result() == []


@pytest.mark.skipif(
    os.getenv("COLLECTOR_RUN_DB_TESTS") != "1",
    reason="set COLLECTOR_RUN_DB_TESTS=1 to run PostGIS integration tests",
)
def test_postgres_notice_upsert_is_idempotent_and_updates_changed_fields():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        pytest.skip("DATABASE_URL is required")

    repository = PostgresAuctionRepository(database_url)
    run_migrations(database_url)
    repository.truncate_for_test()
    page = parse_search_page(json.loads(FIXTURE_PATH.read_text(encoding="utf-8")))
    repository.upsert_items(page.items)

    notice = ItemNotice(
        court_office_code="B000210",
        case_no="2022타경101244",
        item_no="1",
        document_date=date(2026, 7, 3),
        baseline_raw="집합건물 : 2008.07.09 근저당권",
        baseline_date=date(2008, 7, 9),
        distribution_demand_deadline=date(2025, 3, 10),
        assumed_rights_kind="NONE",
        risk_flags=["LAND_SEPARATE_REGISTRATION"],
        lien_claim_amount=None,
    )
    # 작성일이 없는 명세서도 재실행 시 중복되면 안 된다 (UNIQUE 제약은 NULL을 구분 못한다)
    undated = ItemNotice(
        court_office_code="B000210",
        case_no="2023타경4722",
        item_no="1",
        document_date=None,
        baseline_raw="2024.12.11. 경매개시결정",
        baseline_date=date(2024, 12, 11),
        distribution_demand_deadline=None,
        assumed_rights_kind=None,
        risk_flags=[],
        lien_claim_amount=None,
    )
    # DB에 없는 물건 — 조용히 건너뛴다
    unknown = ItemNotice(
        court_office_code="B000210",
        case_no="2024타경999999",
        item_no="1",
        document_date=date(2026, 7, 3),
        baseline_raw=None,
        baseline_date=None,
        distribution_demand_deadline=None,
        assumed_rights_kind=None,
        risk_flags=[],
        lien_claim_amount=None,
    )

    first = repository.upsert_notices([notice, undated, unknown])
    second = repository.upsert_notices([notice, undated, unknown])
    # risk_flags 배열 변경·유치권 금액 추가가 updated로 잡혀야 한다 (TEXT[]는 Python 리스트로 비교)
    third = repository.upsert_notices(
        [
            replace(
                notice,
                risk_flags=["LAND_SEPARATE_REGISTRATION", "LIEN_CLAIM"],
                lien_claim_amount=879_596_895,
            ),
            undated,
            unknown,
        ]
    )

    assert (first.inserted, first.updated, first.skipped) == (2, 0, 1)
    assert (second.inserted, second.updated, second.skipped) == (0, 0, 3)
    assert (third.inserted, third.updated, third.skipped) == (0, 1, 2)
    # daily 스킵 필터가 쓰는 자연키 집합 — 명세서를 저장한 두 물건만 나와야 한다
    assert repository.find_item_keys_with_notice() == {
        ("B000210", "2022타경101244", "1"),
        ("B000210", "2023타경4722", "1"),
    }


@pytest.mark.skipif(
    os.getenv("COLLECTOR_RUN_DB_TESTS") != "1",
    reason="set COLLECTOR_RUN_DB_TESTS=1 to run PostGIS integration tests",
)
def test_postgres_notice_tenants_are_replaced_not_appended():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        pytest.skip("DATABASE_URL is required")

    repository = PostgresAuctionRepository(database_url)
    run_migrations(database_url)
    repository.truncate_for_test()
    page = parse_search_page(json.loads(FIXTURE_PATH.read_text(encoding="utf-8")))
    repository.upsert_items(page.items)

    tenants = (
        NoticeTenant(
            tenant_seq=1,
            tenant_name="홍길동",
            source_kind="등기사항전부증명서",
            occupied_part="206호",
            possession_basis="주거 주택임차권자",
            lease_period="2021.06.04~",
            deposit_amount=230_000_000,
            monthly_rent=None,
            move_in_date=date(2021, 6, 4),
            fixed_date=date(2021, 6, 4),
            demanded_distribution=None,
            demanded_distribution_date=None,
        ),
        NoticeTenant(
            tenant_seq=1,
            tenant_name="홍길동",
            source_kind="권리신고",
            occupied_part="206호",
            possession_basis="주거 임차인",
            lease_period=None,
            deposit_amount=230_000_000,
            monthly_rent=None,
            move_in_date=date(2021, 6, 4),
            fixed_date=None,
            demanded_distribution=True,
            demanded_distribution_date=date(2023, 11, 30),
        ),
    )
    notice = ItemNotice(
        court_office_code="B000210",
        case_no="2022타경101244",
        item_no="1",
        document_date=date(2026, 7, 3),
        baseline_raw=None,
        baseline_date=None,
        distribution_demand_deadline=None,
        assumed_rights_kind="NONE",
        risk_flags=[],
        lien_claim_amount=None,
        tenants=tenants,
    )

    repository.upsert_notices([notice])
    repository.upsert_notices([notice])
    # 같은 임차인이 정보출처별로 두 행이고, 재실행해도 행이 늘지 않는다
    assert _tenant_rows(database_url) == 2

    # 기재사항만 재수집(tenants 비어 있음)해도 이미 받아둔 표를 지우지 않는다
    repository.upsert_notices([replace(notice, tenants=())])
    assert _tenant_rows(database_url) == 2


@pytest.mark.skipif(
    os.getenv("COLLECTOR_RUN_DB_TESTS") != "1",
    reason="set COLLECTOR_RUN_DB_TESTS=1 to run PostGIS integration tests",
)
def test_postgres_photo_upsert_is_idempotent_and_updates_changed_fields():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        pytest.skip("DATABASE_URL is required")

    repository = PostgresAuctionRepository(database_url)
    run_migrations(database_url)
    repository.truncate_for_test()
    page = parse_search_page(json.loads(FIXTURE_PATH.read_text(encoding="utf-8")))
    repository.upsert_items(page.items)

    # fixture 두 사건 모두 아직 사진이 없다 — 수집 대상
    assert len(repository.find_cases_missing_photos()) == 2
    assert repository.find_cases_missing_photos("B000299") == []

    photo_page = parse_photo_page(
        json.loads((Path(__file__).parent / "fixtures" / "court_photo_page.json").read_text(
            encoding="utf-8"
        )),
        court_office_code="B000210",
        case_no="2022타경101244",
    )

    first = repository.upsert_case_photos("B000210", "2022타경101244", photo_page.photos)
    second = repository.upsert_case_photos("B000210", "2022타경101244", photo_page.photos)
    # 설명이 바뀐 사진은 updated로 잡혀야 한다
    third = repository.upsert_case_photos(
        "B000210",
        "2022타경101244",
        [replace(photo_page.photos[0], caption="바뀐 설명"), *photo_page.photos[1:]],
    )

    assert (first.inserted, first.updated, first.skipped) == (3, 0, 0)
    assert (second.inserted, second.updated, second.skipped) == (0, 0, 3)
    assert (third.inserted, third.updated, third.skipped) == (0, 1, 2)

    # 사진이 채워진 사건은 더 이상 수집 대상이 아니다
    remaining = repository.find_cases_missing_photos()
    assert [row["case_no"] for row in remaining] == ["2023타경4722"]

    # DB에 없는 사건은 조용히 아무것도 하지 않는다
    unknown = repository.upsert_case_photos("B000210", "2024타경999999", photo_page.photos)
    # 저장은 하지 않되 건너뛴 장수를 센다 — _upsert_notice가 미수집 물건을 skipped로 세는 것과 같다.
    # 0으로 뭉개면 "우리가 추적하지 않는 사건의 사진을 받아왔다"는 신호가 로그에서 사라진다
    assert (unknown.inserted, unknown.updated, unknown.skipped) == (0, 0, len(photo_page.photos))

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT sum(byte_size), count(*) FROM auction_case_photo")
            total_bytes, rows = cur.fetchone()
    assert rows == 3
    assert int(total_bytes) == sum(len(p.image) for p in photo_page.photos)


def _tenant_rows(database_url: str) -> int:
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM auction_item_notice_tenant")
            return int(cur.fetchone()[0])
