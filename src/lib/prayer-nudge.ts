import { Platform } from 'react-native';

import { hasSupabaseConfig, supabase } from '@/lib/supabase';
import { urlBase64ToUint8Array, VAPID_PUBLIC_KEY } from '@/lib/reminders';

/**
 * 기도 타이머 '넛지'(일회성 예약 푸시).
 *
 * 목적: 기도를 시작했는데 아멘을 깜빡하고 앱을 닫아 둔 경우, 잠시 뒤 휴대폰으로
 *       "열어 둔 기도를 마무리하세요" 푸시를 보내 다시 열도록 돕습니다.
 *       (앱이 완전히 꺼져 있어도 서버가 보내므로 백그라운드에서도 옵니다.)
 *
 * 동작 방식:
 *  - 기도 시작 시 서버(prayer_nudges)에 "언제 보낼지"를 예약합니다.
 *  - 아멘으로 마치거나, 화면에서 목표 달성 안내를 이미 봤으면 예약을 취소합니다.
 *  - 서버의 send-reminders 함수가 매분 확인해, 예약 시각이 지난 넛지를 한 번 보내고 지웁니다.
 *
 * 한계: 웹에서는 '기도 알림'을 켜 둬(알림 권한을 허용해) 푸시 구독이 있는 기기에만 옵니다.
 *       구독이 없으면 조용히 아무 것도 하지 않습니다(사용자를 귀찮게 하지 않음).
 */

function basePath(): string {
  if (typeof location === 'undefined') return '';
  return location.pathname.startsWith('/mkchurch-prayer') ? '/mkchurch-prayer' : '';
}

function pushSupported(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * 이 기기의 푸시 구독 endpoint 를 찾습니다.
 * - create=false: 이미 있는 구독만 찾습니다(없으면 null). 취소할 때 씁니다.
 * - create=true : 알림 권한이 이미 허용돼 있으면 구독을 만들어 서버에 등록까지 합니다.
 *                 (권한을 새로 '요청'하지는 않습니다 — 기도 시작 순간에 권한창을 띄우지 않기 위해.)
 */
async function getEndpoint(create: boolean): Promise<string | null> {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration(`${basePath()}/`);
    if (!reg) return null;
    let sub = await reg.pushManager.getSubscription();
    if (!sub && create && Notification.permission === 'granted' && hasSupabaseConfig && supabase) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
      // 서버가 이 기기로 보낼 수 있도록 구독 키를 등록해 둡니다(리마인더는 끈 상태).
      const json = sub.toJSON();
      await supabase.rpc('push_upsert', {
        p_endpoint: sub.endpoint,
        p_slot: 0,
        p_p256dh: json.keys?.p256dh,
        p_auth: json.keys?.auth,
        p_days: [],
        p_time_hhmm: '21:00',
        p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        p_enabled: false,
      });
    }
    return sub?.endpoint ?? null;
  } catch {
    return null;
  }
}

/** 기도 시작 시: fireInSeconds 초 뒤에 "마무리하세요" 넛지를 예약합니다. */
export async function schedulePrayerNudge(fireInSeconds: number, body: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;
  const endpoint = await getEndpoint(true);
  if (!endpoint) return;
  const fireAt = new Date(Date.now() + Math.max(60, Math.round(fireInSeconds)) * 1000).toISOString();
  try {
    await supabase.rpc('prayer_nudge_set', { p_endpoint: endpoint, p_fire_at: fireAt, p_body: body });
  } catch {
    // 실패는 조용히 무시(보조 기능)
  }
}

/** 아멘·목표 달성 안내 등으로 더 이상 넛지가 필요 없을 때 예약을 취소합니다. */
export async function cancelPrayerNudge(): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;
  const endpoint = await getEndpoint(false);
  if (!endpoint) return;
  try {
    await supabase.rpc('prayer_nudge_clear', { p_endpoint: endpoint });
  } catch {
    // 무시
  }
}
