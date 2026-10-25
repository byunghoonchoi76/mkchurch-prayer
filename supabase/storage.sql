-- ─────────────────────────────────────────────
-- 주보 이미지 저장소 (Supabase Storage)
-- ─────────────────────────────────────────────
-- schema.sql 을 먼저 실행한 뒤, SQL Editor 에서 이 파일을 실행하세요.
-- 관리자가 앱에서 주보 사진을 바로 올릴 수 있게 됩니다.
--
-- 대시보드에서 만들려면: Storage → New bucket → 이름 'bulletins', Public 켜기.
-- 그 경우에도 아래 정책 부분은 실행해야 관리자만 올릴 수 있습니다.

-- 공개 읽기 버킷 만들기 (이미 있으면 그대로 둡니다)
insert into storage.buckets (id, name, public)
values ('bulletins', 'bulletins', true)
on conflict (id) do update set public = true;

-- 누구나 볼 수 있고, 올리고 지우는 것은 관리자만
drop policy if exists "주보 이미지 공개 조회" on storage.objects;
create policy "주보 이미지 공개 조회" on storage.objects
  for select using (bucket_id = 'bulletins');

drop policy if exists "주보 이미지 관리자 업로드" on storage.objects;
create policy "주보 이미지 관리자 업로드" on storage.objects
  for insert with check (bucket_id = 'bulletins' and public.is_admin());

drop policy if exists "주보 이미지 관리자 수정" on storage.objects;
create policy "주보 이미지 관리자 수정" on storage.objects
  for update using (bucket_id = 'bulletins' and public.is_admin());

drop policy if exists "주보 이미지 관리자 삭제" on storage.objects;
create policy "주보 이미지 관리자 삭제" on storage.objects
  for delete using (bucket_id = 'bulletins' and public.is_admin());

-- 소통방 사진 업로드 — 경로 chat/<group_id>/... 의 '그 방 멤버'만 올릴 수 있습니다.
-- (storage.foldername(name))[2] 가 group_id. 클라이언트는 반드시 그룹 id 를 경로에 넣어야 합니다.
drop policy if exists "소통방 사진 업로드" on storage.objects;
create policy "소통방 사진 업로드" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bulletins'
    and name like 'chat/%'
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and public.is_group_member(((storage.foldername(name))[2])::uuid)
  );

-- 메시지 삭제 시 올린 본인(또는 관리자)의 소통방 사진도 저장소에서 함께 삭제
drop policy if exists "소통방 사진 삭제(본인)" on storage.objects;
create policy "소통방 사진 삭제(본인)" on storage.objects
  for delete to authenticated
  using (bucket_id = 'bulletins' and name like 'chat/%' and (owner = auth.uid() or public.is_admin()));

-- 확인용: 버킷이 잘 만들어졌는지
select id, name, public from storage.buckets where id = 'bulletins';
