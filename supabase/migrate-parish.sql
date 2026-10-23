-- 회원가입·프로필에 '교구(parish)' 항목 추가 + 가입 시 직분·교구 자동 저장
-- 실행: Supabase SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다(idempotent).

-- 1) 교구 컬럼 추가 (선택 항목)
alter table public.profiles
  add column if not exists parish text;            -- 교구 (예: 1교구, 청년, 미정)

-- 2) 회원가입 시 메타데이터(name·position·parish)를 프로필에 함께 저장하도록 트리거 갱신.
--    확인 메일(이메일 인증)을 켜 둔 경우에도 가입 때 고른 직분·교구가 보존됩니다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, position, parish)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'position', ''),
    nullif(new.raw_user_meta_data ->> 'parish', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
