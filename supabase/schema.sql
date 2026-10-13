-- 교회 앱 Supabase 스키마
-- 사용법: Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 실행하세요.

-- ─────────────────────────────────────────────
-- 사용자 프로필 (역할 관리)
-- ─────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '성도',
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);

-- 로그인한 사용자가 관리자인지 확인하는 헬퍼.
-- security definer 로 두어야 profiles 정책 안에서 재귀 없이 사용할 수 있습니다.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ─────────────────────────────────────────────
-- 교회 정보 · 예배 시간
-- ─────────────────────────────────────────────
create table if not exists public.church_profile (
  id smallint primary key default 1 check (id = 1),
  name text not null,
  slogan text not null default '',
  slogan_verse text not null default '',
  pastor text not null default '',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  offering_account text not null default '',
  youtube_url text not null default '',
  giving_url text not null default '',
  map_url text not null default ''
);

-- 이미 만들어 둔 테이블에도 안전하게 추가합니다.
alter table public.church_profile add column if not exists youtube_url text not null default '';
alter table public.church_profile add column if not exists slogan_verse text not null default '';
alter table public.church_profile add column if not exists giving_url text not null default '';
alter table public.church_profile add column if not exists map_url text not null default '';

-- 앱 전역 설정 (실시간 방송 강제 표시 등) — 한 줄(id=1)만 사용합니다.
create table if not exists public.app_settings (
  id smallint primary key default 1 check (id = 1),
  live_override text not null default 'auto' check (live_override in ('auto', 'on', 'off')),
  communal_goal_minutes integer not null default 6000, -- 공동 기도 목표(분). 기본 100시간. 관리자만 변경
  updated_at timestamptz not null default now()
);
-- 기존 테이블에 컬럼이 없으면 추가(여러 번 실행해도 안전)
alter table public.app_settings add column if not exists communal_goal_minutes integer not null default 6000;
insert into public.app_settings (id) values (1) on conflict (id) do nothing;
alter table public.app_settings enable row level security;
drop policy if exists "설정 공개 조회" on public.app_settings;
create policy "설정 공개 조회" on public.app_settings for select using (true);
drop policy if exists "설정 관리자 쓰기" on public.app_settings;
create policy "설정 관리자 쓰기" on public.app_settings for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.service_times (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  schedule text not null,
  place text not null default '본당',
  note text,
  -- '예배' 는 전체 예배, '교육부서' 는 연령별 부서 예배
  category text not null default '예배' check (category in ('예배', '교육부서')),
  sort_order smallint not null default 0
);

alter table public.service_times add column if not exists category text not null default '예배';

-- ─────────────────────────────────────────────
-- 주보
-- ─────────────────────────────────────────────
create table if not exists public.bulletins (
  id uuid primary key default gen_random_uuid(),
  service_date date not null,
  title text not null default '주일 예배 주보',
  sermon_title text not null,
  preacher text not null,
  scripture text not null default '',
  weekly_verse text not null default '',
  -- [{ "title": "예배의 부름", "detail": "시편 100:1-5" }, ...]
  order_items jsonb not null default '[]'::jsonb,
  -- ["광고1", "광고2"]
  notices jsonb not null default '[]'::jsonb,
  -- 주보 원본 이미지 주소들 (["앞면.jpg", "뒷면.jpg"]). PDF 주소도 넣을 수 있습니다.
  image_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.bulletins add column if not exists image_urls jsonb not null default '[]'::jsonb;

create index if not exists bulletins_service_date_idx on public.bulletins (service_date desc);

-- ─────────────────────────────────────────────
-- 공지사항
-- ─────────────────────────────────────────────
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default '공지' check (category in ('공지', '행사', '소식')),
  sub_category text,
  author text not null default '교회 사무실',
  pinned boolean not null default false,
  images text[] not null default '{}',
  published_at timestamptz not null default now()
);
-- 이미 만들어진 테이블에도 세부 분류·포스터 컬럼을 추가합니다(있으면 무시).
alter table public.announcements add column if not exists sub_category text;
alter table public.announcements add column if not exists images text[] not null default '{}';

create index if not exists announcements_published_idx on public.announcements (pinned desc, published_at desc);

-- ─────────────────────────────────────────────
-- 설교
-- ─────────────────────────────────────────────
create table if not exists public.sermons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  preacher text not null,
  scripture text not null default '',
  preached_on date not null,
  series text,
  media_type text not null default 'video' check (media_type in ('video', 'audio')),
  media_url text not null,
  thumbnail_url text,
  summary text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists sermons_preached_on_idx on public.sermons (preached_on desc);

-- ─────────────────────────────────────────────
-- 기도제목
-- ─────────────────────────────────────────────
create table if not exists public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  author text not null default '익명',
  author_id uuid references auth.users on delete set null,
  anonymous boolean not null default false,
  answered boolean not null default false,
  -- true 면 '기도 요청'으로 성도들에게 공개. false 면 작성자만 보는 개인 기도제목.
  shared boolean not null default true,
  pray_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.prayer_requests add column if not exists shared boolean not null default true;

create index if not exists prayer_requests_created_idx on public.prayer_requests (created_at desc);

-- '함께 기도' 카운트를 안전하게 1 올립니다 (동시 클릭에도 값이 어긋나지 않도록).
create or replace function public.increment_pray_count(request_id uuid)
returns setof public.prayer_requests
language sql
security definer
set search_path = public
as $$
  update public.prayer_requests
  set pray_count = pray_count + 1
  where id = request_id
  returning *;
$$;

-- 공동 기도제목 — 온 성도가 함께 기도하며 시간(분)을 쌓아 가는 교회 공통 제목
create table if not exists public.communal_prayers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  total_minutes integer not null default 0, -- 누적 기도시간(초). 이름은 total_minutes 지만 단위는 '초'. migrate-prayer-seconds.sql 참고
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

-- 이 제목으로 기도한 시간(분)을 전체 누적에 안전하게 더합니다 (동시 기도에도 합계가 어긋나지 않도록).
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

-- 로그인하지 않은 성도도 함께 기도할 수 있도록 실행 권한을 부여합니다.
grant execute on function public.add_communal_prayer_minutes(uuid, integer) to anon, authenticated;

-- 로그인한 성도 본인의 기도시간 기록 (공동/개인). 계정별로 저장되어 기기를 바꿔도 유지됩니다.
create table if not exists public.prayer_time (
  user_id uuid not null references auth.users on delete cascade,
  date date not null,
  kind text not null,
  minutes integer not null default 0, -- 누적 기도시간(초). 이름은 minutes 지만 단위는 '초'. migrate-prayer-seconds.sql 참고
  primary key (user_id, date, kind)
);

-- 하루치 기도시간을 더합니다. auth.uid() 로 본인 것만 기록됩니다.
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

-- 맥체인 성경읽기표 진도 (계정별) — 완료한 날을 표 인덱스(0~364) 배열로 저장합니다.
create table if not exists public.reading_plan_progress (
  user_id uuid primary key references auth.users on delete cascade,
  done_days smallint[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.reading_plan_progress enable row level security;
drop policy if exists "본인 읽기진도 조회" on public.reading_plan_progress;
create policy "본인 읽기진도 조회" on public.reading_plan_progress
  for select using (user_id = auth.uid());

-- 진도 저장(본인 것만). auth.uid() 로 본인 행에 통째로 upsert 합니다.
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

-- ─────────────────────────────────────────────
-- 소그룹 · 소통방
-- ─────────────────────────────────────────────
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

create table if not exists public.church_staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default '관리',
  role text not null default '',
  detail text not null default '',
  sort_order smallint not null default 0
);

alter table public.church_staff add column if not exists category text not null default '관리';

create table if not exists public.small_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  leader text not null default '',
  leader_id uuid references auth.users on delete set null,
  meeting_info text not null default '',
  description text not null default '',
  member_count integer not null default 0
);

-- 소통방 멤버십: 초대된 멤버만 입장·대화, 리더가 초대, 개인별 새글 알림
create table if not exists public.group_members (
  group_id uuid not null references public.small_groups on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member' check (role in ('leader', 'member')),
  notify boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);

-- 멤버십 헬퍼(RLS 재귀 방지)
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

-- 사용자 검색(초대용): 관리자·리더만, id·이름만 반환
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

-- 개인별 소통방 알림 on/off (본인 것만)
create or replace function public.set_group_notify(gid uuid, want boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.group_members set notify = want
  where group_id = gid and user_id = auth.uid();
end; $$;
grant execute on function public.set_group_notify(uuid, boolean) to authenticated;

-- 소통방 멤버 목록(이름 포함) — 그 방의 멤버·관리자만 볼 수 있습니다.
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

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.small_groups on delete cascade,
  author text not null default '성도',
  author_id uuid references auth.users on delete set null,
  body text not null,
  image_url text,
  created_at timestamptz not null default now()
);
alter table public.group_messages add column if not exists image_url text;

create index if not exists group_messages_group_idx on public.group_messages (group_id, created_at);

-- 소통방 읽음 표시(카톡식) — 멤버별로 마지막으로 읽은 시각을 기록
create table if not exists public.group_reads (
  group_id uuid not null references public.small_groups on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_reads_group_idx on public.group_reads (group_id);
alter table public.group_reads enable row level security;
drop policy if exists "읽음 조회" on public.group_reads;
create policy "읽음 조회" on public.group_reads
  for select using (public.is_group_member(group_id) or public.is_admin());
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

-- ─────────────────────────────────────────────
-- RLS: 읽기는 모두에게, 쓰기는 로그인/관리자에게
-- ─────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.church_profile enable row level security;
alter table public.service_times enable row level security;
alter table public.bulletins enable row level security;
alter table public.announcements enable row level security;
alter table public.sermons enable row level security;
alter table public.prayer_requests enable row level security;
alter table public.communal_prayers enable row level security;
alter table public.prayer_time enable row level security;
alter table public.new_families enable row level security;
alter table public.church_staff enable row level security;
alter table public.small_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

-- 프로필: 본인 것만 읽고 쓰기, 관리자는 전체 조회
drop policy if exists "본인 프로필 조회" on public.profiles;
create policy "본인 프로필 조회" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "본인 프로필 생성" on public.profiles;
create policy "본인 프로필 생성" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "본인 프로필 수정" on public.profiles;
create policy "본인 프로필 수정" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id and role = 'member' or public.is_admin());

-- 공개 읽기 + 관리자 쓰기 테이블
do $$
declare
  t text;
begin
  foreach t in array array['church_profile', 'service_times', 'bulletins', 'announcements', 'sermons', 'church_staff', 'communal_prayers']
  loop
    execute format('drop policy if exists "%s 공개 조회" on public.%I', t, t);
    execute format('create policy "%s 공개 조회" on public.%I for select using (true)', t, t);

    execute format('drop policy if exists "%s 관리자 쓰기" on public.%I', t, t);
    execute format('create policy "%s 관리자 쓰기" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end;
$$;

-- 기도제목: 누구나 읽기, 로그인 사용자가 작성, 본인/관리자가 수정
-- 기도제목은 민감할 수 있어 로그인한 성도만 읽을 수 있습니다.
drop policy if exists "기도제목 조회" on public.prayer_requests;
create policy "기도제목 조회" on public.prayer_requests
  for select using (shared or auth.uid() = author_id or public.is_admin());

drop policy if exists "기도제목 작성" on public.prayer_requests;
create policy "기도제목 작성" on public.prayer_requests
  for insert with check (auth.uid() is not null);

drop policy if exists "기도제목 수정" on public.prayer_requests;
create policy "기도제목 수정" on public.prayer_requests
  for update using (auth.uid() = author_id or public.is_admin());

drop policy if exists "기도제목 삭제" on public.prayer_requests;
create policy "기도제목 삭제" on public.prayer_requests
  for delete using (auth.uid() = author_id or public.is_admin());

-- 나의 기도시간: 본인 것만 읽고·지울 수 있습니다 (기록 추가는 add_prayer_time 함수로).
drop policy if exists "본인 기도시간 조회" on public.prayer_time;
create policy "본인 기도시간 조회" on public.prayer_time
  for select using (auth.uid() = user_id);

drop policy if exists "본인 기도시간 삭제" on public.prayer_time;
create policy "본인 기도시간 삭제" on public.prayer_time
  for delete using (auth.uid() = user_id);

-- 소통방: 멤버·관리자만 조회, 생성/수정/삭제는 관리자만
drop policy if exists "소통방 조회" on public.small_groups;
create policy "소통방 조회" on public.small_groups
  for select using (public.is_group_member(id) or public.is_admin());
drop policy if exists "소통방 관리자 쓰기" on public.small_groups;
create policy "소통방 관리자 쓰기" on public.small_groups
  for all using (public.is_admin()) with check (public.is_admin());

-- 멤버십: 멤버·관리자 조회, 관리자/리더가 초대(추가)·수정·삭제, 본인 탈퇴 가능
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

-- 소통방 대화: 멤버만 조회·작성, 작성자/리더/관리자가 삭제
drop policy if exists "소통방 대화 조회" on public.group_messages;
create policy "소통방 대화 조회" on public.group_messages
  for select using (public.is_group_member(group_id) or public.is_admin());
drop policy if exists "소통방 대화 작성" on public.group_messages;
create policy "소통방 대화 작성" on public.group_messages
  for insert with check (public.is_group_member(group_id) and author_id = auth.uid());
drop policy if exists "소통방 대화 삭제" on public.group_messages;
create policy "소통방 대화 삭제" on public.group_messages
  for delete using (auth.uid() = author_id or public.is_admin() or public.is_group_leader(group_id));

-- 새가족 등록: 누구나 신청(insert)할 수 있고, 조회·삭제는 관리자만
drop policy if exists "새가족 신청" on public.new_families;
create policy "새가족 신청" on public.new_families for insert with check (true);

drop policy if exists "새가족 관리자 조회" on public.new_families;
create policy "새가족 관리자 조회" on public.new_families for select using (public.is_admin());

drop policy if exists "새가족 관리자 삭제" on public.new_families;
create policy "새가족 관리자 삭제" on public.new_families for delete using (public.is_admin());

-- 새로 가입하면 profiles 행을 자동으로 만들어 줍니다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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
