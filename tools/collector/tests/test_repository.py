import json
from pathlib import Path

from collector.court_parser import parse_search_page
from collector.repository import InMemoryAuctionRepository


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "court_search_page.json"


def test_repository_upsert_is_idempotent_for_natural_key():
    page = parse_search_page(json.loads(FIXTURE_PATH.read_text(encoding="utf-8")))
    repository = InMemoryAuctionRepository()

    first = repository.upsert_items(page.items)
    second = repository.upsert_items(page.items)

    assert first.inserted == 2
    assert first.updated == 0
    assert first.skipped == 0
    assert second.inserted == 0
    assert second.updated == 0
    assert second.skipped == 2


def test_repository_detects_changed_schedule_or_price():
    page = parse_search_page(json.loads(FIXTURE_PATH.read_text(encoding="utf-8")))
    repository = InMemoryAuctionRepository()
    repository.upsert_items(page.items)

    changed = page.items[0].with_updates(minimum_sale_price=350_000_000)
    result = repository.upsert_items([changed])

    assert result.inserted == 0
    assert result.updated == 1
    assert result.skipped == 0
