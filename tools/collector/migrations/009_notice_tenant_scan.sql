-- 명세서 PDF의 점유자(임차인) 표를 실제로 열어 파싱을 끝냈는지 기록한다 (WP-11 §4-8).
--
-- 없으면 daily가 "점유자 표가 없는 물건"과 "법원이 임차인 없다고 적은 물건"을 구분하지 못한다.
-- 전자는 열람 창(기일 1주 전~기일) 안에 반드시 다시 열어야 하고, 후자는 다시 열 이유가 없다.
-- 구분이 없으면 둘 중 하나를 택해야 하는데, 매일 전부 다시 여는 쪽은 물건당 3요청 이상을
-- 영구히 낭비하고, 전부 건너뛰는 쪽은 기일이 지나 표를 영구히 잃는다.

ALTER TABLE auction_item_notice
  ADD COLUMN IF NOT EXISTS tenant_scanned_at TIMESTAMPTZ;

-- 이미 점유자 표를 받아둔 명세서는 스캔한 것으로 본다 — 이 컬럼이 생기기 전에 수집된 행들이다.
-- 빈 표(법원이 "조사된 임차내역없음"이라 적은 문서)는 여기서 구분할 수 없어 NULL로 남는다.
-- 그 물건은 다음 daily에서 한 번 더 열리고 그때 표시된다.
UPDATE auction_item_notice n
SET tenant_scanned_at = n.observed_at
WHERE n.tenant_scanned_at IS NULL
  AND EXISTS (SELECT 1 FROM auction_item_notice_tenant t WHERE t.notice_id = n.id);
