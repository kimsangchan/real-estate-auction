-- 종료된 사건의 점유자 성명을 지우고 그 시각을 남긴다 (NF-03, PIPC 2019-05-057).
--
-- 06-tech-blueprint §4의 원래 설계는 "개인정보 전용 테이블(case_person)을 두고 종료 감지 배치가
-- 그 테이블만 마스킹"이었다. 그런데 case_person은 수집기가 채우지 않아 0행이고, 실제 성명은
-- 007에서 사용자 결정으로 auction_item_notice_tenant.tenant_name에 원문 저장하고 있다.
-- 따라서 마스킹 대상은 이 테이블이다.
--
-- masked_at은 감사 로그다 — NF-03의 완료 기준이 "72시간 내 마스킹 100%"라 언제 지웠는지가 증거다.
-- 이미 지운 행을 다시 세지 않는 멱등 조건이기도 하다.

ALTER TABLE auction_item_notice_tenant
  ADD COLUMN IF NOT EXISTS masked_at TIMESTAMPTZ;

-- 마스킹 대상 조회는 "성명이 남아 있는 행"을 훑으므로 부분 인덱스가 맞다.
CREATE INDEX IF NOT EXISTS auction_item_notice_tenant_unmasked_idx
  ON auction_item_notice_tenant (notice_id)
  WHERE tenant_name IS NOT NULL;
