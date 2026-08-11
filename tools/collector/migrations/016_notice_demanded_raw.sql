-- 배당요구여부의 근거를 남긴다 — 판정은 바꾸지 않는다 (WP-11 §4-26).
--
-- 왜 필요한가: demanded_distribution 은 BOOLEAN 하나뿐이라 NULL 이 서로 다른 네 가지 원인의
-- 합류점이 됐다. (a) 칸이 진짜 공란 (b) 그 정보출처 행에는 이 칸이 아예 없음 (c) 컬럼 경계가
-- 어긋나 조각이 버려짐 (d) 두 행이 한 행으로 병합됨. 셀 원문을 남기지 않아 사후 분리가 불가능하다.
-- 점유자 표는 기일 1주 전~기일에만 열람 가능해 재수집으로도 복구할 수 없다(WP-11 §4-3).
--
-- 실측(2026-08-11): NULL 4,108 중 4,075(99.2%)가 현황조사(2,541)·등기사항전부증명서(1,534) 행
-- 이다. 이 칸은 권리신고 행에만 적히므로(true 2,617 중 2,599가 권리신고 행) 그 NULL 은 (b)다.
--
-- **기존 행을 채우지 않는다 (UPDATE·기본값 없음).** 공란을 "배당요구 안 함"으로 새기면
-- 배당요구가 확인된 그 사람의 다른 출처 행 1,613건이 자기모순이 된다. 014 가 세운
-- "NULL = 모른다, 그러므로 확정 판단에 쓰지 않는다"는 관례를 그대로 따른다.
--
-- 신규분과 옛 행의 구분은 새 컬럼이 아니라 컷오프로 한다 — 점유자 행은 스캔마다 DELETE+INSERT
-- 되므로(postgres_repository), auction_item_notice.tenant_scanned_at 이 이 마이그레이션 배포
-- 시각 이후인 명세서에서만 "raw 가 NULL 이면 셀이 진짜 비어 있었다"로 읽는다. 그 전 행은
-- "원문 미보관"으로 읽는다. (014 의 컷오프 관례와 같은 형식)
ALTER TABLE auction_item_notice_tenant
    ADD COLUMN IF NOT EXISTS demanded_distribution_raw TEXT;

COMMENT ON COLUMN auction_item_notice_tenant.demanded_distribution_raw IS
    '배당요구여부 칸의 셀 원문(가공 없음). NULL 은 스캔 시각이 016 배포 이후일 때만 "칸이 비었다"를 뜻한다';

-- 표가 다음 페이지로 이어졌는지. 파서는 이미 TenantTable.continued 로 계산하는데 저장하지
-- 않아서, "권리신고 행이 없다"와 "2쪽에 있어서 못 받았다"를 구분할 수 없었다.
-- 수집기는 명세서 텍스트를 2쪽까지만 읽으므로(runner.py NOTICE_TEXT_MAX_PAGES) 3쪽 이상
-- 문서는 여전히 잘린다 — continued 는 그 사실을 "모른다"로 남기기 위한 표시다.
ALTER TABLE auction_item_notice
    ADD COLUMN IF NOT EXISTS tenant_table_continued BOOLEAN;

COMMENT ON COLUMN auction_item_notice.tenant_table_continued IS
    '점유자 표가 다음 페이지로 이어졌는지. true 면 표가 불완전할 수 있어 "행이 없다"를 근거로 쓸 수 없다';
