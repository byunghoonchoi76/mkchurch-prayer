-- 관리자 대시보드용: 성도별 기도시간 집계 (관리자 전용)
--
-- 개인 기도시간(prayer_time)은 보안상 본인 것만 읽을 수 있어서, 관리자가 전체를 보려면
-- 이 SECURITY DEFINER 함수가 필요합니다. is_admin() 이 아닌 사람이 부르면 빈 결과를 돌려줍니다.
--
-- p_today: 호출하는 앱(사용자 시간대)의 '오늘' 날짜(YYYY-MM-DD). 기도 기록 날짜가 사용자
--          시간대 기준으로 저장되므로, '오늘'·'최근 7일' 판정을 이 값 기준으로 맞춥니다.
--
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.

create or replace function public.admin_member_prayer_stats(p_today date)
returns table (
  user_id uuid,
  name text,
  total_sec bigint,
  week_sec bigint,
  today_sec bigint,
  last_prayed date
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    coalesce(p.name, '성도'),
    coalesce(sum(pt.minutes), 0)::bigint,
    coalesce(sum(pt.minutes) filter (where pt.date >= p_today - 6), 0)::bigint,
    coalesce(sum(pt.minutes) filter (where pt.date = p_today), 0)::bigint,
    max(pt.date)
  from public.profiles p
  left join public.prayer_time pt on pt.user_id = p.id
  where public.is_admin()        -- 관리자만 결과를 받습니다(그 외에는 0행)
  group by p.id, p.name;
$$;

grant execute on function public.admin_member_prayer_stats(date) to authenticated;
