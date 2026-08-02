-- 명세서가 "어느 매각기일 것인지"를 기록한다 (WP-11 §4-13).
--
-- 명세서는 기일마다 새로 작성된다(실측: 작성일이 기일 약 2주 전에 몰려 있다). 그런데 daily는
-- "명세서가 한 건이라도 있으면" 상세조회를 건너뛰어서, 유찰 후 새 기일을 받은 물건의 새 명세서와
-- 새 점유자 표를 영영 받지 못했다. 유찰이 반복되는 물건일수록 첫 스냅샷에 영원히 묶인다
-- (표본에 유찰 9·12·17회 물건이 있다 — §4-1).
--
-- 기일을 함께 저장하면 "이번 기일 명세서를 갖고 있나"로 판단할 수 있다.

ALTER TABLE auction_item_notice
  ADD COLUMN IF NOT EXISTS bid_date DATE;

-- 기존 행은 수집 당시의 기일 것이다 — 물건의 최신 관측 기일로 채운다.
UPDATE auction_item_notice n
SET bid_date = latest.bid_date
FROM (
  SELECT DISTINCT ON (s.auction_item_id)
         s.auction_item_id,
         (s.bid_datetime AT TIME ZONE 'Asia/Seoul')::date AS bid_date
  FROM auction_schedule s
  WHERE s.bid_datetime IS NOT NULL
  ORDER BY s.auction_item_id, s.observed_at DESC, s.id DESC
) AS latest
WHERE n.auction_item_id = latest.auction_item_id AND n.bid_date IS NULL;

CREATE INDEX IF NOT EXISTS auction_item_notice_bid_date_idx
  ON auction_item_notice (auction_item_id, bid_date);
