from __future__ import annotations

import argparse
import logging
import sys
import uuid

from collector.config import load_config
from collector.court_client import CourtAuctionClient
from collector.court_parser import parse_search_page
from collector.postgres_repository import PostgresAuctionRepository, run_migrations
from collector.runner import (
    CollectionTarget,
    run_collection,
    run_notice_collection,
    run_sale_result_backfill,
    run_sale_result_sweep,
)


def main() -> None:
    # 첫 인자로 모드를 고른다. 기존 호출(`--court-office-code ...`)은 그대로 물건 수집으로 동작한다.
    argv = sys.argv[1:]
    if argv and argv[0] == "backfill":
        _run_backfill(argv[1:])
    elif argv and argv[0] == "sweep":
        _run_sweep(argv[1:])
    elif argv and argv[0] == "notices":
        _run_notices(argv[1:])
    else:
        _run_collect(argv)


def _run_collect(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(description="Court auction collector")
    parser.add_argument("--court-office-code", required=True)
    parser.add_argument("--page-no", type=int, default=1)
    parser.add_argument("--migrate", action="store_true")
    args = parser.parse_args(argv)

    client, repository = _bootstrap(migrate=args.migrate)
    run_collection(
        run_id=str(uuid.uuid4()),
        target=CollectionTarget(court_office_code=args.court_office_code, page_no=args.page_no),
        client=client,
        repository=repository,
        parse_search_page=parse_search_page,
    )


def _run_backfill(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(
        prog="collector backfill",
        description="매각기일이 지난 물건의 결과를 경매사건검색으로 채운다",
    )
    parser.add_argument("--limit", type=int, default=None, help="이번 실행에서 조회할 최대 사건 수")
    parser.add_argument("--migrate", action="store_true")
    args = parser.parse_args(argv)

    client, repository = _bootstrap(migrate=args.migrate)
    run_sale_result_backfill(
        run_id=str(uuid.uuid4()),
        client=client,
        repository=repository,
        limit=args.limit,
    )


def _run_sweep(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(
        prog="collector sweep",
        description="매각결과검색으로 최근 7일 매각/유찰 결과를 수집한다",
    )
    parser.add_argument("--court-office-code", required=True)
    parser.add_argument(
        "--status",
        choices=["", "02", "03"],
        default="",
        help="물건 상태 필터: 빈값=전체, 02=매각, 03=유찰",
    )
    parser.add_argument("--max-pages", type=int, default=50)
    parser.add_argument("--migrate", action="store_true")
    args = parser.parse_args(argv)

    client, repository = _bootstrap(migrate=args.migrate)
    run_sale_result_sweep(
        run_id=str(uuid.uuid4()),
        court_office_code=args.court_office_code,
        client=client,
        repository=repository,
        status_code=args.status,
        max_pages=args.max_pages,
    )


def _run_notices(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(
        prog="collector notices",
        description="지금 공고 중인 물건의 매각물건명세서 기재사항을 수집한다",
    )
    parser.add_argument("--court-office-code", required=True)
    parser.add_argument("--page-no", type=int, default=1)
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="이번 실행에서 상세조회할 최대 물건 수 (물건당 요청 1회)",
    )
    parser.add_argument("--migrate", action="store_true")
    args = parser.parse_args(argv)

    client, repository = _bootstrap(migrate=args.migrate)
    run_notice_collection(
        run_id=str(uuid.uuid4()),
        target=CollectionTarget(court_office_code=args.court_office_code, page_no=args.page_no),
        client=client,
        repository=repository,
        limit=args.limit,
    )


def _bootstrap(*, migrate: bool) -> tuple[CourtAuctionClient, PostgresAuctionRepository]:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    config = load_config()
    if migrate:
        run_migrations(config.database_url)

    client = CourtAuctionClient(
        base_url=config.court_base_url,
        request_interval_ms=config.request_interval_ms,
        max_retry=config.max_retry,
    )
    return client, PostgresAuctionRepository(config.database_url)


if __name__ == "__main__":
    main()
