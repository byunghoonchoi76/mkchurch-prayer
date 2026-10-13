-- 사진 첨부 기능 — 교회 소식 포스터(최대 2장) + 소통방 메시지 사진.
-- Supabase SQL Editor 에 붙여넣고 Run 하세요. 여러 번 실행해도 안전(idempotent)합니다.
-- 사진 파일은 기존 'bulletins' 저장소 버킷을 함께 사용하므로 별도 버킷 설정은 필요 없습니다.
-- (아직 storage.sql 을 실행하지 않았다면 먼저 실행해 주세요.)

-- 교회 소식 포스터 사진 주소 (최대 2장)
alter table public.announcements add column if not exists images text[] not null default '{}';

-- 소통방 메시지 첨부 사진 주소
alter table public.group_messages add column if not exists image_url text;
