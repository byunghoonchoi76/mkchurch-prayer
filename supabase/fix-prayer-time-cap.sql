-- 기도시간이 24분에서 잘리던 버그 수정 (중요)
--
-- 증상: 25분 이상 기도해도 '오늘 기도'·'이번 주'·달력·통계에는 24분까지만 저장됨.
--       (결과 모달의 '오늘 1시간 51분' 같은 값은 클라이언트의 실제값이고,
--        서버에는 24분(=1440초)만 저장되어 홈/기록과 어긋났습니다.)
--
-- 원인: 보안 패치에서 1회 입력 상한을 1440 으로 두었는데,
--       prayer_time.minutes / communal_prayers.total_minutes 의 저장 단위는 '초'입니다.
--       1440 은 '분' 기준으로 의도된 값(=24시간)이지만, 초 단위에서는 1440초 = 24분이라
--       한 번의 기도가 24분을 넘으면 24분으로 잘렸습니다.
--
-- 조치: 상한을 86400 초(= 24시간)로 바로잡습니다. (부풀리기 방지 기능은 그대로 유지)
--
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.
-- 참고: 이미 24분으로 잘려 '저장된' 과거 기록은 복구되지 않습니다. 실행 이후부터 정상 집계됩니다.

-- 1) 개인 기도시간 누적 함수
create or replace function public.add_prayer_time(p_date date, p_kind text, p_minutes integer)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.prayer_time (user_id, date, kind, minutes)
  values (auth.uid(), p_date, p_kind, least(greatest(0, p_minutes), 86400))
  on conflict (user_id, date, kind)
  do update set minutes = public.prayer_time.minutes + least(greatest(0, p_minutes), 86400);
$$;
grant execute on function public.add_prayer_time(date, text, integer) to authenticated;

-- 2) 공동 기도제목 누적 함수(같은 상한 버그가 있어 함께 수정)
create or replace function public.add_communal_prayer_minutes(p_id uuid, p_minutes integer)
returns setof public.communal_prayers
language sql
security definer
set search_path = public
as $$
  update public.communal_prayers
  set total_minutes = total_minutes + least(greatest(0, p_minutes), 86400)
  where id = p_id
  returning *;
$$;
grant execute on function public.add_communal_prayer_minutes(uuid, integer) to anon, authenticated;
