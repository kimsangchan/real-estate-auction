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

-- ── 매각 단위 ───────────────────────────────────────────────────────────────
-- 아래 채점과 후보 필터가 공유하는 관측 단위.
--
-- **일괄매각은 사건 하나가 한 번 팔린다.** 목적물마다 세면 낙찰 사건 4건이 목적물 23건으로
-- 부풀어 낙찰률이 30.3%로 나온다(실측 2026-08-05). 임야 낙찰률 93.8%도 같은 착시였다 —
-- 목적물 16개가 사건 2건이었다. 일괄이면 사건당 1건, 아니면 목적물당 1건으로 센다.
CREATE TEMP VIEW sale_unit AS
WITH raw AS (
  SELECT DISTINCT ON (auction_item_id) auction_item_id, payload
  FROM auction_item_raw ORDER BY auction_item_id, observed_at DESC
), latest_notice AS (
  SELECT DISTINCT ON (auction_item_id) auction_item_id, assumed_rights_kind, risk_flags
  FROM auction_item_notice ORDER BY auction_item_id, document_date DESC NULLS LAST, id DESC
), outcome AS (
  SELECT auction_item_id, bool_or(result_code = '001') AS sold, max(sale_amount) AS sale_amount
  FROM auction_sale_result GROUP BY 1
), base AS (
  SELECT i.id, c.case_no, i.item_no, o.sold, o.sale_amount,
         i.appraisal_amount, i.minimum_sale_price, i.failed_bid_count,
         round(i.minimum_sale_price::numeric / NULLIF(i.appraisal_amount, 0) * 100) AS min_rate,
         split_part(r.payload->>'dspslUsgNm', ',', 1) AS usage,
         COALESCE(r.payload->>'mulBigo', '') LIKE '%일괄%' AS bulk,
         (n.assumed_rights_kind = 'NONE' OR 'HUG_PRIORITY_WAIVER' = ANY(n.risk_flags)) AS no_burden,
         (n.assumed_rights_kind IS NOT NULL OR 'HUG_PRIORITY_WAIVER' = ANY(n.risk_flags)) AS burden_known
  FROM outcome o
  JOIN auction_item i ON i.id = o.auction_item_id
  JOIN auction_case c ON c.id = i.auction_case_id
  JOIN latest_notice n ON n.auction_item_id = i.id
  JOIN raw r ON r.auction_item_id = i.id
)
SELECT DISTINCT ON (CASE WHEN bulk THEN case_no ELSE id::text END) *
FROM base ORDER BY CASE WHEN bulk THEN case_no ELSE id::text END, sold DESC;

-- ── 채점: 인수 부담과 매각 결과 ─────────────────────────────────────────────
-- 사용자 가설(§4-17): "권리분석상 좋은 물건이면 입찰자가 많고 유찰이 적을 것."
-- 응찰자 수는 공개되지 않으므로(§4-18) **낙찰 여부**를 대리지표로 쓴다.
\echo '=== 채점 1. 인수 부담 유무 ==='
SELECT CASE WHEN no_burden THEN '인수 부담 없음' ELSE '인수 부담 있음' END AS 구분,
       count(*) AS 매각단위, count(*) FILTER (WHERE sold) AS 낙찰,
       round(100.0 * count(*) FILTER (WHERE sold) / count(*), 1) AS 낙찰률,
       round(avg(100.0 * sale_amount / NULLIF(appraisal_amount, 0)) FILTER (WHERE sold), 1) AS 낙찰가율
FROM sale_unit WHERE burden_known GROUP BY 1 ORDER BY 4 DESC;

\echo '=== 채점 2. 유찰 횟수는 낙찰률을 예측하지 못한다 (가설의 반증) ==='
SELECT LEAST(failed_bid_count, 4) AS 유찰, count(*) AS 매각단위,
       count(*) FILTER (WHERE sold) AS 낙찰,
       round(100.0 * count(*) FILTER (WHERE sold) / count(*), 1) AS 낙찰률
FROM sale_unit WHERE failed_bid_count IS NOT NULL GROUP BY 1 ORDER BY 1;

\echo '=== 채점 3. 인수 부담 x 최저가율 ==='
SELECT CASE WHEN no_burden THEN '부담없음' ELSE '부담있음' END AS 인수,
       CASE WHEN min_rate >= 70 THEN '최저가율 70%+' ELSE '최저가율 70%미만' END AS 가격,
       count(*) AS 매각단위, count(*) FILTER (WHERE sold) AS 낙찰,
       round(100.0 * count(*) FILTER (WHERE sold) / count(*), 1) AS 낙찰률
FROM sale_unit WHERE burden_known AND min_rate IS NOT NULL GROUP BY 1, 2 ORDER BY 1, 2;

\echo '=== 채점 4. 용도별 (10단위 이상) ==='
SELECT usage AS 용도, count(*) AS 매각단위, count(*) FILTER (WHERE sold) AS 낙찰,
       round(100.0 * count(*) FILTER (WHERE sold) / count(*), 1) AS 낙찰률
FROM sale_unit GROUP BY 1 HAVING count(*) >= 10 ORDER BY 4 DESC;

-- ── 후보 필터 (2026-08-05 재작성) ──────────────────────────────────────────
-- 이전 필터는 "인수 부담 없음 + 유찰 3회 이상"이었다. 채점 결과 두 조건 중
-- **유찰 횟수는 낙찰률과 무관했다**(채점 2: 15~22%로 평평). 조건에서 뺀다.
--
-- 대신 채점 3에서 갈린 두 구간을 각각 뽑는다. 이름을 "좋은 물건"이라 붙이지 않는다 —
-- 낙찰률이 높다는 건 경쟁이 붙는다는 뜻이지 싸게 살 수 있다는 뜻이 아니다.
\echo '=== 후보 A. 권리 부담 없음 + 아직 많이 안 떨어짐 (실측 낙찰률 32.8%) ==='
\echo '(경쟁이 붙는 구간이다. 값이 올라가므로 싸게 사는 것과는 반대다)'
SELECT case_no AS 사건, item_no AS 번호, usage AS 용도, failed_bid_count AS 유찰,
       min_rate AS 최저가율, round(minimum_sale_price / 100000000.0, 2) AS 최저가억
FROM sale_unit
WHERE no_burden AND min_rate >= 70 AND NOT sold
ORDER BY min_rate ASC LIMIT 15;

\echo '=== 후보 B. 권리 부담 없는데 70% 밑으로 떨어짐 (실측 낙찰률 14.3%) ==='
\echo '(명세서에 안 나오는 이유로 기피되는 구간이다 — 명도·입지·건물 상태를 직접 확인해야 한다)'
SELECT case_no AS 사건, item_no AS 번호, usage AS 용도, failed_bid_count AS 유찰,
       min_rate AS 최저가율, round(minimum_sale_price / 100000000.0, 2) AS 최저가억
FROM sale_unit
WHERE no_burden AND min_rate < 70 AND NOT sold
ORDER BY min_rate ASC LIMIT 15;

\echo '=== 참고. 실측상 가장 안 팔린 구간: 인수 부담 있음 + 70% 미만 (66단위 중 2건, 3.0%) ==='
SELECT count(*) AS 매각단위, count(*) FILTER (WHERE sold) AS 낙찰
FROM sale_unit WHERE burden_known AND NOT no_burden AND min_rate < 70;

\echo '(표본 200단위 남짓이다. 10단위 미만인 줄은 우연으로 흔들리므로 읽지 않는다)'
