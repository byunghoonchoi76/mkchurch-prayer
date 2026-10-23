-- 온 성도가 함께 드린 기도시간(초) 집계 함수
--
-- 기도하기 홈 화면의 '온 성도가 함께 드린 기도'에 쓰입니다.
-- prayer_time 테이블은 RLS 로 본인 행만 읽을 수 있으므로, 전체 합계는
-- SECURITY DEFINER 함수로만 구합니다. (개별 행이 아니라 '합계'만 돌려주므로 안전합니다.)
--
-- 반환값: 모든 성도의 개인·공동 기도시간 합(초). 단위는 과거 호환으로 컬럼명이
--         minutes / total_minutes 지만 실제 저장 단위는 '초'입니다.
--
-- Supabase SQL Editor 에 붙여 넣어 한 번 실행하면 됩니다.

create or replace function public.church_prayer_total_seconds()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select sum(minutes) from public.prayer_time), 0)
    + coalesce((select sum(total_minutes) from public.communal_prayers), 0);
$$;

-- 로그인 전(anon)·로그인 후(authenticated) 모두 '합계'만 읽을 수 있게 허용합니다.
grant execute on function public.church_prayer_total_seconds() to anon, authenticated;
