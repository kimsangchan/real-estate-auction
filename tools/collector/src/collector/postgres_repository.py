from __future__ import annotations

from pathlib import Path
from typing import Any

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from collector.court_parser import AuctionItem, ItemNotice, SaleResult
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

    def upsert_sale_results(self, results: list[SaleResult]) -> UpsertResult:
        """기일 결과 관측값을 멱등 저장한다 — 같은 관측 튜플은 재실행해도 늘지 않는다."""
        inserted = 0
        skipped = 0

        with psycopg.connect(self._database_url) as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                for result in results:
                    if _insert_sale_result(cur, result):
                        inserted += 1
                    else:
                        skipped += 1

        return UpsertResult(inserted=inserted, updated=0, skipped=skipped)

    def upsert_notices(self, notices: list[ItemNotice]) -> UpsertResult:
        """매각물건명세서 기재사항을 멱등 저장한다 — 같은 물건·작성일은 재실행해도 늘지 않는다."""
        inserted = 0
        updated = 0
        skipped = 0

        with psycopg.connect(self._database_url) as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                for notice in notices:
                    state = _upsert_notice(cur, notice)
                    if state == "inserted":
                        inserted += 1
                    elif state == "updated":
                        updated += 1
                    else:
                        skipped += 1

        return UpsertResult(inserted=inserted, updated=updated, skipped=skipped)

    def find_items_pending_sale_result(self) -> list[dict[str, Any]]:
        """매각기일이 지났는데 그 기일 이후 결과 행이 없는 물건 목록 — backfill 대상."""
        with psycopg.connect(self._database_url) as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    """
                    SELECT ac.court_office_code, ac.case_no, ai.item_no
                    FROM auction_item ai
                    JOIN auction_case ac ON ac.id = ai.auction_case_id
                    JOIN LATERAL (
                      SELECT max(s.bid_datetime) AS latest_bid
                      FROM auction_schedule s
                      WHERE s.auction_item_id = ai.id AND s.bid_datetime IS NOT NULL
                    ) sched ON sched.latest_bid IS NOT NULL
                    WHERE sched.latest_bid < now()
                      AND NOT EXISTS (
                        SELECT 1
                        FROM auction_sale_result r
                        WHERE r.auction_item_id = ai.id
                          AND r.dxdy_date >= (sched.latest_bid AT TIME ZONE 'Asia/Seoul')::date
                      )
                    ORDER BY ac.court_office_code, ac.case_no, ai.item_no
                    """
                )
                return list(cur.fetchall())

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


def _insert_sale_result(cur: psycopg.Cursor[Any], result: SaleResult) -> bool:
    """자연키로 물건을 찾아 결과 행을 넣는다. 물건이 없거나 이미 같은 관측이 있으면 넣지 않는다.

    UNIQUE 제약(auction_item_id, dxdy_date, dxdy_kind_code, result_code, sale_amount)은
    NULL 낙찰가(유찰 등)를 서로 다른 값으로 취급해 중복을 막지 못하므로,
    IS NOT DISTINCT FROM으로 직접 중복 검사를 한 뒤 ON CONFLICT DO NOTHING을 겸용한다.
    """
    cur.execute(
        """
        INSERT INTO auction_sale_result (
          auction_item_id,
          dxdy_date,
          dxdy_kind_code,
          result_code,
          sale_amount,
          minimum_sale_price,
          failed_bid_count,
          source
        )
        SELECT ai.id, %s, %s, %s, %s, %s, %s, %s
        FROM auction_item ai
        JOIN auction_case ac ON ac.id = ai.auction_case_id
        WHERE ac.court_office_code = %s
          AND ac.case_no = %s
          AND ai.item_no = %s
          AND NOT EXISTS (
            SELECT 1
            FROM auction_sale_result r
            WHERE r.auction_item_id = ai.id
              AND r.dxdy_date = %s
              AND r.dxdy_kind_code = %s
              AND r.result_code IS NOT DISTINCT FROM %s
              AND r.sale_amount IS NOT DISTINCT FROM %s
          )
        ON CONFLICT DO NOTHING
        """,
        (
            result.dxdy_date,
            result.dxdy_kind_code,
            result.result_code,
            result.sale_amount,
            result.minimum_sale_price,
            result.failed_bid_count,
            result.source,
            result.court_office_code,
            result.case_no,
            result.item_no,
            result.dxdy_date,
            result.dxdy_kind_code,
            result.result_code,
            result.sale_amount,
        ),
    )
    return cur.rowcount > 0


# risk_flags(TEXT[])는 psycopg가 Python list로 왕복 변환하므로 아래 변경 검사도
# SQL이 아닌 Python에서 리스트 동등 비교로 한다 — 배열 NULL/순서 문제를 피한다(항상 정렬 저장).
_NOTICE_FIELDS = (
    "baseline_raw",
    "baseline_date",
    "distribution_demand_deadline",
    "assumed_rights_kind",
    "risk_flags",
    "lien_claim_amount",
)


def _upsert_notice(cur: psycopg.Cursor[Any], notice: ItemNotice) -> str:
    """명세서 한 건을 저장하고 inserted/updated/skipped를 돌려준다.

    UNIQUE (auction_item_id, document_date)는 PostgreSQL이 NULL을 서로 다른 값으로 취급해
    작성일 없는 행의 중복을 막지 못하므로, IS NOT DISTINCT FROM으로 직접 기존 행을 찾는다.
    """
    cur.execute(
        """
        SELECT ai.id
        FROM auction_item ai
        JOIN auction_case ac ON ac.id = ai.auction_case_id
        WHERE ac.court_office_code = %s AND ac.case_no = %s AND ai.item_no = %s
        """,
        (notice.court_office_code, notice.case_no, notice.item_no),
    )
    item_row = cur.fetchone()
    if item_row is None:
        return "skipped"  # 아직 수집되지 않은 물건 — 조용히 건너뛴다
    auction_item_id = int(item_row["id"])

    values = tuple(getattr(notice, field) for field in _NOTICE_FIELDS)
    cur.execute(
        f"""
        SELECT id, {", ".join(_NOTICE_FIELDS)}
        FROM auction_item_notice
        WHERE auction_item_id = %s AND document_date IS NOT DISTINCT FROM %s
        """,
        (auction_item_id, notice.document_date),
    )
    existing = cur.fetchone()

    if existing is None:
        cur.execute(
            f"""
            INSERT INTO auction_item_notice (
              auction_item_id, document_date, {", ".join(_NOTICE_FIELDS)}
            )
            VALUES (%s, %s, {", ".join(["%s"] * len(_NOTICE_FIELDS))})
            """,
            (auction_item_id, notice.document_date, *values),
        )
        return "inserted"

    if all(existing[field] == value for field, value in zip(_NOTICE_FIELDS, values, strict=True)):
        return "skipped"

    cur.execute(
        f"""
        UPDATE auction_item_notice
        SET {", ".join(f"{field} = %s" for field in _NOTICE_FIELDS)}, observed_at = now()
        WHERE id = %s
        """,
        (*values, int(existing["id"])),
    )
    return "updated"


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
