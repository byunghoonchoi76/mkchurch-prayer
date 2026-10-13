-- ────────────────────────────────────────────────────────────
-- 최신 변경사항 적용 마이그레이션
--   · '섬기는 사람들'(church_staff) 테이블이 없으면 만들고
--   · 새가족 등록(new_families) 테이블/정책을 보강하고
--   · 교회 정보(church_profile)의 지도·헌금 URL 컬럼을 추가합니다.
--
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전한(idempotent) 스크립트입니다.
-- (schema.sql 전체를 다시 실행해도 동일한 결과가 됩니다.)
-- ────────────────────────────────────────────────────────────

-- 1) 섬기는 사람들 (목사 · 장로 · 관리 3개 분류)
create table if not exists public.church_staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default '관리',
  role text not null default '',
  detail text not null default '',
  sort_order smallint not null default 0
);

-- 이미 church_staff 가 있던 경우 분류(category) 컬럼을 추가합니다.
alter table public.church_staff add column if not exists category text not null default '관리';

-- 기존에 등록된 사람들의 분류를 직분(role)으로 자동 지정합니다.
-- (목사 · 전도사 · 장로 · 관리 4개 분류)
update public.church_staff set category = '전도사'
  where category = '관리' and (role like '%전도사%' or role like '%강도사%');
update public.church_staff set category = '장로'
  where category = '관리' and role like '%장로%';
update public.church_staff set category = '목사'
  where category = '관리' and role like '%목사%';

-- 이전 마이그레이션에서 '목사'로 통합됐던 전도사를 다시 분리합니다.
update public.church_staff set category = '전도사'
  where category = '목사' and (role like '%전도사%' or role like '%강도사%');

alter table public.church_staff enable row level security;

drop policy if exists "church_staff 공개 조회" on public.church_staff;
create policy "church_staff 공개 조회" on public.church_staff for select using (true);

drop policy if exists "church_staff 관리자 쓰기" on public.church_staff;
create policy "church_staff 관리자 쓰기" on public.church_staff
  for all using (public.is_admin()) with check (public.is_admin());

-- 담임목사 한 명을 기본으로 넣어 둡니다(이미 있으면 건너뜁니다).
insert into public.church_staff (name, category, role, detail, sort_order)
select '공진수', '목사', '담임목사', '', 1
where not exists (select 1 from public.church_staff);

-- 2) 새가족 등록
create table if not exists public.new_families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  gender text not null default '',
  address text not null default '',
  referrer text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.new_families enable row level security;

drop policy if exists "새가족 신청" on public.new_families;
create policy "새가족 신청" on public.new_families for insert with check (true);

drop policy if exists "새가족 관리자 조회" on public.new_families;
create policy "새가족 관리자 조회" on public.new_families for select using (public.is_admin());

drop policy if exists "새가족 관리자 삭제" on public.new_families;
create policy "새가족 관리자 삭제" on public.new_families for delete using (public.is_admin());

-- 3) 교회 정보에 지도·헌금 URL 컬럼 추가
alter table public.church_profile add column if not exists giving_url text not null default '';
alter table public.church_profile add column if not exists map_url text not null default '';

-- 네이버 플레이스 정확 위치 링크를 설정합니다.
update public.church_profile set map_url = 'https://naver.me/5CCocDC6' where coalesce(map_url, '') = '';

-- 4) 공동 기도제목 (온 성도가 함께 기도하며 시간을 쌓아 가는 교회 공통 제목)
create table if not exists public.communal_prayers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  total_minutes integer not null default 0,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.communal_prayers enable row level security;

drop policy if exists "communal_prayers 공개 조회" on public.communal_prayers;
create policy "communal_prayers 공개 조회" on public.communal_prayers for select using (true);

drop policy if exists "communal_prayers 관리자 쓰기" on public.communal_prayers;
create policy "communal_prayers 관리자 쓰기" on public.communal_prayers
  for all using (public.is_admin()) with check (public.is_admin());

-- 기도한 시간(분)을 전체 누적에 안전하게 더하는 함수 (로그인 없이도 실행 가능)
create or replace function public.add_communal_prayer_minutes(p_id uuid, p_minutes integer)
returns setof public.communal_prayers
language sql
security definer
set search_path = public
as $$
  update public.communal_prayers
  set total_minutes = total_minutes + greatest(0, p_minutes)
  where id = p_id
  returning *;
$$;
grant execute on function public.add_communal_prayer_minutes(uuid, integer) to anon, authenticated;

-- 처음 시작할 기본 공동 기도제목을 넣어 둡니다(이미 있으면 건너뜁니다).
insert into public.communal_prayers (title, body, sort_order)
select * from (values
  ('민족 복음화와 나라를 위하여', '이 땅의 회복과 위정자들의 지혜, 다음 세대의 신앙 계승을 위해 함께 기도합니다.', 1),
  ('교회 부흥과 성도의 하나됨', '예배의 회복과 전도의 열정, 성도 간의 사랑과 섬김을 위해 함께 기도합니다.', 2),
  ('선교사와 열방을 위하여', '파송 선교사님들의 건강과 사역, 복음이 열방 가운데 전해지도록 함께 기도합니다.', 3)
) as v(title, body, sort_order)
where not exists (select 1 from public.communal_prayers);

-- 5) 나의 기도시간 계정별 저장 (로그인한 성도의 공동/개인 기도시간을 서버에 보관)
create table if not exists public.prayer_time (
  user_id uuid not null references auth.users on delete cascade,
  date date not null,
  kind text not null,
  minutes integer not null default 0,
  primary key (user_id, date, kind)
);

alter table public.prayer_time enable row level security;

drop policy if exists "본인 기도시간 조회" on public.prayer_time;
create policy "본인 기도시간 조회" on public.prayer_time
  for select using (auth.uid() = user_id);

drop policy if exists "본인 기도시간 삭제" on public.prayer_time;
create policy "본인 기도시간 삭제" on public.prayer_time
  for delete using (auth.uid() = user_id);

create or replace function public.add_prayer_time(p_date date, p_kind text, p_minutes integer)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.prayer_time (user_id, date, kind, minutes)
  values (auth.uid(), p_date, p_kind, greatest(0, p_minutes))
  on conflict (user_id, date, kind)
  do update set minutes = public.prayer_time.minutes + greatest(0, p_minutes);
$$;
grant execute on function public.add_prayer_time(date, text, integer) to authenticated;

-- 6) 개인 기도제목 / 기도 요청 분리: prayer_requests 에 공개 여부(shared) 컬럼 추가
--    · shared = true  → '기도 요청'으로 성도들에게 공개 (함께 기도 가능)
--    · shared = false → 작성자만 보는 개인 기도제목
alter table public.prayer_requests add column if not exists shared boolean not null default true;

-- 개인(비공개) 기도제목은 작성자·관리자만, 공개된 기도 요청은 모두가 볼 수 있게 정책을 갱신합니다.
drop policy if exists "기도제목 조회" on public.prayer_requests;
create policy "기도제목 조회" on public.prayer_requests
  for select using (shared or auth.uid() = author_id or public.is_admin());

-- 7) 앱 전역 설정 (실시간 방송 강제 on/off) — 관리자가 홈의 LIVE 배지를 직접 켜고 끌 수 있습니다.
create table if not exists public.app_settings (
  id smallint primary key default 1 check (id = 1),
  live_override text not null default 'auto' check (live_override in ('auto', 'on', 'off')),
  communal_goal_minutes integer not null default 6000, -- 공동 기도 목표(분). 기본 100시간. 관리자만 변경
  updated_at timestamptz not null default now()
);
-- 공동 기도 목표 컬럼 (기존 테이블에 없으면 추가)
alter table public.app_settings add column if not exists communal_goal_minutes integer not null default 6000;
insert into public.app_settings (id) values (1) on conflict (id) do nothing;
alter table public.app_settings enable row level security;
drop policy if exists "설정 공개 조회" on public.app_settings;
create policy "설정 공개 조회" on public.app_settings for select using (true);
drop policy if exists "설정 관리자 쓰기" on public.app_settings;
create policy "설정 관리자 쓰기" on public.app_settings for all using (public.is_admin()) with check (public.is_admin());

-- 8) 기도 알림(웹 푸시) 구독 테이블
-- 기도 알림(웹 푸시) 구독 저장. 기기(endpoint)별로 요일·시간을 둡니다.
-- 한 기기당 최대 3개(slot 0·1·2)의 알림을 서로 다른 요일·시간으로 둘 수 있습니다.
create table if not exists public.push_subscriptions (
  endpoint text not null,
  slot smallint not null default 0,
  p256dh text not null,
  auth text not null,
  user_id uuid references auth.users(id) on delete set null,
  days smallint[] not null default '{}',
  time_hhmm text not null default '21:00',
  tz text not null default 'Asia/Seoul',
  enabled boolean not null default true,
  last_sent_date text,
  updated_at timestamptz not null default now(),
  primary key (endpoint, slot)
);
-- 이미 만들어진 (예전) 테이블이면 slot 컬럼을 추가하고 기본키를 (endpoint, slot) 로 바꿉니다.
alter table public.push_subscriptions add column if not exists slot smallint not null default 0;
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'push_subscriptions_pkey'
      and conrelid = 'public.push_subscriptions'::regclass
      and array_length(conkey, 1) = 1
  ) then
    alter table public.push_subscriptions drop constraint push_subscriptions_pkey;
    alter table public.push_subscriptions add constraint push_subscriptions_pkey primary key (endpoint, slot);
  end if;
end $$;
alter table public.push_subscriptions enable row level security;
-- 구독은 불투명한 endpoint 로만 접근하므로 공개 정책으로 둡니다(교회 앱 특성).
drop policy if exists "구독 조회" on public.push_subscriptions;
create policy "구독 조회" on public.push_subscriptions for select using (true);
drop policy if exists "구독 저장" on public.push_subscriptions;
create policy "구독 저장" on public.push_subscriptions for insert with check (true);
drop policy if exists "구독 수정" on public.push_subscriptions;
create policy "구독 수정" on public.push_subscriptions for update using (true);
drop policy if exists "구독 삭제" on public.push_subscriptions;
create policy "구독 삭제" on public.push_subscriptions for delete using (true);

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
