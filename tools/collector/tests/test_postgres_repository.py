import json
import os
from pathlib import Path

import pytest

from collector.court_parser import parse_search_page
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
