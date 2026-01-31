# SQL Setup

Supabase 등에서 실행할 SQL 스크립트를 번호 순으로 관리합니다.

- **실행 순서:** 파일명 앞 번호 순서대로 실행 (01 → 02 → …)
- **실행 위치:** Supabase 대시보드 → SQL Editor

## 목록

| 파일 | 설명 |
|------|------|
| `01_supabase_schema.sql` | subscription_users, trade_logs 테이블 + RLS |
| `02_add_subscription_user.sql` | 로그인 가능한 구독 사용자 추가 (Auth 사용자 생성 후 실행) |
