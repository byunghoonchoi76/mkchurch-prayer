-- 기도제목 읽기를 '로그인한 성도만' 으로 바꿉니다.
-- 이미 schema.sql 을 실행한 프로젝트에서 이 부분만 다시 적용할 때 쓰세요.
-- (schema.sql 전체를 다시 실행해도 같은 결과입니다.)

drop policy if exists "기도제목 조회" on public.prayer_requests;
create policy "기도제목 조회" on public.prayer_requests
  for select using (auth.uid() is not null);

-- 확인용
select polname, polcmd from pg_policy
where polrelid = 'public.prayer_requests'::regclass;
