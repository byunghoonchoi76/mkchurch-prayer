// 본인 계정 삭제 — 로그인한 이용자가 자신의 계정을 직접 삭제합니다.
//
// 앱에서 호출하면, 호출자의 로그인 토큰으로 "누구인지" 확인한 뒤 바로 그
// 사람(본인)의 계정을 삭제합니다. 다른 사람의 계정은 삭제할 수 없습니다.
// (profiles·group_members·prayer_time·prayer_requests 등은 연쇄 삭제됩니다.)
//
//   supabase.functions.invoke('delete-account')   // 본문 없음
//
// 필요 시크릿: (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 는 자동 주입)
// 배포:  Verify JWT 끄고 배포. (본문에서 호출자 토큰을 직접 검증합니다.)

import { createClient } from 'npm:@supabase/supabase-js@2';

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

  // 1) 호출자 확인 (로그인 토큰) — 토큰이 없거나 유효하지 않으면 거부
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const caller = token ? (await service.auth.getUser(token)).data.user : null;
  if (!caller) return json({ ok: false, error: 'unauthorized' }, 401);

  // 2) 본인 계정 삭제 (auth 사용자 삭제 → profiles 등 연쇄 삭제)
  const del = await service.auth.admin.deleteUser(caller.id);
  if (del.error) return json({ ok: false, error: del.error.message }, 500);

  return json({ ok: true });
});
