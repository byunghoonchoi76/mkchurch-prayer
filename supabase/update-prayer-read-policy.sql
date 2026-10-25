-- 기도제목 읽기 정책 — 비공개(shared=false)는 작성자 본인과 관리자만.
--
-- ⚠️ 예전 버전은 'auth.uid() is not null'(로그인하면 전부 조회)로 되어 있어
--    개인 기도제목(shared=false)이 모든 성도에게 노출됐습니다. 아래로 교체하세요.
-- 이미 schema.sql 을 실행한 프로젝트에서 이 부분만 다시 적용할 때 쓰세요.
-- (schema.sql 전체를 다시 실행해도 같은 결과입니다.)

drop policy if exists "기도제목 조회" on public.prayer_requests;
create policy "기도제목 조회" on public.prayer_requests
  for select using (shared or auth.uid() = author_id or public.is_admin());

-- 확인용
select polname, polcmd from pg_policy
where polrelid = 'public.prayer_requests'::regclass;
