-- 기도시간 저장 단위: '분' → '초' 전환 (1회용, 여러 번 실행해도 안전)
--
-- 배경: 기도 타이머를 초 단위로 정확히 기록하려고, 앱과 DB가 다루는
--       기도시간의 단위를 '분'에서 '초'로 바꿉니다. 컬럼 이름(minutes,
--       total_minutes)은 그대로 두고, 담기는 값만 '초'가 됩니다.
--       (add_prayer_time / add_communal_prayer_minutes 함수는 정수를 더하기만
--        하므로 그대로 두어도 됩니다. 목표 컬럼 communal_goal_minutes 는 '분'
--        그대로입니다.)
--
-- 안전장치: app_settings.prayer_time_unit_seconds 플래그로 이미 환산했는지
--           표시합니다. 이 스크립트를 여러 번 실행해도 딱 한 번만 ×60 됩니다.
--
-- 실행: Supabase SQL Editor 에 붙여넣고 실행하세요. (한 번만 눌러도, 실수로
--       여러 번 눌러도 결과는 같습니다.)

alter table public.app_settings
  add column if not exists prayer_time_unit_seconds boolean not null default false;

do $$
begin
  if not coalesce((select prayer_time_unit_seconds from public.app_settings where id = 1), false) then
    -- 개인 기도시간: 분 → 초
    update public.prayer_time set minutes = minutes * 60;
    -- 공동 기도 누적: 분 → 초
    update public.communal_prayers set total_minutes = total_minutes * 60;
    -- 환산 완료 표시
    update public.app_settings set prayer_time_unit_seconds = true where id = 1;
  end if;
end $$;
