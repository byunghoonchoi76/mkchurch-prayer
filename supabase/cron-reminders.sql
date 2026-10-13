-- ────────────────────────────────────────────────────────────
-- 기도 알림 스케줄 — send-reminders 함수를 매분 호출합니다.
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (아래 두 값만 바꾸면 됩니다)
--   <PROJECT_REF>          : 프로젝트 참조 (예: jwfbmsmasgmbstjizfab)
--   <ANON_OR_SERVICE_KEY>  : 프로젝트 anon 키 (Project Settings → API)
-- ────────────────────────────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 기존 스케줄이 있으면 정리 후 다시 등록 (여러 번 실행해도 안전)
select cron.unschedule('send-reminders-every-minute')
where exists (select 1 from cron.job where jobname = 'send-reminders-every-minute');

select cron.schedule(
  'send-reminders-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_OR_SERVICE_KEY>'),
    body := '{}'::jsonb
  );
  $$
);

-- 해제하려면:
--   select cron.unschedule('send-reminders-every-minute');
