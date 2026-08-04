-- 권리분석 룰 역채점 리포트 (WP-11 §2 가설 카탈로그). 데이터가 쌓이는 대로 재실행한다.
--
-- 실행:
--   docker exec -i auction-db psql -U app -d auction -f - < tools/backtest/backtest_report.sql
--   또는  docker cp 후  psql -U app -d auction -f backtest_report.sql
--
-- 왜 SQL인가: 지표 정의를 한곳에 고정하는 것이 목적이고, 계산 자체는 전부 집계 쿼리다.
-- 파이썬 패키지를 새로 만들 이유가 없다 (CLAUDE.md — 단일 용도에 추상화 금지).
--
-- 반드시 지킬 것 (WP-11 §4-2, 실측으로 확인된 함정):
--   1) 낙찰가율은 auction_sale_result.minimum_sale_price(그 기일 최저가)로 계산한다.
--      auction_item.minimum_sale_price는 최신 관측값이라 "낙찰가 < 최저가"가 나온다.
--   2) 일괄매각은 물건마다 같은 감정가·낙찰가가 붙는다 → 사건 단위로 dedupe한다.
--   3) **일괄매각 건은 비율 계산에서 아예 뺀다.** dedupe만으로는 부족하다 — 낙찰가는 묶음
--      전체인데 감정가·최저가는 목적물 하나 것이라 분자와 분모의 단위가 다르다. 나누면 비율이
--      그냥 부풀려진다. §4-1이 "우리 룰이 설명해야 할 대표 사례"로 지목한 최저가대비 490%
--      (2024타경1775, 유찰 9회)가 이 아티팩트일 가능성이 높다 — 유찰 9회면 최저가가 감정가의
--      13%인데 감정가의 66%에 낙찰되려면 최저가의 5배를 써낸 것이고, 나머지 표본 7건은 전부
--      100~125%였다. 실입찰에서 5배는 비현실적이다.
--      같은 함정을 2026-08-04에 API에서도 만났다: 34.32㎡ 상가에 최저가 340억이 붙어
--      평당가가 32.8억으로 나왔다(일괄매각 129건, 전체의 27%).

\pset border 2
\timing off

-- ── 0. 표본 현황 ──────────────────────────────────────────────────────────────
\echo '=== 0. 표본 현황 ==='
SELECT c.court_name AS 법원,
       count(DISTINCT i.id) AS 물건,
       count(DISTINCT n.auction_item_id) AS 명세서,
       count(DISTINCT r.auction_item_id) AS 매각결과,
       count(DISTINCT CASE WHEN n.id IS NOT NULL AND r.id IS NOT NULL THEN i.id END) AS 연결가능
FROM auction_item i
JOIN auction_case c ON c.id = i.auction_case_id
LEFT JOIN auction_item_notice n ON n.auction_item_id = i.id
LEFT JOIN auction_sale_result r ON r.auction_item_id = i.id
GROUP BY 1 ORDER BY 1;

-- 사건 단위로 중복 제거한 낙찰 건 (아래 H1·H2가 공통으로 쓴다).
-- 일괄매각은 분자(묶음 낙찰가)와 분모(목적물 감정가)의 단위가 달라 비율을 만들 수 없다 → 제외(함정 3).
-- 제외 건수는 아래에서 따로 찍는다 — 조용히 빠지면 표본이 왜 줄었는지 알 수 없다.
CREATE TEMP VIEW sold_cases AS
SELECT DISTINCT ON (i.auction_case_id)
       i.auction_case_id,
       i.id AS auction_item_id,
       c.case_no,
       i.failed_bid_count AS yuchal,
       r.sale_amount,
       i.appraisal_amount,
       r.minimum_sale_price AS dxdy_minimum_price,
       r.sale_amount::numeric / NULLIF(i.appraisal_amount, 0) AS rate_appraisal,
       r.sale_amount::numeric / NULLIF(r.minimum_sale_price, 0) AS rate_minimum
FROM auction_sale_result r
JOIN auction_item i ON i.id = r.auction_item_id
JOIN auction_case c ON c.id = i.auction_case_id
LEFT JOIN LATERAL (
  SELECT payload FROM auction_item_raw
  WHERE auction_item_id = i.id ORDER BY observed_at DESC LIMIT 1
) raw ON true
WHERE r.result_code = '001' AND r.sale_amount IS NOT NULL
  AND COALESCE(raw.payload->>'mulBigo', '') NOT LIKE '%일괄%'
ORDER BY i.auction_case_id, i.item_no;

\echo '=== 0-b. 일괄매각으로 비율 계산에서 제외한 낙찰 건 ==='
SELECT count(DISTINCT i.auction_case_id) AS 제외사건, count(*) AS 제외물건
FROM auction_sale_result r
JOIN auction_item i ON i.id = r.auction_item_id
LEFT JOIN LATERAL (
  SELECT payload FROM auction_item_raw
  WHERE auction_item_id = i.id ORDER BY observed_at DESC LIMIT 1
) raw ON true
WHERE r.result_code = '001' AND r.sale_amount IS NOT NULL
  AND COALESCE(raw.payload->>'mulBigo', '') LIKE '%일괄%';

-- ── H1. 유찰횟수 ↔ 낙찰가율 (베이스라인) ─────────────────────────────────────
-- 우리 룰 없이 유찰횟수만으로 낙찰가율을 얼마나 설명하는지. H2는 이 위에서 개선을 증명해야 한다.
-- 최저가대비는 이상치(1건이 490%)에 민감해 평균과 중위수를 함께 본다.
\echo '=== H1. 유찰횟수 ↔ 낙찰가율 (베이스라인) ==='
SELECT count(*) AS 표본,
       round(corr(yuchal, rate_appraisal)::numeric, 3) AS 상관계수,
       round((avg(rate_appraisal) * 100)::numeric, 1) AS 평균낙찰가율,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY rate_appraisal) * 100)::numeric, 1) AS 중위낙찰가율,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY rate_minimum) * 100)::numeric, 1) AS 중위_최저가대비,
       round((max(rate_minimum) * 100)::numeric, 1) AS 최대_최저가대비
FROM sold_cases;

\echo '--- H1 세부: 사건별 ---'
SELECT case_no AS 사건, yuchal AS 유찰,
       round((rate_appraisal * 100)::numeric, 1) AS 낙찰가율,
       round((rate_minimum * 100)::numeric, 1) AS 최저가대비
FROM sold_cases ORDER BY yuchal, rate_appraisal;

-- ── H7. HUG 대항력포기 ↔ 인수권리 유형 ──────────────────────────────────────
-- 검증된 규칙: 주택임차권등기가 있어도 권리자가 HUG면 대항력 포기확약서 때문에 인수 위험이 없다.
-- H7의 기관 개입 신호는 LH가 아니라 HUG다 (대법원은 낙찰자를 제공하지 않는다 — §1-1).
\echo '=== H7. HUG 대항력포기 x 인수권리 유형 ==='
SELECT ('HUG_PRIORITY_WAIVER' = ANY(n.risk_flags)) AS HUG포기확약,
       coalesce(n.assumed_rights_kind, '(공란)') AS 인수권리유형,
       count(*) AS 건수,
       round(avg(i.failed_bid_count), 1) AS 평균유찰
FROM auction_item_notice n
JOIN auction_item i ON i.id = n.auction_item_id
GROUP BY 1, 2 ORDER BY 1 DESC, 3 DESC;

-- ── 위험 플래그 분포 ────────────────────────────────────────────────────────
\echo '=== 위험 플래그 분포 ==='
SELECT f AS 플래그, count(*) AS 건수,
       round(100.0 * count(*) / (SELECT count(*) FROM auction_item_notice), 1) AS 비율_퍼센트
FROM auction_item_notice, unnest(risk_flags) f
GROUP BY 1 ORDER BY 2 DESC;

-- ── H2·H5 연결 표본 (명세서 → 결과) ─────────────────────────────────────────
-- 명세서(원인)와 매각결과(결과)가 같은 물건에 다 있어야 룰을 역채점할 수 있다.
-- 명세서 열람은 매각기일 1주 전부터라, 그 기일이 지나 결과가 나올 때까지 기다려야 한다.
\echo '=== H2/H5. 명세서-결과 연결 표본 (인수권리 유형별 낙찰 성과) ==='
SELECT coalesce(n.assumed_rights_kind, '(공란)') AS 인수권리유형,
       ('HUG_PRIORITY_WAIVER' = ANY(n.risk_flags)) AS HUG,
       count(*) AS 낙찰건수,
       round(avg(s.yuchal), 1) AS 평균유찰,
       round((avg(s.rate_appraisal) * 100)::numeric, 1) AS 평균낙찰가율
FROM sold_cases s
JOIN auction_item_notice n ON n.auction_item_id = s.auction_item_id
GROUP BY 1, 2 ORDER BY 3 DESC;

\echo '(위 표가 비어 있으면 아직 연결 표본이 없다는 뜻이다 — 명세서를 받아둔 물건의 매각기일이 지나야 채워진다)'
