-- 소통방 읽음 표시(카톡식) — 각 멤버가 어디까지 읽었는지 기록해, '안 읽은 사람 수'를 셉니다.
-- Supabase SQL Editor 에 붙여넣고 Run 하세요. 여러 번 실행해도 안전(idempotent)합니다.

create table if not exists public.group_reads (
  group_id uuid not null references public.small_groups on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_reads_group_idx on public.group_reads (group_id);
alter table public.group_reads enable row level security;

-- 같은 방 멤버(·관리자)는 방의 모든 읽음 기록을 볼 수 있습니다(안 읽은 사람 수 계산용).
drop policy if exists "읽음 조회" on public.group_reads;
create policy "읽음 조회" on public.group_reads
  for select using (public.is_group_member(group_id) or public.is_admin());

-- 내가 이 방을 방금까지 읽었다고 표시(현재 시각으로 갱신). 본인 것만, 멤버일 때만.
create or replace function public.mark_group_read(gid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_member(gid) then
    return;
  end if;
  insert into public.group_reads (group_id, user_id, last_read_at)
  values (gid, auth.uid(), now())
  on conflict (group_id, user_id) do update set last_read_at = now();
end; $$;
grant execute on function public.mark_group_read(uuid) to authenticated;
