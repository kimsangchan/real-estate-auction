from __future__ import annotations

from pathlib import Path
from typing import Any

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from collector.court_parser import AuctionItem
from collector.repository import UpsertResult


MIGRATIONS_DIR = Path(__file__).parents[2] / "migrations"


class PostgresAuctionRepository:
    def __init__(self, database_url: str) -> None:
        if not database_url:
            raise ValueError("database_url is required")
        self._database_url = database_url

    def upsert_items(self, items: list[AuctionItem]) -> UpsertResult:
        inserted = 0
        updated = 0
        skipped = 0

        with psycopg.connect(self._database_url) as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                for item in items:
                    case_id = _upsert_case(cur, item)
                    item_result = _upsert_item(cur, case_id, item)
                    auction_item_id = int(item_result["id"])

                    if item_result["change_state"] == "inserted":
                        inserted += 1
                    elif item_result["change_state"] == "updated":
                        updated += 1
                    else:
                        skipped += 1

                    _insert_schedule_snapshot(cur, auction_item_id, item)
                    _insert_raw_snapshot(cur, auction_item_id, item)

        return UpsertResult(inserted=inserted, updated=updated, skipped=skipped)

    def find_items_in_bbox(
        self,
        *,
        min_lng: float,
        min_lat: float,
        max_lng: float,
        max_lat: float,
    ) -> list[dict[str, Any]]:
        with psycopg.connect(self._database_url) as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    """
                    SELECT ac.court_office_code, ac.case_no, ai.item_no
                    FROM auction_item ai
                    JOIN auction_case ac ON ac.id = ai.auction_case_id
                    WHERE ai.geom IS NOT NULL
                      AND ST_Intersects(
                        ai.geom,
                        ST_MakeEnvelope(%s, %s, %s, %s, 4326)
                      )
                    ORDER BY ac.court_office_code, ac.case_no, ai.item_no
                    """,
                    (min_lng, min_lat, max_lng, max_lat),
                )
                return list(cur.fetchall())

    def truncate_for_test(self) -> None:
        with psycopg.connect(self._database_url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    TRUNCATE case_person, auction_item_raw, auction_schedule, auction_item,
                      auction_case
                    RESTART IDENTITY CASCADE
                    """
                )


def run_migrations(database_url: str) -> None:
    if not database_url:
        raise ValueError("database_url is required")

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            for migration_path in sorted(MIGRATIONS_DIR.glob("*.sql")):
                cur.execute(migration_path.read_text(encoding="utf-8"))


def _upsert_case(cur: psycopg.Cursor[Any], item: AuctionItem) -> int:
    cur.execute(
        """
        INSERT INTO auction_case (court_office_code, case_no, court_name)
        VALUES (%s, %s, %s)
        ON CONFLICT (court_office_code, case_no)
        DO UPDATE SET
          court_name = EXCLUDED.court_name,
          updated_at = now()
        RETURNING id
        """,
        (item.court_office_code, item.case_no, item.court_name),
    )
    row = cur.fetchone()
    if row is None:
        raise RuntimeError("auction_case upsert returned no row")
    return int(row["id"])


def _upsert_item(cur: psycopg.Cursor[Any], case_id: int, item: AuctionItem) -> dict[str, Any]:
    lng_lat = item.location
    cur.execute(
        """
        WITH existing AS (
          SELECT *
          FROM auction_item
          WHERE auction_case_id = %s AND item_no = %s
        ),
        upserted AS (
          INSERT INTO auction_item (
            auction_case_id,
            item_no,
            usage_code,
            address,
            appraisal_amount,
            minimum_sale_price,
            failed_bid_count,
            geom
          )
          VALUES (
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            CASE
              WHEN %s::double precision IS NULL OR %s::double precision IS NULL THEN NULL
              ELSE ST_SetSRID(ST_MakePoint(%s, %s), 4326)
            END
          )
          ON CONFLICT (auction_case_id, item_no)
          DO UPDATE SET
            usage_code = EXCLUDED.usage_code,
            address = EXCLUDED.address,
            appraisal_amount = EXCLUDED.appraisal_amount,
            minimum_sale_price = EXCLUDED.minimum_sale_price,
            failed_bid_count = EXCLUDED.failed_bid_count,
            geom = EXCLUDED.geom,
            updated_at = CASE
              WHEN auction_item.usage_code IS DISTINCT FROM EXCLUDED.usage_code
                OR auction_item.address IS DISTINCT FROM EXCLUDED.address
                OR auction_item.appraisal_amount IS DISTINCT FROM EXCLUDED.appraisal_amount
                OR auction_item.minimum_sale_price IS DISTINCT FROM EXCLUDED.minimum_sale_price
                OR auction_item.failed_bid_count IS DISTINCT FROM EXCLUDED.failed_bid_count
                OR auction_item.geom IS DISTINCT FROM EXCLUDED.geom
              THEN now()
              ELSE auction_item.updated_at
            END
          RETURNING id
        )
        SELECT
          upserted.id,
          CASE
            WHEN NOT EXISTS (SELECT 1 FROM existing) THEN 'inserted'
            WHEN EXISTS (
              SELECT 1
              FROM existing
              WHERE existing.usage_code IS DISTINCT FROM %s
                OR existing.address IS DISTINCT FROM %s
                OR existing.appraisal_amount IS DISTINCT FROM %s
                OR existing.minimum_sale_price IS DISTINCT FROM %s
                OR existing.failed_bid_count IS DISTINCT FROM %s
            ) THEN 'updated'
            ELSE 'skipped'
          END AS change_state
        FROM upserted
        """,
        (
            case_id,
            item.item_no,
            case_id,
            item.item_no,
            item.usage_code,
            item.address,
            item.appraisal_amount,
            item.minimum_sale_price,
            item.failed_bid_count,
            lng_lat[0] if lng_lat else None,
            lng_lat[1] if lng_lat else None,
            lng_lat[0] if lng_lat else None,
            lng_lat[1] if lng_lat else None,
            item.usage_code,
            item.address,
            item.appraisal_amount,
            item.minimum_sale_price,
            item.failed_bid_count,
        ),
    )
    row = cur.fetchone()
    if row is None:
        raise RuntimeError("auction_item upsert returned no row")
    return dict(row)


def _insert_schedule_snapshot(cur: psycopg.Cursor[Any], auction_item_id: int, item: AuctionItem) -> None:
    cur.execute(
        """
        INSERT INTO auction_schedule (
          auction_item_id,
          bid_datetime,
          minimum_sale_price,
          failed_bid_count
        )
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (auction_item_id, bid_datetime, minimum_sale_price, failed_bid_count)
        DO NOTHING
        """,
        (auction_item_id, item.bid_datetime, item.minimum_sale_price, item.failed_bid_count),
    )


def _insert_raw_snapshot(cur: psycopg.Cursor[Any], auction_item_id: int, item: AuctionItem) -> None:
    cur.execute(
        """
        INSERT INTO auction_item_raw (auction_item_id, source, payload)
        VALUES (%s, %s, %s)
        """,
        (auction_item_id, "courtauction.search", Jsonb(item.raw)),
    )
