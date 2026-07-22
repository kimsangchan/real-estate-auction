-- 사용자·리프레시 토큰·관심 물건 (WP-08 §1-5) — 소셜 로그인 계정과 관심 등록을 저장한다.
-- 개인정보(닉네임만) 최소 수집 원칙(A-08) — 이메일·전화번호 등은 저장하지 않는다.

CREATE TABLE IF NOT EXISTS app_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS refresh_token (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  family_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refresh_token_family_id_idx ON refresh_token (family_id);
CREATE INDEX IF NOT EXISTS refresh_token_user_id_idx ON refresh_token (user_id);

CREATE TABLE IF NOT EXISTS favorite (
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  court_office_code TEXT NOT NULL,
  case_no TEXT NOT NULL,
  item_no TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, court_office_code, case_no, item_no)
);
