-- 교회 정확 위치(네이버 플레이스) 링크를 설정합니다.
-- map_url 컬럼이 없으면 먼저 만들고(안전), 값을 넣습니다.
alter table public.church_profile add column if not exists map_url text not null default '';

update public.church_profile
set map_url = 'https://naver.me/5CCocDC6'
where id = 1;

select name, address, map_url from public.church_profile where id = 1;
