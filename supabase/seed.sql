-- 구리 목양교회 앱 초기 데이터
-- schema.sql 을 먼저 실행한 뒤, Supabase 대시보드 > SQL Editor 에서 실행하세요.
--
-- 각 블록은 "표가 비어 있을 때만" 넣기 때문에 여러 번 실행해도 데이터가 중복되지 않습니다.
-- 이미 내용을 등록한 뒤라면 그 표는 건너뜁니다.

-- ─────────────────────────────────────────────
-- 교회 정보
-- ─────────────────────────────────────────────
insert into public.church_profile (id, name, slogan, slogan_verse, pastor, address, phone, email, offering_account, youtube_url)
values (
  1,
  '구리 목양교회',
  '두려워하지 말라, 강하고 담대하라',
  '신 31:6, 수 1:9',
  '공진수 담임목사',
  '경기도 구리시 장자호수길 67',
  '031-551-1004',
  'stewardk@hanmail.net',
  '농협 382-01-017978',
  'https://www.youtube.com/@mychmedia'
)
on conflict (id) do update set
  name = excluded.name,
  slogan = excluded.slogan,
  slogan_verse = excluded.slogan_verse,
  pastor = excluded.pastor,
  address = excluded.address,
  phone = excluded.phone,
  email = excluded.email,
  offering_account = excluded.offering_account,
  youtube_url = excluded.youtube_url;

-- ─────────────────────────────────────────────
-- 예배 시간
-- ─────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from public.service_times) then
    insert into public.service_times (name, schedule, place, note, category, sort_order) values
      ('새벽예배', '월~금 오전 5:30', '본당(3층)', null, '예배', 1),
      ('주일예배 1부', '주일 오전 7:30', '본당(3층)', null, '예배', 2),
      ('주일예배 2부', '주일 오전 9:30', '본당(3층)', null, '예배', 3),
      ('주일예배 3부', '주일 오전 11:30', '본당(3층)', null, '예배', 4),
      ('주일예배 4부', '주일 오후 2:00', '본당(3층)', null, '예배', 5),
      ('저녁 찬양예배', '주일 오후 5:00', '본당(3층)', '첫째 주는 가정예배', '예배', 6),
      ('목양바이블아카데미(MBA)', '수요일 오전 10:30', '본당(3층)', null, '예배', 7),
      ('수요부흥예배', '수요일 오후 7:30', '본당(3층)', null, '예배', 8),
      ('금요성령집회', '금요일 오후 8:00', '본당(3층)', null, '예배', 9),
      ('영유아부 (0~4세)', '주일 오전 11:30', '다윗홀(4층)', null, '교육부서', 11),
      ('유치부 (5~7세)', '주일 오전 9:30', '샬롬홀(2층)', null, '교육부서', 12),
      ('초등부 (초등 1~3학년)', '주일 오전 9:30', '드림홀(지하1층)', null, '교육부서', 13),
      ('소년부 (초등 4~6학년)', '주일 오전 11:30', '비전홀(2층)', null, '교육부서', 14),
      ('어와나 (초등 1~6학년)', '주일 오후 2:00', '비전홀(2층)', null, '교육부서', 15),
      ('중등부', '주일 오전 11:30', '여호수아홀(지하1층)', null, '교육부서', 16),
      ('고등부', '주일 오전 9:30', '여호수아홀(지하1층)', null, '교육부서', 17),
      ('청년부', '주일 오후 2:00', '본당(3층)', null, '교육부서', 18);
  end if;
end;
$$;

-- ─────────────────────────────────────────────
-- 주보 (2026년 8월 30일 주보)
-- ─────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from public.bulletins) then
    insert into public.bulletins
      (service_date, title, sermon_title, preacher, scripture, weekly_verse, order_items, notices, image_urls)
    values (
      date '2026-08-30',
      '주일 예배 주보 (제43권 35호)',
      '예수님을 사랑한다는 증거',
      '공진수 목사',
      '요한복음 14:20-21 (신약 172쪽)',
      '두려워하지 말라, 강하고 담대하라 (신 31:6, 수 1:9)',
      '[{"title":"예배의 부름","detail":"인도자"},
        {"title":"신앙고백","detail":"사도신경 / 다같이"},
        {"title":"경배와 찬양","detail":"«임재» 찬 370장(통 455장) / 다같이"},
        {"title":"기도","detail":"1부 이경재 장로 · 2부 최희병 안수집사 · 3부 최환준 장로"},
        {"title":"성도의 교제","detail":"«평화 하나님의 평강이»"},
        {"title":"성경봉독","detail":"요한복음 14:20-21 (신약 172쪽)"},
        {"title":"찬양대 찬양","detail":"2부 «임하소서(주님의 성령)» 그레이스 2부 찬양대 · 3부 «거룩한 성» 그레이스 3부 찬양대"},
        {"title":"말씀","detail":"«예수님을 사랑한다는 증거» / 공진수 목사"},
        {"title":"봉헌 찬양","detail":"«약할 때 강함 되시네» / 다같이"},
        {"title":"봉헌 및 봉헌기도","detail":"공진수 목사"},
        {"title":"축도","detail":"공진수 목사"}]'::jsonb,
      '["오늘은 8월 다섯 번째 주일입니다. 무더운 8월 한 달 동안 믿음의 경주를 달려오신 모든 성도님들을 축복하며 환영합니다.",
        "오늘 오후 찬양예배는 청년부 및 교회학교 여름행사 보고 예배로 드립니다.",
        "금요성령집회는 이번 주까지 자율기도회로 드리며, 다음 주부터 현장 예배가 시작됩니다.",
        "정기당회가 오늘 오후 1시 당회실에서 있습니다.",
        "새가족 등록 4주 과정이 매주 주일 오전 10:45~11:15 이레홀(2층)에서 진행됩니다."]'::jsonb,
      -- 홈페이지에 올린 주보 이미지 주소를 넣으면 앱에서 원본을 그대로 볼 수 있습니다.
      '[]'::jsonb
    );
  end if;
end;
$$;

-- ─────────────────────────────────────────────
-- 공지사항
-- ─────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from public.announcements) then
    insert into public.announcements (title, body, category, author, pinned) values
      ('새가족 환영회 안내', '주일 2부 예배 후 2층 사랑방에서 새가족 환영회가 있습니다. 등록하신 지 3개월 이내의 새가족은 모두 참석해 주시기 바랍니다.', '공지', '새가족부', true),
      ('베트남 아웃리치 중보기도 요청', '8월 31일부터 9월 5일까지 베트남 호치민에서 현지 목회자 60쌍을 대상으로 목회자 부부 세미나가 진행됩니다. 아웃리치 팀과 참석하는 목회자 부부들을 위해 기도해 주세요.', '소식', '선교부', true),
      ('성전 청소 안내', '9월 5일과 12일 성전 청소가 있습니다. 해당 교구는 확인해 주시기 바랍니다.', '공지', '관리부', false);
  end if;
end;
$$;

-- ─────────────────────────────────────────────
-- 설교
-- ─────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from public.sermons) then
    insert into public.sermons (title, preacher, scripture, preached_on, series, media_type, media_url, summary) values
      ('예수님을 사랑한다는 증거', '공진수 목사', '요한복음 14:20-21', date '2026-08-30', '주일예배', 'video',
       'https://www.youtube.com/watch?v=kvwuN6-2PAk',
       '성령이 임하실 때 우리가 예수님 안에, 예수님이 우리 안에 거하십니다. 예수님을 사랑하는 증거는 그 말씀과 계명을 지키는 것입니다.'),
      -- 제목을 비워 두면 앱이 유튜브에서 실제 제목을 가져옵니다.
      ('', '공진수 목사', '', date '2026-08-30', null, 'video',
       'https://www.youtube.com/shorts/AC6BLtHogV0', ''),
      ('여호와께서 영원무궁 하도록 다스리도다', '엄동식 목사', '출애굽기 15:13-21', date '2026-08-30', '주일 4부예배', 'video',
       'https://www.youtube.com/@mychmedia', ''),
      ('어린아이들이 내게 오는 것을 용납하고 금하지 말라', '노준성 목사', '마가복음 10:13-16', date '2026-08-30', '주일 찬양예배', 'video',
       'https://www.youtube.com/@mychmedia', ''),
      ('사랑하는 아들을 보내셨다', '김호진 목사', '누가복음 20:9-18', date '2026-08-26', '수요부흥예배', 'video',
       'https://www.youtube.com/@mychmedia', ''),
      -- 제목을 비워 두면 앱이 유튜브에서 실제 제목을 가져옵니다.
      ('', '공진수 목사', '', date '2026-08-28', '금요성령집회', 'video',
       'https://www.youtube.com/watch?v=-cNkZs0UXK8', '');
  end if;
end;
$$;

-- ─────────────────────────────────────────────
-- 기도제목 (예시 — 실제 운영 시 지우고 시작하셔도 됩니다)
-- ─────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from public.prayer_requests) then
    insert into public.prayer_requests (title, body, author, anonymous, pray_count) values
      ('어머니 수술을 앞두고 기도 부탁드립니다', '다음 주 화요일 수술이 있습니다. 회복을 위해 함께 기도해 주세요.', '박소영', false, 24),
      ('진로를 놓고 지혜를 구합니다', '이직을 두고 고민 중입니다. 하나님의 뜻을 분별하도록 기도 부탁드려요.', '익명', true, 12);
  end if;
end;
$$;

-- ─────────────────────────────────────────────
-- 섬기는 사람들 (교역자·직분자) — 실제 명단으로 채워 주세요
-- ─────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from public.church_staff) then
    insert into public.church_staff (name, category, role, detail, sort_order) values
      ('공진수', '목사', '담임목사', '', 1);
  end if;
end;
$$;

-- ─────────────────────────────────────────────
-- 소그룹과 소통방
-- ─────────────────────────────────────────────
do $$
declare
  youth_id uuid;
begin
  if not exists (select 1 from public.small_groups) then
    insert into public.small_groups (name, leader, meeting_info, description, member_count) values
      ('청년부 · 반석', '한지훈 리더', '매주 금요일 오후 8시 · 교육관 2층', '20~30대 청년들이 말씀과 삶을 나누는 모임입니다.', 14),
      ('주부 목장 · 뜰안', '오정민 권사', '매주 화요일 오전 10시 · 2층 사랑방', '자녀 양육과 일상의 고민을 함께 나눕니다.', 9),
      ('장년 성경공부 · 새벽별', '서동원 장로', '매주 수요일 예배 후 · 소예배실', '성경을 통독하며 깊이 묵상하는 모임입니다.', 21);

    select id into youth_id from public.small_groups where name = '청년부 · 반석';

    insert into public.group_messages (group_id, author, body) values
      (youth_id, '한지훈 리더', '이번 주 금요일 모임은 교육관 2층에서 8시에 모입니다. 요한복음 14장 읽고 오세요!');
  end if;
end;
$$;

-- ─────────────────────────────────────────────
-- 관리자 지정 (가입한 뒤 이메일을 바꿔 실행하세요)
-- ─────────────────────────────────────────────
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'admin@example.com');
