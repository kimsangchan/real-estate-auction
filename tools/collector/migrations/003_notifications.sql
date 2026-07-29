-- 관심 물건 변동 푸시 (WP-09 §1-5,6) — 기기 토큰과 발송 이력.
-- 알림은 사용자가 관심 등록한 물건에 한정한다 (F-06, T-07 — 마케팅 푸시 없음).

CREATE TABLE IF NOT EXISTS device_token (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS device_token_user_id_idx ON device_token (user_id);

-- 같은 변동·리마인더를 두 번 보내지 않기 위한 멱등 키 (WP-09 §1-5).
-- 잡이 재시작되거나 중복 실행돼도 UNIQUE 충돌로 발송이 걸러진다 (AGENTS.md 규칙 10).
CREATE TABLE IF NOT EXISTS notification_delivery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  dedupe_key TEXT NOT NULL,
  auction_item_id BIGINT NOT NULL REFERENCES auction_item(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS notification_delivery_user_id_idx ON notification_delivery (user_id);

-- 알림 잡의 커서 — "마지막으로 처리한 auction_schedule.observed_at"을 한 행으로 들고 있는다.
-- 잡이 여러 번 돌아도 이미 훑은 구간을 다시 훑지 않게 한다 (WP-09 §1-1).
CREATE TABLE IF NOT EXISTS notification_cursor (
  name TEXT PRIMARY KEY,
  processed_through TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
