CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS auction_case (
  id BIGSERIAL PRIMARY KEY,
  court_office_code TEXT NOT NULL,
  case_no TEXT NOT NULL,
  court_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (court_office_code, case_no)
);

CREATE TABLE IF NOT EXISTS auction_item (
  id BIGSERIAL PRIMARY KEY,
  auction_case_id BIGINT NOT NULL REFERENCES auction_case(id) ON DELETE CASCADE,
  item_no TEXT NOT NULL,
  usage_code TEXT,
  address TEXT,
  appraisal_amount BIGINT,
  minimum_sale_price BIGINT,
  failed_bid_count INTEGER,
  geom geometry(Point, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (auction_case_id, item_no)
);

CREATE INDEX IF NOT EXISTS auction_item_geom_gist_idx
  ON auction_item USING GIST (geom);

CREATE TABLE IF NOT EXISTS auction_schedule (
  id BIGSERIAL PRIMARY KEY,
  auction_item_id BIGINT NOT NULL REFERENCES auction_item(id) ON DELETE CASCADE,
  bid_datetime TIMESTAMPTZ,
  minimum_sale_price BIGINT,
  failed_bid_count INTEGER,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (auction_item_id, bid_datetime, minimum_sale_price, failed_bid_count)
);

CREATE TABLE IF NOT EXISTS auction_item_raw (
  id BIGSERIAL PRIMARY KEY,
  auction_item_id BIGINT NOT NULL REFERENCES auction_item(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  payload JSONB NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS case_person (
  id BIGSERIAL PRIMARY KEY,
  auction_case_id BIGINT NOT NULL REFERENCES auction_case(id) ON DELETE CASCADE,
  role_code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  masked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
