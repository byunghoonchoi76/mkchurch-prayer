// 소통방 새 글 알림 — 성도가 소통방에 글을 올리면, 같은 방의 다른 멤버에게 웹 푸시를 보냅니다.
//
// 클라이언트가 메시지를 저장한 뒤 이 함수를 호출합니다:
//   supabase.functions.invoke('notify-group', { body: { messageId } })
//
// 규칙:
//   · 그 방의 멤버 중, 개인 알림(notify)이 켜져 있고, 글쓴이 본인이 아닌 사람에게만 보냅니다.
//   · 한 사람이 여러 기기(구독)를 가질 수 있어 endpoint 기준으로 중복을 제거합니다.
//   · 죽은 구독(404/410)은 정리합니다.
//
// 필요 시크릿(Edge Functions → Secrets) — 기도 알림과 동일한 키를 씁니다:
//   VAPID_PUBLIC, VAPID_PRIVATE  (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 는 자동 주입)
// 배포:  Verify JWT 끄고 배포. (본문에서 작성자 본인 여부를 직접 확인합니다.)

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

  // 호출자(작성자) 확인 — 헤더의 로그인 토큰으로 본인만 자기 글 알림을 보낼 수 있게 합니다.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const caller = token ? (await service.auth.getUser(token)).data.user : null;
  if (!caller) return json({ ok: false, error: 'unauthorized' }, 401);

  let messageId: string | undefined;
  try {
    ({ messageId } = await req.json());
  } catch {
    return json({ ok: false, error: 'bad request' }, 400);
  }
  if (!messageId) return json({ ok: false, error: 'messageId required' }, 400);

  // 메시지 + 방 정보
  const { data: msg } = await service
    .from('group_messages')
    .select('id, group_id, author, author_id, body, image_url')
    .eq('id', messageId)
    .maybeSingle();
  if (!msg) return json({ ok: false, error: 'message not found' }, 404);
  if (msg.author_id && msg.author_id !== caller.id) return json({ ok: false, error: 'forbidden' }, 403);

  const { data: group } = await service.from('small_groups').select('name').eq('id', msg.group_id).maybeSingle();
  const groupName = group?.name ?? '소통방';

  // 알림 받을 멤버(작성자 제외, notify=true)
  const { data: members } = await service
    .from('group_members')
    .select('user_id')
    .eq('group_id', msg.group_id)
    .eq('notify', true)
    .neq('user_id', msg.author_id);
  const userIds = (members ?? []).map((m) => m.user_id).filter(Boolean);
  if (userIds.length === 0) return json({ ok: true, sent: 0, note: '받을 멤버 없음' });

  // 멤버들의 구독(기기) — endpoint 기준 중복 제거
  const { data: subs } = await service
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', userIds);
  const byEndpoint = new Map<string, { endpoint: string; p256dh: string; auth: string }>();
  for (const s of subs ?? []) if (s.endpoint) byEndpoint.set(s.endpoint, s);

  const text = String(msg.body ?? '').trim();
  const preview = text ? text.slice(0, 120) : msg.image_url ? '📷 사진' : '';
  const payload = JSON.stringify({
    title: groupName,
    body: `${msg.author ?? '성도'}: ${preview}`,
    url: `${APP_URL}groups/${msg.group_id}`,
    tag: `group-${msg.group_id}`,
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
