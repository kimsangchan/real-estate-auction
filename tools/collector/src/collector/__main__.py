from __future__ import annotations

import argparse
import logging
import uuid

from collector.config import load_config
from collector.court_client import CourtAuctionClient
from collector.court_parser import parse_search_page
from collector.postgres_repository import PostgresAuctionRepository, run_migrations
from collector.runner import CollectionTarget, run_collection


def main() -> None:
    parser = argparse.ArgumentParser(description="Court auction collector")
    parser.add_argument("--court-office-code", required=True)
    parser.add_argument("--page-no", type=int, default=1)
    parser.add_argument("--migrate", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    config = load_config()
    if args.migrate:
        run_migrations(config.database_url)

    client = CourtAuctionClient(
        base_url=config.court_base_url,
        request_interval_ms=config.request_interval_ms,
        max_retry=config.max_retry,
    )
    repository = PostgresAuctionRepository(config.database_url)
    run_collection(
        run_id=str(uuid.uuid4()),
        target=CollectionTarget(court_office_code=args.court_office_code, page_no=args.page_no),
        client=client,
        repository=repository,
        parse_search_page=parse_search_page,
    )


if __name__ == "__main__":
    main()
