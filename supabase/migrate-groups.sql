-- 소통방(비공개 소그룹) 마이그레이션 — Supabase SQL Editor 에 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전(idempotent)합니다.

-- 9) 소통방(비공개 소그룹) — 초대된 멤버만 입장·대화, 리더가 초대, 개인별 알림
-- ─────────────────────────────────────────────
-- small_groups 에 리더(계정) 연결
alter table public.small_groups add column if not exists leader_id uuid references auth.users on delete set null;

-- 멤버십: 어떤 소통방에 누가(어떤 역할로) 속하는지 + 개인별 새글 알림 여부
create table if not exists public.group_members (
  group_id uuid not null references public.small_groups on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member' check (role in ('leader', 'member')),
  notify boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);
alter table public.group_members enable row level security;

-- 멤버십 헬퍼(RLS 재귀 방지: security definer)
create or replace function public.is_group_member(gid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = auth.uid());
$$;
create or replace function public.is_group_leader(gid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = auth.uid() and role = 'leader');
$$;

-- 멤버 수 자동 집계
create or replace function public.sync_group_member_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.small_groups set member_count = member_count + 1 where id = new.group_id;
  elsif tg_op = 'DELETE' then
    update public.small_groups set member_count = greatest(0, member_count - 1) where id = old.group_id;
  end if;
  return null;
end; $$;
drop trigger if exists group_members_count on public.group_members;
create trigger group_members_count after insert or delete on public.group_members
  for each row execute function public.sync_group_member_count();
-- 기존 소통방 멤버 수를 실제 값으로 맞춥니다.
update public.small_groups g
  set member_count = coalesce((select count(*) from public.group_members m where m.group_id = g.id), 0);

-- small_groups: 멤버·관리자만 조회 (기존 '공개 조회' 정책 대체). 생성/수정/삭제는 관리자만(기존 정책 유지).
drop policy if exists "small_groups 공개 조회" on public.small_groups;
drop policy if exists "소통방 조회" on public.small_groups;
create policy "소통방 조회" on public.small_groups
  for select using (public.is_group_member(id) or public.is_admin());
drop policy if exists "소통방 관리자 쓰기" on public.small_groups;
create policy "소통방 관리자 쓰기" on public.small_groups
  for all using (public.is_admin()) with check (public.is_admin());

-- group_members RLS
drop policy if exists "멤버 조회" on public.group_members;
create policy "멤버 조회" on public.group_members
  for select using (public.is_group_member(group_id) or public.is_admin());
drop policy if exists "멤버 추가" on public.group_members;
create policy "멤버 추가" on public.group_members
  for insert with check (public.is_admin() or (public.is_group_leader(group_id) and role = 'member'));
drop policy if exists "멤버 수정" on public.group_members;
create policy "멤버 수정" on public.group_members
  for update using (public.is_admin() or public.is_group_leader(group_id))
  with check (public.is_admin() or public.is_group_leader(group_id));
drop policy if exists "멤버 삭제" on public.group_members;
create policy "멤버 삭제" on public.group_members
  for delete using (public.is_admin() or public.is_group_leader(group_id) or user_id = auth.uid());

-- group_messages: 멤버만 조회·작성 (기존 로그인 전용 정책 대체)
drop policy if exists "소그룹 대화 조회" on public.group_messages;
drop policy if exists "소통방 대화 조회" on public.group_messages;
create policy "소통방 대화 조회" on public.group_messages
  for select using (public.is_group_member(group_id) or public.is_admin());
drop policy if exists "소그룹 대화 작성" on public.group_messages;
drop policy if exists "소통방 대화 작성" on public.group_messages;
create policy "소통방 대화 작성" on public.group_messages
  for insert with check (public.is_group_member(group_id) and author_id = auth.uid());
drop policy if exists "소그룹 대화 삭제" on public.group_messages;
drop policy if exists "소통방 대화 삭제" on public.group_messages;
create policy "소통방 대화 삭제" on public.group_messages
  for delete using (auth.uid() = author_id or public.is_admin() or public.is_group_leader(group_id));

-- 사용자 검색(초대용): 관리자 또는 '리더'만 이름으로 검색 가능 (id·이름만 반환)
create or replace function public.search_app_users(q text)
returns table(id uuid, name text)
language sql security definer stable set search_path = public as $$
  select p.id, p.name from public.profiles p
  where (
    public.is_admin()
    or exists (select 1 from public.group_members gm where gm.user_id = auth.uid() and gm.role = 'leader')
  )
  and p.name ilike '%' || q || '%'
  order by p.name
  limit 20;
$$;
grant execute on function public.search_app_users(text) to authenticated;

-- 개인별 소통방 알림 on/off (본인 것만) — 멤버가 직접 update 못 하므로 RPC 로 처리
create or replace function public.set_group_notify(gid uuid, want boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.group_members set notify = want
  where group_id = gid and user_id = auth.uid();
end; $$;
grant execute on function public.set_group_notify(uuid, boolean) to authenticated;

-- 소통방 멤버 목록(이름 포함) — 그 방의 멤버·관리자만
create or replace function public.list_group_members(gid uuid)
returns table(user_id uuid, name text, role text, notify boolean)
language sql security definer stable set search_path = public as $$
  select gm.user_id, coalesce(p.name, '성도') as name, gm.role, gm.notify
  from public.group_members gm
  left join public.profiles p on p.id = gm.user_id
  where gm.group_id = gid and (public.is_group_member(gid) or public.is_admin())
  order by (gm.role = 'leader') desc, coalesce(p.name, '성도');
$$;
grant execute on function public.list_group_members(uuid) to authenticated;
