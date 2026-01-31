-- 구독 사용자 추가 (로그인 가능하게 하기)
-- 1) Supabase 대시보드 → Authentication → Users → "Add user" 로 이메일/비밀번호 사용자 생성
-- 2) 생성된 사용자의 UUID 복사
-- 3) 아래 INSERT에서 '여기에-사용자-UUID-붙여넣기', '이메일@example.com', 만료일 수정 후 실행

INSERT INTO subscription_users (id, email, hwid, expire_at, is_active)
VALUES (
  '여기에-사용자-UUID-붙여넣기',   -- Authentication → Users 에서 복사한 UUID
  '이메일@example.com',             -- 로그인할 이메일
  NULL,                             -- NULL = 기기 제한 없음, 나중에 HWID 넣으면 해당 기기만 허용
  '2026-12-31 23:59:59+00',        -- 구독 만료일 (필요하면 수정)
  true
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  expire_at = EXCLUDED.expire_at,
  is_active = EXCLUDED.is_active,
  updated_at = now();
