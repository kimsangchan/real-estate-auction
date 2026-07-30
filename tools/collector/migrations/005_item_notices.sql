-- 매각물건명세서 수집 저장 (WP-11 §3-2). 법원 열람 창이 매각기일 1주 전~기일까지뿐이라
-- 그때 받아두지 않으면 영구 소실된다.
--
-- 개인정보 원칙(A-08): 명세서에는 임차인 실명이 마스킹 없이 들어 있다. 우리 권리분석 엔진은
-- 이름을 쓰지 않으므로(전입일·확정일자·보증금·배당요구일만 사용) **이름을 저장하지 않는다**.
-- 파싱 중에만 이름으로 동일인을 묶고, 저장 시 물건 내 순번(tenant_seq)으로 치환한다.
-- 같은 이유로 문서 원문 텍스트도 보관하지 않는다.

CREATE TABLE IF NOT EXISTS auction_item_notice (
  id BIGSERIAL PRIMARY KEY,
  auction_item_id BIGINT NOT NULL REFERENCES auction_item(id) ON DELETE CASCADE,
  -- 명세서 작성일. 같은 물건도 기일마다 새로 작성되므로 이력이 쌓인다
  document_date DATE,
  -- 최선순위 설정(말소기준) — 법원 기재 원문과 파싱 결과를 함께 둔다.
  -- 원문 예: "집합건물 : 2008.07.09 근저당권", "2024.12.11. 경매개시결정"
  -- 토지/집합건물을 따로 적는 사건이 있어 원문 보존이 필요하다
  baseline_raw TEXT,
  baseline_date DATE,
  distribution_demand_deadline DATE,
  -- "매각으로 그 효력이 소멸되지 아니하는 것" 란. 법원이 판단해 자유서술로 적는다.
  -- 공란이면 인수되는 권리 없음. 우리 룰의 인수/말소 판정 정답지가 된다
  assumed_rights_note TEXT,
  -- "매각에 따라 설정된 것으로 보는 지상권의 개요" 란
  superficies_note TEXT,
  -- 비고란 — 유치권 신고, 선순위 조세 경고, 우선매수 신고가 여기 실린다.
  -- 실측: 신고인 실명이 마스킹 없이 실린다. 저장 전에 `mask_person_names()`로 첫 글자+OO로
  -- 가린다(법원 표기 방식). 위 세 자유서술 필드 모두 같은 처리를 거친다
  remarks TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (auction_item_id, document_date)
);

CREATE INDEX IF NOT EXISTS auction_item_notice_item_idx
  ON auction_item_notice (auction_item_id, document_date DESC);

CREATE TABLE IF NOT EXISTS auction_item_notice_tenant (
  id BIGSERIAL PRIMARY KEY,
  notice_id BIGINT NOT NULL REFERENCES auction_item_notice(id) ON DELETE CASCADE,
  -- 이름 대신 물건 내 순번. 파싱 시 이름으로 동일인을 묶고 여기서 익명화한다 (개인정보 미저장)
  tenant_seq INTEGER NOT NULL,
  -- 정보출처: 현황조사 / 권리신고 / 등기사항전부증명서.
  -- 같은 임차인이 출처별로 여러 행에 나오므로 행을 합치지 않고 출처를 남긴다
  source_kind TEXT,
  occupied_part TEXT,
  -- 점유의 권원 (주거임차인, 점유자 등)
  possession_basis TEXT,
  lease_period TEXT,
  deposit_amount BIGINT,
  monthly_rent BIGINT,
  move_in_date DATE,
  -- 확정일자. 명세서에 "미상"으로 적히는 경우가 있어 그때는 NULL
  fixed_date DATE,
  demanded_distribution BOOLEAN,
  demanded_distribution_date DATE,
  UNIQUE (notice_id, tenant_seq, source_kind)
);

CREATE INDEX IF NOT EXISTS auction_item_notice_tenant_notice_idx
  ON auction_item_notice_tenant (notice_id);
