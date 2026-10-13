// 교회 소식 새 글 알림 — 관리자가 소식을 올리면, 알림을 켜 둔 모든 성도에게 웹 푸시를 보냅니다.
//
// 클라이언트가 소식을 저장한 뒤 이 함수를 호출합니다:
//   supabase.functions.invoke('notify-announcement', { body: { announcementId } })
//
// 규칙:
//   · 호출자가 '관리자'인지 확인합니다(소식은 관리자만 작성).
//   · 앱에 등록된 모든 구독(기기)에 보냅니다. endpoint 기준으로 중복을 제거합니다.
//   · 죽은 구독(404/410)은 정리합니다.
//
// 필요 시크릿(Edge Functions → Secrets) — 기도/소통방 알림과 동일한 키:
//   VAPID_PUBLIC, VAPID_PRIVATE  (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 는 자동 주입)
// 배포:  Verify JWT 끄고 배포. (본문에서 관리자 여부를 직접 확인합니다.)

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const APP_URL = Deno.env.get('APP_URL') ?? 'https://byunghoonchoi76.github.io/first-repository/';
const CONTACT = Deno.env.get('PUSH_CONTACT') ?? 'mailto:stewardk@hanmail.net';

webpush.setVapidDetails(CONTACT, Deno.env.get('VAPID_PUBLIC')!, Deno.env.get('VAPID_PRIVATE')!);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // 호출자 확인 — 관리자만 전체 알림을 보낼 수 있습니다.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const caller = token ? (await service.auth.getUser(token)).data.user : null;
  if (!caller) return json({ ok: false, error: 'unauthorized' }, 401);
  const { data: profile } = await service.from('profiles').select('role').eq('id', caller.id).maybeSingle();
  if (profile?.role !== 'admin') return json({ ok: false, error: 'forbidden' }, 403);

  let announcementId: string | undefined;
  try {
    ({ announcementId } = await req.json());
  } catch {
    return json({ ok: false, error: 'bad request' }, 400);
  }
  if (!announcementId) return json({ ok: false, error: 'announcementId required' }, 400);

  const { data: ann } = await service
    .from('announcements')
    .select('id, title, category')
    .eq('id', announcementId)
    .maybeSingle();
  if (!ann) return json({ ok: false, error: 'announcement not found' }, 404);

  // 모든 구독(기기) — endpoint 기준 중복 제거
  const { data: subs } = await service.from('push_subscriptions').select('endpoint, p256dh, auth');
  const byEndpoint = new Map<string, { endpoint: string; p256dh: string; auth: string }>();
  for (const s of subs ?? []) if (s.endpoint) byEndpoint.set(s.endpoint, s);
  if (byEndpoint.size === 0) return json({ ok: true, sent: 0, note: '구독 없음' });

  const payload = JSON.stringify({
    title: `교회 소식 · ${ann.category ?? '공지'}`,
    body: String(ann.title ?? '새 소식이 올라왔어요'),
    url: `${APP_URL}news/${ann.id}`,
    tag: `announcement-${ann.id}`,
  });

  let sent = 0;
  let cleaned = 0;
  for (const sub of byEndpoint.values()) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      sent += 1;
    } catch (e) {
      const status = (e as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        await service.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        cleaned += 1;
      }
    }
  }

  return json({ ok: true, sent, cleaned });
});
