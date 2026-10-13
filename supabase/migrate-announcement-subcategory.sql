-- 공지사항 세부 분류(sub_category) 추가
-- Supabase → SQL Editor 에서 한 번 실행하세요. (이미 있으면 무시됩니다)
alter table public.announcements add column if not exists sub_category text;
