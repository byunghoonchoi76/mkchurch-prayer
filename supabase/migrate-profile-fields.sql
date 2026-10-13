-- 프로필에 생년월일·직분·소속 항목 추가 (선택 항목)
-- 실행: Supabase SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다(idempotent).

alter table public.profiles
  add column if not exists birth_date text,       -- 생년월일 (예: 1976-03-15 또는 자유 입력)
  add column if not exists birth_calendar text,   -- 양력 / 음력
  add column if not exists position text,         -- 직분 (예: 집사, 권사, 장로, 성도)
  add column if not exists affiliation text;      -- 소속 (예: 1교구, OO목장)

-- 본인 프로필 수정 정책은 기존 정책(role='member' 조건)으로 충분합니다.
-- 위 항목들은 role 을 바꾸지 않으므로 성도 본인이 자유롭게 수정할 수 있습니다.
