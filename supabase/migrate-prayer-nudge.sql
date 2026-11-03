-- 기도 타이머 '넛지'(일회성 예약 푸시) — 아멘을 깜빡하고 앱을 닫아 둬도
-- 잠시 뒤 휴대폰으로 "열어 둔 기도를 마무리하세요" 알림이 오도록 하는 기능.
--
-- 구성: 예약 테이블(prayer_nudges) 1개 + 예약/취소 RPC 2개.
-- 발송: send-reminders Edge Function 이 매분 돌며 예약 시각이 지난 넛지를 한 번 보내고 지웁니다.
--       (이 SQL 실행 후, send-reminders 함수도 새 버전으로 다시 배포해야 발송됩니다.)
--
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.

create table if not exists public.prayer_nudges (
  endpoint text primary key,          -- 이 기기의 푸시 구독 endpoint (push_subscriptions 와 같은 값)
  fire_at timestamptz not null,       -- 이 시각이 지나면 보냅니다
  body text not null default '',      -- 알림 본문
  created_at timestamptz not null default now()
);

-- 예약을 빨리 찾기 위한 인덱스
create index if not exists prayer_nudges_fire_at_idx on public.prayer_nudges (fire_at);

-- REST 직접 접근은 막고, 아래 security definer RPC 와 service_role(함수)만 접근하도록.
alter table public.prayer_nudges enable row level security;
revoke all on public.prayer_nudges from anon, authenticated;

-- 예약(있으면 덮어씀): 한 기기는 '진행 중인 기도' 넛지를 하나만 가집니다.
create or replace function public.prayer_nudge_set(p_endpoint text, p_fire_at timestamptz, p_body text)
returns void language sql security definer set search_path = public as $$
  insert into public.prayer_nudges (endpoint, fire_at, body)
  values (p_endpoint, p_fire_at, coalesce(p_body, ''))
  on conflict (endpoint) do update
    set fire_at = excluded.fire_at, body = excluded.body, created_at = now();
$$;
grant execute on function public.prayer_nudge_set(text, timestamptz, text) to anon, authenticated;

-- 취소: 아멘으로 마치거나 목표 달성 안내를 본 경우 예약을 지웁니다.
create or replace function public.prayer_nudge_clear(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.prayer_nudges where endpoint = p_endpoint;
$$;
grant execute on function public.prayer_nudge_clear(text) to anon, authenticated;
