-- 기도 배경음(mp3) 공개 스토리지 버킷 만들기
-- 실행: Supabase 대시보드 > SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.
--
-- 실행 후: Storage > prayer-bgm 버킷에 mp3 파일을 업로드하세요.
--   파일 이름을 prayer-1.mp3, prayer-2.mp3 로 하면 앱에 이미 연결돼 있어 바로 재생됩니다.
--   (곡을 더 넣고 싶으면 파일명을 알려 주세요. 앱 목록에 추가합니다.)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'prayer-bgm',
  'prayer-bgm',
  true,                                   -- 공개 버킷: /object/public/... 주소로 누구나 들을 수 있음
  52428800,                               -- 파일당 최대 50MB (긴 찬양·높은 음질도 넉넉)
  array['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- (이미 버킷을 만든 뒤 용량 제한만 올리려면 아래 한 줄만 실행해도 됩니다.)
-- update storage.buckets set file_size_limit = 52428800 where id = 'prayer-bgm';

-- ⚠️ 파일 이름은 반드시 소문자 .mp3 로 저장하세요 (스토리지는 대소문자를 구분합니다).
--    앱은 prayer-1.mp3 · prayer-2.mp3 를 찾으므로, prayer-1.MP3 처럼 대문자면 재생되지 않습니다.

-- 공개 버킷이라 읽기는 별도 정책 없이 공개 URL 로 가능합니다.
-- (대시보드에서 올리는 업로드는 관리자 권한이라 정책 없이도 됩니다.)
