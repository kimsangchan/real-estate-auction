-- 점유자 표의 고유키를 (tenant_seq, source_kind)에서 문서상 행 순서(row_no)로 바꾼다.
--
-- 005는 tenant_seq를 "물건 내 행 순번"으로 두고 UNIQUE (notice_id, tenant_seq, source_kind)를 걸었다.
-- §4-8에서 rowspan 병합을 고치며 tenant_seq의 의미가 **동일인 순번**으로 바뀌었는데 제약은 그대로
-- 남았다. 그래서 한 사람이 같은 정보출처로 두 행을 갖는 문서(예: HUG가 등기사항전부증명서로
-- 임차권등기 2건)를 저장할 수 없다 — 실측: 2026-07-31 수집에서 두 법원 모두 이 제약으로 실패해
-- 명세서 467건이 통째로 버려졌다.
--
-- 멱등성은 이 제약이 아니라 저장소의 "notice별 통째 삭제 후 재삽입"이 보장한다.
-- 그래서 제약은 문서상 행 순서만 고정하면 충분하다.

ALTER TABLE auction_item_notice_tenant
  ADD COLUMN IF NOT EXISTS row_no INTEGER;

-- 기존 행은 정렬이 곧 문서 순서다(삽입 순서대로 id가 커진다) — id 순으로 번호를 매긴다.
UPDATE auction_item_notice_tenant t
SET row_no = ordered.rn
FROM (
  SELECT id, row_number() OVER (PARTITION BY notice_id ORDER BY id) AS rn
  FROM auction_item_notice_tenant
) AS ordered
WHERE t.id = ordered.id AND t.row_no IS NULL;

ALTER TABLE auction_item_notice_tenant
  DROP CONSTRAINT IF EXISTS auction_item_notice_tenant_notice_id_tenant_seq_source_kind_key;

ALTER TABLE auction_item_notice_tenant
  ALTER COLUMN row_no SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE auction_item_notice_tenant
    ADD CONSTRAINT auction_item_notice_tenant_notice_id_row_no_key UNIQUE (notice_id, row_no);
EXCEPTION
  WHEN duplicate_table THEN NULL;  -- 이미 있으면 그대로 둔다 (마이그레이션은 매번 재실행된다)
  WHEN duplicate_object THEN NULL;
END $$;
