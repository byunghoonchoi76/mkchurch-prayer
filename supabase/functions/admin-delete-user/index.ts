// 가입자(계정) 삭제 — 관리자만 실행할 수 있습니다.
//
// 앱에서 관리자가 호출하면, 호출자가 정말 관리자인지 서버에서 확인한 뒤
// 해당 계정을 삭제합니다. (profiles·group_members·prayer_time 등은 연쇄 삭제됩니다.)
//
//   supabase.functions.invoke('admin-delete-user', { body: { userId } })
//
// 필요 시크릿: (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 는 자동 주입)
// 배포:  Verify JWT 끄고 배포. (본문에서 호출자의 관리자 여부를 직접 확인합니다.)

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

  // 1) 호출자 확인 (로그인 토큰)
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const caller = token ? (await service.auth.getUser(token)).data.user : null;
  if (!caller) return json({ ok: false, error: 'unauthorized' }, 401);

  // 2) 호출자가 관리자인지 확인
  const me = await service.from('profiles').select('role').eq('id', caller.id).maybeSingle();
  if (me.error || me.data?.role !== 'admin') return json({ ok: false, error: 'forbidden' }, 403);

  // 3) 대상 확인
  let userId: string | undefined;
  try {
    ({ userId } = await req.json());
  } catch {
    return json({ ok: false, error: 'bad request' }, 400);
  }
  if (!userId) return json({ ok: false, error: 'userId required' }, 400);
  if (userId === caller.id) return json({ ok: false, error: '본인 계정은 삭제할 수 없습니다.' }, 400);

  // 4) 삭제 (auth 사용자 삭제 → profiles 등 연쇄 삭제)
  const del = await service.auth.admin.deleteUser(userId);
  if (del.error) return json({ ok: false, error: del.error.message }, 500);

  return json({ ok: true });
});
