-- 기도제목에 '상태(기도중·응답됨·종료)'와 '분류(카테고리)'를 추가합니다.
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. 여러 번 실행해도 안전합니다.

-- 1) 상태 컬럼 (기도중 / 응답됨 / 종료)
alter table public.prayer_requests
  add column if not exists status text not null default '기도중';

-- 2) 분류 컬럼 (신앙 / 가족 / 감사 / 건강 / 교회 / 기타)
alter table public.prayer_requests
  add column if not exists category text not null default '기타';

-- 3) 기존에 '응답됨(answered=true)'으로 표시된 기도제목을 상태에도 반영합니다.
update public.prayer_requests
  set status = '응답됨'
  where answered = true and status = '기도중';

-- (선택) 허용되지 않은 값이 들어오지 않도록 체크 제약을 둡니다.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'prayer_requests_status_check'
  ) then
    alter table public.prayer_requests
      add constraint prayer_requests_status_check
      check (status in ('기도중', '응답됨', '종료'));
  end if;
end $$;
