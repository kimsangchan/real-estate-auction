-- 경매물건 사진 저장 (WP-12). 법원이 공개하는 현황조사·감정평가 사진을 다룬다.
--
-- **사건 단위다.** 사진 API(`POST /pgj/pgj15B/selectPicInf.on`)는 사건 단위로 요청·응답하고
-- 사진 메타에 물건번호·목적물번호가 없다(실측: cortOfcCd·csNo·cortAuctnPicSeq·출처구분·설명뿐).
-- 물건 단위로 저장하면 다물건 사건이 복제된다 — 실측으로 2사건 11물건이 419행 52MB가 됐고
-- 고유 사진은 50장 7.5MB였다(7배). 화면에서는 물건 → 사건으로 조인해 보여준다.
--
-- 왜 URL이 아니라 바이트인가: 메타의 `picFileUrl`+`picTitlNm`을 직접 GET하면 404다.
-- 사진은 JSON 안 base64로만 전달되므로 참조 전략이 성립하지 않는다. `url`은 출처 추적용이다.
-- 열람 창 제한은 없다 — "감정평가서는 기일 2주 전부터"는 PDF 문서 열람에만 적용되고
-- 사진 API에는 적용되지 않는다(18년 전 사건도 41장 전부 조회됨).
--
-- 왜 오브젝트 스토리지가 아니라 BYTEA인가: 사건당 2~7MB로 실측됐다. 서울 2개 법원 174사건이면
-- 수백 MB 규모라 DB로 감당되고 백업이 한 단위로 묶인다. 전국 확대 시 이전한다.

CREATE TABLE IF NOT EXISTS auction_case_photo (
  id BIGSERIAL PRIMARY KEY,
  auction_case_id BIGINT NOT NULL REFERENCES auction_case(id) ON DELETE CASCADE,
  -- 출처: 'ITEM'(현황조사, auctnInfOriginDvsCd=2) | 'APPRAISAL'(감정평가, =4)
  source TEXT NOT NULL,
  -- 법원이 준 사진 순번 (cortAuctnPicSeq)
  seq INTEGER NOT NULL,
  -- 사진 구분 (cortAuctnPicDvsCd/Nm) — 위치도·전경·내부 등. 화면 정렬·묶음에 쓴다
  category_code TEXT,
  category_name TEXT,
  -- 법원이 붙인 사진 설명 (picDscrCtt)
  caption TEXT,
  -- NAS 경로. 직접 GET은 404이므로 출처 추적용으로만 둔다
  url TEXT,
  content_type TEXT,
  bytes BYTEA NOT NULL,
  byte_size INTEGER NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (auction_case_id, source, seq)
);

CREATE INDEX IF NOT EXISTS auction_case_photo_case_idx
  ON auction_case_photo (auction_case_id, source, seq);
