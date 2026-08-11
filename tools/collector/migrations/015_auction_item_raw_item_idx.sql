-- 물건 목록·지도 조회가 20초 걸린 원인 제거.
--
-- 목록 SELECT는 물건마다 "가장 최근 원문 스냅샷"을 lateral로 집는다:
--   SELECT payload FROM auction_item_raw WHERE auction_item_id = ai.id ORDER BY observed_at DESC LIMIT 1
-- 그런데 auction_item_raw에는 PK 말고 인덱스가 없어서 이 lateral이 **행마다 전체 순차 스캔**을 했다.
-- 실측(EXPLAIN ANALYZE, 서울 중심부 bbox 181건): Seq Scan on auction_item_raw가 loops=181,
-- 매번 63,457행을 Filter로 버리며 61ms — 전체 11.65초 중 11.06초(95%)를 여기서 썼다.
--
-- observed_at을 DESC로 함께 넣어 ORDER BY ... LIMIT 1이 정렬 없이 인덱스에서 바로 끝나게 한다.
-- CONCURRENTLY는 쓰지 않는다 — run_migrations가 트랜잭션 안에서 실행하므로 불가하고,
-- 이 테이블은 수집 배치만 쓰기 때문에 짧은 락이 문제되지 않는다.
CREATE INDEX IF NOT EXISTS auction_item_raw_item_observed_idx
    ON auction_item_raw (auction_item_id, observed_at DESC);
