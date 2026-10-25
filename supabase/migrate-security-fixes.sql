-- ════════════════════════════════════════════════════════════════════
-- 보안 수정 모음 (Strix 보안 점검 결과 대응)
-- ────────────────────────────────────────────────────────────────────
-- 이미 운영 중인 Supabase 프로젝트의 SQL Editor 에서 이 파일을 한 번
-- 실행하세요. 여러 번 실행해도 안전합니다(멱등).
--
-- 함께 배포해야 하는 코드 변경:
--   · src/lib/reminders.ts        (push_subscriptions 를 RPC 로 다룸)
--   · src/lib/storage.ts          (소통방 사진 경로에 그룹 id 포함)
--   · src/app/groups/[id].tsx     (업로드 시 그룹 id 전달)
--   · src/app/admin/new-families.tsx (관리자 화면 가드)
--   · supabase/functions/notify-group (작성자 검증 보완) → 재배포 필요
-- ════════════════════════════════════════════════════════════════════


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1) [심각] push_subscriptions — 전면 공개(using true) 정책 제거
--    누구나(비로그인 포함) 전체 구독을 조회·삭제·위조할 수 있던 문제.
--    → 직접 테이블 접근을 막고, 자신의 불투명한 endpoint 를 제시해야만
--      동작하는 RPC 로만 다루게 합니다. (익명 구독 기능은 그대로 유지)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
drop policy if exists "구독 조회" on public.push_subscriptions;
drop policy if exists "구독 저장" on public.push_subscriptions;
drop policy if exists "구독 수정" on public.push_subscriptions;
drop policy if exists "구독 삭제" on public.push_subscriptions;

alter table public.push_subscriptions enable row level security;
-- 허용 정책이 하나도 없으므로 REST 직접 접근(조회/삽입/수정/삭제)은 모두 막힙니다.
-- service_role(Edge Function) 과 아래 security definer RPC 만 테이블에 접근합니다.
revoke all on public.push_subscriptions from anon, authenticated;

-- 조회: p256dh/auth(푸시 암호키)는 돌려주지 않습니다.
create or replace function public.push_get_slots(p_endpoint text)
returns table (slot smallint, days smallint[], time_hhmm text, enabled boolean)
language sql security definer set search_path = public as $$
  select slot, days, time_hhmm, enabled
  from public.push_subscriptions
  where endpoint = p_endpoint
  order by slot;
$$;

-- 저장/수정(upsert). user_id 는 호출자가 로그인했으면 그 사람으로 강제합니다.
create or replace function public.push_upsert(
  p_endpoint text,
  p_slot smallint,
  p_p256dh text,
  p_auth text,
  p_days smallint[],
  p_time_hhmm text,
  p_tz text,
  p_enabled boolean
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.push_subscriptions
    (endpoint, slot, p256dh, auth, user_id, days, time_hhmm, tz, enabled, updated_at)
  values
    (p_endpoint, coalesce(p_slot, 0::smallint), p_p256dh, p_auth, auth.uid(),
     coalesce(p_days, '{}'), coalesce(p_time_hhmm, '21:00'),
     coalesce(p_tz, 'Asia/Seoul'), coalesce(p_enabled, false), now())
  on conflict (endpoint, slot) do update set
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_id = coalesce(auth.uid(), public.push_subscriptions.user_id),
    days = excluded.days,
    time_hhmm = excluded.time_hhmm,
    tz = excluded.tz,
    enabled = excluded.enabled,
    updated_at = now();
end; $$;

-- 로그인 시, 로그아웃 상태에서 만든 구독에 본인 user_id 를 채웁니다.
create or replace function public.push_claim(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  update public.push_subscriptions
  set user_id = auth.uid()
  where endpoint = p_endpoint and user_id is null and auth.uid() is not null;
$$;

create or replace function public.push_delete_slot(p_endpoint text, p_slot smallint)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and slot = p_slot;
$$;

-- 지정한 slot 들만 남기고 이 endpoint 의 나머지는 삭제합니다.
create or replace function public.push_delete_others(p_endpoint text, p_keep smallint[])
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions
  where endpoint = p_endpoint and not (slot = any(coalesce(p_keep, '{}')));
$$;

create or replace function public.push_disable(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  update public.push_subscriptions set enabled = false where endpoint = p_endpoint;
$$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'push_get_slots(text)',
    'push_upsert(text,smallint,text,text,smallint[],text,text,boolean)',
    'push_claim(text)',
    'push_delete_slot(text,smallint)',
    'push_delete_others(text,smallint[])',
    'push_disable(text)'
  ] loop
    execute format('revoke all on function public.%s from public;', fn);
    execute format('grant execute on function public.%s to anon, authenticated;', fn);
  end loop;
end $$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2) [높음] profiles INSERT — role 값 무제한 → 관리자 자가 승격 차단
--    본인 행(auth.uid()=id)만, 그리고 role 은 반드시 'member' 로만 생성.
--    (실제 가입은 handle_new_user 트리거가 처리하므로 영향 없음)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
drop policy if exists "본인 프로필 생성" on public.profiles;
create policy "본인 프로필 생성" on public.profiles
  for insert with check (auth.uid() = id and role = 'member');


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3) [중간] prayer_requests 조회 — 비공개(shared=false) 기도제목 노출 복구
--    update-prayer-read-policy.sql 이 덮어쓴 '로그인하면 전부' 정책을
--    원래의 '공개글 OR 작성자 본인 OR 관리자' 로 되돌립니다.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
drop policy if exists "기도제목 조회" on public.prayer_requests;
create policy "기도제목 조회" on public.prayer_requests
  for select using (shared or auth.uid() = author_id or public.is_admin());


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4) [높음] add_communal_prayer_minutes — 익명 호출로 수치 무한 조작 완화
--    익명 공동기도 기능은 유지하되, 한 번 호출로 더할 수 있는 분(分)에
--    상한(하루치=1440분)을 두어 비정상적인 부풀리기를 제한합니다.
--    ※ 완전한 남용 방지는 Edge Function + 속도 제한이 필요합니다(별도 과제).
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create or replace function public.add_communal_prayer_minutes(p_id uuid, p_minutes integer)
returns setof public.communal_prayers
language sql security definer set search_path = public as $$
  update public.communal_prayers
  set total_minutes = total_minutes + least(greatest(0, p_minutes), 1440)
  where id = p_id
  returning *;
$$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5) [중간] 소통방 사진 업로드 — 그룹 멤버만, 경로의 그룹 id 로 검증
--    경로 형식: chat/<group_id>/<날짜>/<파일>  (클라이언트 코드도 함께 변경)
--    (storage.foldername(name))[2] 가 group_id 입니다.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
drop policy if exists "소통방 사진 업로드" on storage.objects;
create policy "소통방 사진 업로드" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bulletins'
    and name like 'chat/%'
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and public.is_group_member(((storage.foldername(name))[2])::uuid)
  );

-- 업로드한 본인(또는 관리자)만 소통방 사진 삭제
drop policy if exists "소통방 사진 삭제(본인)" on storage.objects;
create policy "소통방 사진 삭제(본인)" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'bulletins'
    and name like 'chat/%'
    and (owner = auth.uid() or public.is_admin())
  );


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 참고) new_families 익명 등록(새가족 신청)은 '기능상 필요'하여 그대로 둡니다.
--   · 조회/삭제는 이미 관리자 전용이라 개인정보 노출은 없습니다.
--   · 스팸(무제한 익명 등록) 방지는 RLS 로는 불가하며, 가입 폼에
--     Cloudflare Turnstile 등 봇 차단 + Edge Function 속도 제한을
--     붙이는 것이 올바른 해법입니다(별도 과제).
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


-- 확인용: 현재 정책 목록
select schemaname, tablename, policyname, cmd
from pg_policies
where tablename in ('push_subscriptions', 'profiles', 'prayer_requests')
order by tablename, policyname;
