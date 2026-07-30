-- 명세서 자유서술을 구조화 플래그로 대체 (WP-11 §4-4).
--
-- 왜 원문을 버리는가: 비고·인수권리·지상권 란에는 신고인·가등기권자 실명이 마스킹 없이 실린다.
-- 정규식 이름 마스킹을 197행에 실제로 적용해보니 양방향으로 실패했다 —
--   오탐: 확약서→확OO, 가등기→가OO, **우선매수신고→우OO 신고**(H7 핵심 신호 파괴)
--   미탐: "가등기권자 이종관, 2022.12.22.제출"처럼 이름 뒤에 쉼표·날짜가 오면 놓친다
-- 예외 목록을 늘리는 것은 한국어 개체명 인식을 정규식으로 만드는 일이라 중단했다.
-- 대신 키워드 판정을 저장 전 메모리에서 하고 **결과 플래그만** 남긴다. 개인정보를 아예 들지 않는다.
-- 새 키워드가 필요하면 재수집하면 된다 — 이 필드들은 PDF 열람 창 밖에서도 조회된다(§4-3).

ALTER TABLE auction_item_notice
  DROP COLUMN IF EXISTS assumed_rights_note,
  DROP COLUMN IF EXISTS superficies_note,
  DROP COLUMN IF EXISTS remarks;

ALTER TABLE auction_item_notice
  -- 인수되는 권리의 유형. NULL=란 자체가 공란, 'NONE'=법원이 "해당사항없음"이라 적음.
  -- 둘은 다르다 — 공란은 미작성일 수 있고 NONE은 법원의 명시적 판단이다.
  -- 그 외: LEASEHOLD_REGISTRATION(주택임차권등기), SUPERFICIES(지상권설정등기),
  --        PROVISIONAL_REGISTRATION(가등기), OTHER
  ADD COLUMN IF NOT EXISTS assumed_rights_kind TEXT,
  -- 감지된 위험·조건 신호 코드. 배열이라 새 코드를 추가할 때 마이그레이션이 필요 없다.
  -- HUG_PRIORITY_WAIVER      주택도시보증공사 대항력 포기확약서 제출 → 임차권 인수 위험 소멸
  -- LIEN_CLAIM              유치권 신고 있음(성립여부는 별개)
  -- PREEMPTIVE_PURCHASE     우선매수 신고(공유자·LH 등)
  -- SENIOR_TAX              선순위 조세 경고
  -- TITLE_LOSS_RISK         가등기 완결 시 매수인이 소유권 상실 가능
  -- RESALE                  재매각(전 낙찰자 미납) — 매수신청보증금 20%
  -- LAND_SEPARATE_REGISTRATION  토지 별도등기 있음
  -- UNAUTHORIZED_EXTENSION  무단증축·장기미준공
  -- SITE_RIGHT_UNREGISTERED 대지권 미등기
  -- WATER_LEAK              누수
  ADD COLUMN IF NOT EXISTS risk_flags TEXT[] NOT NULL DEFAULT '{}',
  -- 유치권 신고액 (신고만으로 성립하지 않는다 — 사실 기록용)
  ADD COLUMN IF NOT EXISTS lien_claim_amount BIGINT;

CREATE INDEX IF NOT EXISTS auction_item_notice_risk_flags_idx
  ON auction_item_notice USING GIN (risk_flags);
