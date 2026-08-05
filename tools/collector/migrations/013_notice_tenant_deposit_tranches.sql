-- 확정일자별 보증금 몫 — 증액 재계약이면 원금과 증액분의 우선변제 순위가 갈린다.
-- deposit_amount(총액) 하나로는 표현할 수 없어 몫을 따로 남긴다.
--
-- 지금은 읽는 곳이 없다. 그래도 여기서 받아두는 이유는 매각물건명세서가 기일이 지나면
-- 다시 조회되지 않기 때문이다 (WP-11 §4-3) — 권리분석이 이 값을 쓰게 될 때쯤이면
-- 원본이 이미 사라져 있다.
--
-- 형태: [{"amount": 200000000, "fixedDate": "2020-06-12"}, {"amount": 10000000, "fixedDate": "2022-06-03"}]
-- amount는 누적 총액이 아니라 그 몫의 금액이다. 합계는 deposit_amount와 같다.
ALTER TABLE auction_item_notice_tenant
    ADD COLUMN IF NOT EXISTS deposit_tranches jsonb;

COMMENT ON COLUMN auction_item_notice_tenant.deposit_tranches IS
    '확정일자별 보증금 몫 (증액 재계약 시에만 채워진다). amount 합계 = deposit_amount';
