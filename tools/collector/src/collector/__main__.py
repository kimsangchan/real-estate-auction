from __future__ import annotations

import argparse
import logging
import sys
import uuid

from collector.config import load_config
from collector.court_client import CourtAuctionClient
from collector.court_parser import parse_search_page
from collector.notice_document_client import NoticeDocumentClient
from collector.postgres_repository import PostgresAuctionRepository, run_migrations
from collector.runner import (
    CollectionTarget,
    run_collection,
    run_notice_collection,
    run_photo_collection,
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
    elif argv and argv[0] == "photos":
        _run_photos(argv[1:])
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
    parser.add_argument(
        "--with-tenants",
        action="store_true",
        help="명세서 PDF까지 열어 점유자(임차인) 표를 함께 수집한다 (물건당 요청 3회 이상 추가)",
    )
    parser.add_argument("--migrate", action="store_true")
    args = parser.parse_args(argv)

    client, repository = _bootstrap(migrate=args.migrate)
    document_reader = None
    if args.with_tenants:
        config = load_config()
        document_reader = NoticeDocumentClient(
            request_interval_ms=config.request_interval_ms,
            max_retry=config.max_retry,
        )

    run_notice_collection(
        run_id=str(uuid.uuid4()),
        target=CollectionTarget(court_office_code=args.court_office_code, page_no=args.page_no),
        client=client,
        repository=repository,
        limit=args.limit,
        document_reader=document_reader,
    )


def _run_photos(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(
        prog="collector photos",
        description="사진이 아직 없는 사건의 물건 사진을 수집한다 (사건당 요청 1회)",
    )
    parser.add_argument("--court-office-code", default=None, help="법원 필터 (없으면 전체)")
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="이번 실행에서 조회할 최대 사건 수 (사건당 사진이 수 MB일 수 있다)",
    )
    parser.add_argument("--migrate", action="store_true")
    args = parser.parse_args(argv)

    client, repository = _bootstrap(migrate=args.migrate)
    run_photo_collection(
        run_id=str(uuid.uuid4()),
        client=client,
        repository=repository,
        court_office_code=args.court_office_code,
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
