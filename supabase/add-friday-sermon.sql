-- 금요성령집회 설교 한 편을 추가합니다.
-- 제목을 비워 두면 앱이 유튜브에서 실제 제목을 자동으로 가져옵니다.
-- 설교자·날짜가 다르면 아래 값을 고치거나, 앱의 관리자 화면에서 수정하세요.

insert into public.sermons (title, preacher, scripture, preached_on, series, media_type, media_url, summary)
values (
  '',                       -- 제목: 비워 두면 유튜브 제목 자동
  '공진수 목사',            -- 설교자 (다르면 수정)
  '',                       -- 본문 (있으면 입력)
  date '2026-08-28',        -- 설교 날짜 (해당 금요일로 수정)
  '금요성령집회',
  'video',
  'https://www.youtube.com/watch?v=-cNkZs0UXK8',
  ''                        -- 요약 (선택)
)
returning id, series, media_url;
