-- WP-11 §4-7: 점유자 표 파싱 품질 표시 — 검증 게이트가 버린 행 수.
--
-- "임차인 없음"(행 0 + 버림 0)과 "행이 있었는데 전부 버림"(행 0 + 버림 >0)은 지금까지
-- 구분할 수 없었다. H3(임차인 존재가 매각 결과를 가르는가)는 후자를 '없음'으로 세면
-- 표본이 오염된다 — 버려지는 행도 실존 임차인이다(전입일·보증금 모두 미상인 행).
-- NULL = 이 컬럼 도입 전 스캔이거나 아직 스캔 전 → 품질을 모르므로 H3의 '없음'에 못 쓴다.
ALTER TABLE auction_item_notice
  ADD COLUMN IF NOT EXISTS tenant_rows_rejected INTEGER;

-- 백필: 도입 시점(2026-08-07)까지 파서 변형 3종 수정 + 재수집 3회를 끝낸 상태라,
-- 행 0건으로 스캔된 명세서 중 "전부 버림"은 마지막 실행 경고(notice_tenants_all_rejected)에
-- 찍힌 6개 사건뿐이다. 그 사건들만 실측 버림 수를 적고 나머지 0건 스캔은 0으로 확정한다.
-- 임차인 행이 있는 명세서는 NULL로 둔다 — H3의 '있음' 판정은 행 존재만 보므로 지장 없다.
UPDATE auction_item_notice n
SET tenant_rows_rejected = sub.rejected
FROM (
  SELECT n2.id,
         CASE ac.case_no WHEN '2025타경603' THEN 2 ELSE 1 END AS rejected
  FROM auction_item_notice n2
  JOIN auction_item ai ON ai.id = n2.auction_item_id
  JOIN auction_case ac ON ac.id = ai.auction_case_id
  WHERE ac.case_no IN ('2024타경146216', '2025타경603', '2025타경9586',
                       '2024타경1467', '2025타경3739', '2025타경12076')
) sub
WHERE n.id = sub.id
  AND n.tenant_scanned_at IS NOT NULL
  AND n.tenant_rows_rejected IS NULL
  AND NOT EXISTS (SELECT 1 FROM auction_item_notice_tenant t WHERE t.notice_id = n.id);

-- 0 확정은 파서 변형 수정이 끝난 뒤(2026-08-06 16:00 KST)의 스캔만 대상으로 한다.
-- 그 전에 결함 파서로 스캔됐고 기일이 지나 재검증이 불가능한 문서(96건)는 NULL로 남긴다 —
-- 그중 몇이 "전부 버림" 피해자인지 알 수 없으므로 "임차인 없음"으로 확정하면 H3가 오염된다.
UPDATE auction_item_notice n
SET tenant_rows_rejected = 0
WHERE n.tenant_scanned_at >= TIMESTAMPTZ '2026-08-06 16:00+09'
  AND n.tenant_rows_rejected IS NULL
  AND NOT EXISTS (SELECT 1 FROM auction_item_notice_tenant t WHERE t.notice_id = n.id);
