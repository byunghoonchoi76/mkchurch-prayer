-- 소통방 사진 업로드 허용 — 로그인한 멤버가 소통방(chat/) 사진을 올릴 수 있게 합니다.
-- 기존 'bulletins' 버킷은 '관리자만 업로드'라 멤버의 소통방 사진이 막혀 있었습니다.
-- Supabase SQL Editor 에 붙여넣고 Run 하세요. 여러 번 실행해도 안전(idempotent)합니다.
-- (storage.sql 을 아직 실행하지 않았다면 그 파일을 먼저 실행해 주세요.)

-- 안전장치: 메시지 사진 컬럼이 없으면 추가(이미 있으면 무시)
alter table public.group_messages add column if not exists image_url text;

-- 소통방 사진(경로가 chat/ 로 시작)은 로그인한 사용자 누구나 업로드 가능
drop policy if exists "소통방 사진 업로드" on storage.objects;
create policy "소통방 사진 업로드" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'bulletins' and name like 'chat/%');

-- 메시지를 지우면 올린 본인의 소통방 사진도 저장소에서 함께 삭제되도록 허용
drop policy if exists "소통방 사진 삭제(본인)" on storage.objects;
create policy "소통방 사진 삭제(본인)" on storage.objects
  for delete to authenticated
  using (bucket_id = 'bulletins' and name like 'chat/%' and owner = auth.uid());

-- 조회(공개 읽기)는 기존 '주보 이미지 공개 조회' 정책이 bulletins 버킷 전체를 이미 허용하므로 추가 설정이 필요 없습니다.
