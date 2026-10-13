-- 맥체인 성경읽기표 진도 계정별 동기화 (여러 기기 공유)
-- Supabase → SQL Editor 에서 한 번 실행하세요.

create table if not exists public.reading_plan_progress (
  user_id uuid primary key references auth.users on delete cascade,
  done_days smallint[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.reading_plan_progress enable row level security;
drop policy if exists "본인 읽기진도 조회" on public.reading_plan_progress;
create policy "본인 읽기진도 조회" on public.reading_plan_progress
  for select using (user_id = auth.uid());

create or replace function public.set_reading_progress(p_days smallint[])
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.reading_plan_progress (user_id, done_days, updated_at)
  values (auth.uid(), coalesce(p_days, '{}'), now())
  on conflict (user_id) do update set done_days = excluded.done_days, updated_at = now();
$$;
grant execute on function public.set_reading_progress(smallint[]) to authenticated;
