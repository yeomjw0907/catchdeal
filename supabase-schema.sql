-- CatchDeal Supabase 스키마 (명세서 4절 기준)
-- Supabase SQL Editor에서 실행

-- subscription_users (구독/라이선스)
CREATE TABLE IF NOT EXISTS subscription_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  hwid text,
  expire_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE subscription_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own row"
  ON subscription_users FOR SELECT
  USING (auth.uid() = id);

-- trade_logs (거래 로그)
CREATE TABLE IF NOT EXISTS trade_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  buy_price integer NOT NULL,
  sell_price integer NOT NULL,
  coupang_link text,
  order_id text,
  image_url text,
  status text NOT NULL DEFAULT 'PURCHASED' CHECK (status IN ('PURCHASED', 'LISTED', 'SOLD')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_logs_user_id_idx ON trade_logs(user_id);
CREATE INDEX IF NOT EXISTS trade_logs_created_at_idx ON trade_logs(created_at DESC);

ALTER TABLE trade_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own trade_logs"
  ON trade_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
