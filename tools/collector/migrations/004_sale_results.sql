-- 매각 결과(기일별 매각/유찰/변경/납부) 저장 — 권리분석 룰 역채점의 정답지 (WP-11)
-- 대법원은 낙찰자·응찰자수를 제공하지 않는다. 낙찰가와 기일 결과코드만 확보 가능.

CREATE TABLE IF NOT EXISTS auction_sale_result (
  id BIGSERIAL PRIMARY KEY,
  auction_item_id BIGINT NOT NULL REFERENCES auction_item(id) ON DELETE CASCADE,
  -- 기일 일자 (매각기일 또는 매각결정기일)
  dxdy_date DATE NOT NULL,
  -- 기일 종류 코드: 01=매각기일, 02=매각결정기일 (LJH-AUCTN_DXDY_KND_CD)
  dxdy_kind_code TEXT NOT NULL,
  -- 기일 결과 코드 (LJH-AUCTN_DXDY_RSLT_CD): 001=매각, 002=유찰, 003=최고가매각허가결정,
  -- 007=기한변경, 008=추후지정, 009=납부, 010=미납, 014=변경, 015=배당종결, 017=매각허가취소
  result_code TEXT,
  -- 낙찰가 (매각된 기일에만 존재). 대법원 필드: 사건검색 dspslAmt / 매각결과검색 maeAmt
  sale_amount BIGINT,
  -- 그 기일의 최저매각가격 — 낙찰가율 계산에 쓴다 (사후에 최저가가 바뀌어도 당시 값을 보존)
  minimum_sale_price BIGINT,
  -- 그 기일까지의 유찰 횟수 — "몇 회 만에 낙찰됐나" 통계의 핵심 지표
  failed_bid_count INTEGER,
  -- 수집 출처: 'SCHEDULE_RESULT_SEARCH'(매각결과검색, 7일 윈도우) | 'CASE_SEARCH'(경매사건검색)
  source TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- auction_schedule과 같은 원칙: 관측 튜플이 같으면 재실행해도 늘지 않고(멱등),
  -- 결과가 바뀌면 새 행으로 쌓여 이력이 남는다
  UNIQUE (auction_item_id, dxdy_date, dxdy_kind_code, result_code, sale_amount)
);

CREATE INDEX IF NOT EXISTS auction_sale_result_item_idx
  ON auction_sale_result (auction_item_id, dxdy_date);

-- 아직 결과를 못 받아온 물건을 찾기 위한 인덱스 (매각기일 경과 물건 폴링용)
CREATE INDEX IF NOT EXISTS auction_sale_result_observed_idx
  ON auction_sale_result (observed_at);
