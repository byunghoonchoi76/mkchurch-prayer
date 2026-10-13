-- ─────────────────────────────────────────────
-- 관리자 계정 만들기
-- ─────────────────────────────────────────────
--
-- 방법 1 (권장, SQL 없이) — Supabase 대시보드에서 직접 만들기
--   Authentication → Users → Add user → "Create new user"
--   이메일과 비밀번호를 넣고 "Auto Confirm User" 를 켜서 만듭니다.
--   그 다음 아래 [2단계] 만 실행하면 끝입니다. 확인 메일이 필요 없습니다.
--
-- 방법 2 (아래 [1단계]) — 계정 생성까지 SQL 로 한 번에 처리
--   Supabase 버전에 따라 auth 표 구조가 조금씩 달라 실패할 수 있습니다.
--   실패하면 방법 1 을 쓰세요.
--
-- ⚠ 이 계정은 주보·공지·설교·소그룹을 모두 고칠 수 있습니다.
--   비밀번호를 충분히 길게 정하고, 시험이 끝나면 지우거나 비밀번호를 바꾸세요.

-- ─────────────────────────────────────────────
-- [1단계] 계정 만들기 (방법 2 를 쓸 때만)
-- 아래 두 값을 바꾼 뒤 실행하세요.
-- ─────────────────────────────────────────────
do $$
declare
  user_email    text := 'admin@example.com';   -- ← 쓰실 이메일
  user_password text := '여기에긴비밀번호';      -- ← 쓰실 비밀번호 (8자 이상 권장)
  user_name     text := '관리자';
  new_id        uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where email = user_email) then
    raise notice '이미 있는 계정입니다: %  → 2단계만 실행하세요.', user_email;
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
    user_email, extensions.crypt(user_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', user_name)
  );

  -- 이메일 로그인을 위해 identities 에도 한 줄이 필요합니다.
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), new_id,
    jsonb_build_object('sub', new_id::text, 'email', user_email),
    'email', user_email, now(), now(), now()
  );

  insert into public.profiles (id, name, role)
  values (new_id, user_name, 'admin')
  on conflict (id) do update set role = 'admin', name = excluded.name;

  raise notice '관리자 계정을 만들었습니다: %', user_email;
end;
$$;

-- ─────────────────────────────────────────────
-- [2단계] 이미 가입한 계정을 관리자로 지정
-- 이메일만 바꿔서 실행하세요. (방법 1·2 모두 이 단계로 마무리합니다)
--
-- 프로필이 아직 없으면 만들고, 있으면 관리자로 바꿉니다.
-- 마지막 returning 덕분에 결과 행이 보이므로 성공 여부를 눈으로 확인할 수 있습니다.
--   → 행이 1건 나오면 성공
--   → 'No rows' 면 그 이메일의 계정이 없는 것입니다 (오타이거나 아직 가입 전)
-- ─────────────────────────────────────────────
insert into public.profiles (id, name, role)
select id, coalesce(raw_user_meta_data ->> 'name', split_part(email, '@', 1)), 'admin'
from auth.users
where email = 'admin@example.com'
on conflict (id) do update set role = 'admin'
returning id, name, role;

-- 확인용 1: 가입된 계정과 권한을 모두 봅니다
select u.email, p.name, p.role, u.email_confirmed_at is not null as 메일확인됨
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc;

-- 확인용 2: 관리자만 보기
select u.email, p.name, p.role
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'admin';

-- ─────────────────────────────────────────────
-- 시험이 끝난 뒤 임시 계정을 지우려면
-- ─────────────────────────────────────────────
-- delete from auth.users where email = 'admin@example.com';
--   (profiles 는 함께 지워집니다)
