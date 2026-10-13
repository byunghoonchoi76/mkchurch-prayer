// 기도 알림 발송 — 매분 스케줄(cron)로 호출됩니다.
// push_subscriptions 에서 "지금(사용자 시간대 기준) 보낼 대상"을 찾아 웹 푸시를 보냅니다.
//
// 필요 시크릿(Edge Functions → Secrets):
//   VAPID_PUBLIC   : 앱에 넣은 것과 같은 공개키
//   VAPID_PRIVATE  : 개인키 (여기 서버에만)
//   (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 는 자동 주입됩니다)
// 배포:  Verify JWT 끄고 배포.  스케줄:  supabase/cron-reminders.sql

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const APP_URL = Deno.env.get('APP_URL') ?? 'https://byunghoonchoi76.github.io/first-repository/';
const CONTACT = Deno.env.get('PUSH_CONTACT') ?? 'mailto:stewardk@hanmail.net';

webpush.setVapidDetails(CONTACT, Deno.env.get('VAPID_PUBLIC')!, Deno.env.get('VAPID_PRIVATE')!);

interface Row {
  endpoint: string;
  slot: number | null;
  p256dh: string;
  auth: string;
  days: number[] | null;
  time_hhmm: string | null;
  tz: string | null;
  last_sent_date: string | null;
}

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** 특정 시간대(tz)의 현재 요일(0~6)·자정부터의 분·날짜(YYYY-MM-DD) */
function nowInTz(tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  let hour = parseInt(get('hour'), 10);
  if (hour === 24) hour = 0;
  return {
    weekday: WD[get('weekday')] ?? 0,
    minutes: hour * 60 + parseInt(get('minute'), 10),
    date: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data, error } = await supabase.from('push_subscriptions').select('*').eq('enabled', true);
  if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });

  const rows = (data ?? []) as Row[];
  let sent = 0;
  let cleaned = 0;

  for (const row of rows) {
    const tz = row.tz || 'Asia/Seoul';
    const now = nowInTz(tz);
    const [th, tm] = (row.time_hhmm || '21:00').split(':').map((x) => parseInt(x, 10));
    const target = th * 60 + tm;
    const days = row.days ?? [];

    const dueNow = days.includes(now.weekday) && now.minutes >= target && now.minutes <= target + 59;
    if (!dueNow || row.last_sent_date === now.date) continue;

    const slot = row.slot ?? 0;

    const payload = JSON.stringify({
      title: '기도할 시간이에요 🙏',
      body: '잠시 멈추고 기도로 하나님과 만나요.',
      url: APP_URL,
    });

    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload);
      // 이 알림(slot)만 '오늘 보냄' 으로 표시합니다. (같은 기기의 다른 알림은 각자 자기 시간에 발송)
      await supabase
        .from('push_subscriptions')
        .update({ last_sent_date: now.date })
        .eq('endpoint', row.endpoint)
        .eq('slot', slot);
      sent += 1;
    } catch (e) {
      const status = (e as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
        cleaned += 1;
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, checked: rows.length, sent, cleaned }), {
    headers: { 'content-type': 'application/json' },
  });
});
