-- ════════════════════════════════════════════════════════════════════
-- 보안 수정 2차 (Strix 재점검에서 드러난 기존 정책 허점)
-- 운영 Supabase SQL Editor 에서 한 번 실행하세요. 멱등(여러 번 실행해도 안전).
-- ════════════════════════════════════════════════════════════════════

-- ── 1) prayer_requests 작성: author_id 를 본인으로 강제 (작성자 사칭 차단) ──
drop policy if exists "기도제목 작성" on public.prayer_requests;
create policy "기도제목 작성" on public.prayer_requests
  for insert with check (auth.uid() = author_id);

-- ── 2) prayer_requests 수정: WITH CHECK 추가 (수정 후 author_id 재지정 차단) ──
drop policy if exists "기도제목 수정" on public.prayer_requests;
create policy "기도제목 수정" on public.prayer_requests
  for update using (auth.uid() = author_id or public.is_admin())
  with check (auth.uid() = author_id or public.is_admin());

-- ── 3) add_prayer_time: 1회 입력 분(分) 상한 1440 (개인 기도시간 부풀리기 차단) ──
create or replace function public.add_prayer_time(p_date date, p_kind text, p_minutes integer)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.prayer_time (user_id, date, kind, minutes)
  values (auth.uid(), p_date, p_kind, least(greatest(0, p_minutes), 1440))
  on conflict (user_id, date, kind)
  do update set minutes = public.prayer_time.minutes + least(greatest(0, p_minutes), 1440);
$$;

-- ── 4) increment_pray_count: 로그인 전용 + 볼 수 있는 글만 (익명 호출·비공개 노출 차단) ──
create or replace function public.increment_pray_count(request_id uuid)
returns setof public.prayer_requests
language sql
security definer
set search_path = public
as $$
  update public.prayer_requests
  set pray_count = pray_count + 1
  where id = request_id
    and (shared or author_id = auth.uid() or public.is_admin())
  returning *;
$$;
revoke all on function public.increment_pray_count(uuid) from public;
grant execute on function public.increment_pray_count(uuid) to authenticated;

-- 확인용
select polname, polcmd from pg_policy where polrelid = 'public.prayer_requests'::regclass;
