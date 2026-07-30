import json
import os
from dataclasses import replace
from datetime import date
from pathlib import Path

import pytest

from collector.court_parser import (
    SOURCE_CASE_SEARCH,
    ItemNotice,
    SaleResult,
    parse_search_page,
)
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
        assumed_rights_note=None,
        superficies_note=None,
        remarks="토지 별도등기 있음",
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
        assumed_rights_note=None,
        superficies_note=None,
        remarks=None,
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
        assumed_rights_note=None,
        superficies_note=None,
        remarks=None,
    )

    first = repository.upsert_notices([notice, undated, unknown])
    second = repository.upsert_notices([notice, undated, unknown])
    third = repository.upsert_notices([replace(notice, remarks="유치권 신고 있음"), undated, unknown])

    assert (first.inserted, first.updated, first.skipped) == (2, 0, 1)
    assert (second.inserted, second.updated, second.skipped) == (0, 0, 3)
    assert (third.inserted, third.updated, third.skipped) == (0, 1, 2)
