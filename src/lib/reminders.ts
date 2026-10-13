import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/lib/auth';
import { hasSupabaseConfig, supabase } from '@/lib/supabase';

/**
 * 기도 알림(웹 푸시).
 * - 사용자가 요일·시간을 정하면 이 기기의 구독 정보를 Supabase(push_subscriptions)에 저장합니다.
 * - 한 기기(사람)당 최대 3개의 알림을 서로 다른 요일·시간으로 설정할 수 있습니다(slot 0·1·2).
 * - 서버(send-reminders 함수)가 매분 확인해, 지정한 요일·시간에 이 기기로 푸시를 보냅니다.
 * - 웹에서만 동작합니다. (앱을 홈 화면에 추가하면 더 안정적으로 옵니다.)
 */

// VAPID 공개키 — 비밀이 아니며 앱에 넣어도 됩니다. (개인키는 Supabase 시크릿에만 둡니다.)
export const VAPID_PUBLIC_KEY = 'BPKaSQlaWOw4kO6oT5PMbWKeLK2AjYaA25wuA4t1O1asLehbbvvcAMI0auV9jy16VtOCV-31wb3QeUM43x_hRS0';

/** 한 사람이 설정할 수 있는 알림 최대 개수 */
export const MAX_REMINDERS = 3;

/** 알림 한 개의 설정 (요일·시간) */
export interface ReminderItem {
  slot: number; // 0·1·2
  days: number[]; // 0(일)~6(토)
  hour: number;
  minute: number;
}

export interface ReminderState {
  supported: boolean;
  reason?: string;
  permission: NotificationPermission | 'unsupported';
  /** 알림이 켜져 있는지(이 기기에서) */
  enabled: boolean;
  /** 설정된 알림 목록 (최대 3개) */
  items: ReminderItem[];
}

const DEFAULT_ITEM: Omit<ReminderItem, 'slot'> = { days: [0, 3], hour: 21, minute: 0 };

const DEFAULT_STATE: ReminderState = {
  supported: false,
  permission: 'unsupported',
  enabled: false,
  items: [{ slot: 0, ...DEFAULT_ITEM }],
};

function basePath(): string {
  if (typeof location === 'undefined') return '';
  return location.pathname.startsWith('/mkchurch-prayer') ? '/mkchurch-prayer' : '';
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

function isSupported(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const url = `${basePath()}/sw.js`;
  const scope = `${basePath()}/`;
  const existing = await navigator.serviceWorker.getRegistration(scope);
  const reg = existing ?? (await navigator.serviceWorker.register(url, { scope }));
  await navigator.serviceWorker.ready;
  return reg;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * 이 기기가 푸시를 받을 수 있도록 구독을 보장합니다(소통방 알림 등에서 사용).
 * - 권한을 요청하고 구독을 만든 뒤, 없으면 '수신용' 기본 구독 행을 만듭니다(기도 리마인더는 off).
 * - 이미 구독 행이 있으면 user_id 만 채워 그룹 알림 대상 매칭이 되게 합니다.
 */
export async function ensurePushSubscription(userId: string | null): Promise<{ ok: boolean; reason?: string }> {
  if (!isSupported()) return { ok: false, reason: '이 브라우저·기기에서는 알림을 지원하지 않습니다.' };
  if (!hasSupabaseConfig || !supabase) return { ok: false, reason: '알림을 저장할 서버가 연결되어 있지 않습니다.' };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: '알림 권한이 허용되지 않았습니다. 브라우저 설정에서 알림을 허용해 주세요.' };
  try {
    const reg = await getRegistration();
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      }));
    const json = sub.toJSON();
    const { data } = await supabase.from('push_subscriptions').select('slot').eq('endpoint', sub.endpoint).limit(1);
    if (!data || data.length === 0) {
      await supabase.from('push_subscriptions').upsert(
        {
          endpoint: sub.endpoint,
          slot: 0,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
          user_id: userId,
          days: [],
          time_hhmm: '21:00',
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          enabled: false, // 리마인더는 끈 상태 — 소통방 등 대상 알림에만 사용
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint,slot' },
      );
    } else if (userId) {
      // 로그아웃 상태에서 만든 구독이면 user_id 를 채워 둡니다.
      await supabase.from('push_subscriptions').update({ user_id: userId }).eq('endpoint', sub.endpoint).is('user_id', null);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : '알림 구독을 만들지 못했습니다.' };
  }
}

/** 이미 있는 slot 을 피해 다음 빈 slot(0·1·2)을 고릅니다. */
function nextSlot(items: ReminderItem[]): number {
  for (let i = 0; i < MAX_REMINDERS; i += 1) {
    if (!items.some((it) => it.slot === i)) return i;
  }
  return items.length; // 이론상 도달하지 않음
}

/** 기도 알림 설정 훅 (웹 전용). */
export function useReminders() {
  const { user } = useAuth();
  const [state, setState] = useState<ReminderState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // 초기: 지원 여부 + 이 기기의 기존 구독 설정(여러 slot)을 불러옵니다.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!isSupported()) {
        if (active) {
          setState((s) => ({ ...s, supported: false, reason: '이 브라우저·기기에서는 알림을 지원하지 않습니다.' }));
          setLoading(false);
        }
        return;
      }
      if (!hasSupabaseConfig || !supabase) {
        if (active) {
          setState((s) => ({ ...s, supported: false, reason: '알림을 저장할 서버(Supabase)가 연결되어 있지 않습니다.' }));
          setLoading(false);
        }
        return;
      }
      const permission = Notification.permission;
      let loaded: Partial<ReminderState> = {};
      try {
        const reg = await navigator.serviceWorker.getRegistration(`${basePath()}/`);
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) {
          const { data } = await supabase
            .from('push_subscriptions')
            .select('slot, days, time_hhmm, enabled')
            .eq('endpoint', sub.endpoint)
            .order('slot', { ascending: true });
          if (data && data.length > 0) {
            const items: ReminderItem[] = data.slice(0, MAX_REMINDERS).map((row, i) => {
              const [h, m] = String(row.time_hhmm ?? '21:00').split(':').map((x) => parseInt(x, 10));
              return {
                slot: typeof row.slot === 'number' ? row.slot : i,
                days: Array.isArray(row.days) ? row.days : DEFAULT_ITEM.days,
                hour: Number.isFinite(h) ? h : 21,
                minute: Number.isFinite(m) ? m : 0,
              };
            });
            loaded = { items, enabled: data.some((row) => row.enabled) };
          }
        }
      } catch {
        // 불러오기 실패해도 기본값으로 진행합니다.
      }
      if (active) {
        setState((s) => ({ ...s, ...loaded, supported: true, permission }));
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const addItem = useCallback(() => {
    setState((s) => {
      if (s.items.length >= MAX_REMINDERS) return s;
      return { ...s, items: [...s.items, { slot: nextSlot(s.items), ...DEFAULT_ITEM }] };
    });
  }, []);

  /** 알림 한 개 삭제 — 저장돼 있던 것이면 서버에서도 지웁니다. */
  const removeItem = useCallback(async (slot: number) => {
    setState((s) => ({ ...s, items: s.items.filter((it) => it.slot !== slot) }));
    try {
      if (!supabase) return;
      const reg = await navigator.serviceWorker.getRegistration(`${basePath()}/`);
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint).eq('slot', slot);
      }
    } catch {
      /* 다음 저장에서 정리됩니다. */
    }
  }, []);

  const setItemDays = useCallback(
    (slot: number, days: number[]) =>
      setState((s) => ({ ...s, items: s.items.map((it) => (it.slot === slot ? { ...it, days } : it)) })),
    [],
  );
  const setItemTime = useCallback(
    (slot: number, hour: number, minute: number) =>
      setState((s) => ({ ...s, items: s.items.map((it) => (it.slot === slot ? { ...it, hour, minute } : it)) })),
    [],
  );

  /** 알림 켜기/저장: 권한 요청 → 구독 → 모든 알림(slot) 저장 */
  const save = useCallback(async () => {
    if (!isSupported() || !supabase) return;
    setBusy(true);
    setError(undefined);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState((s) => ({ ...s, permission, enabled: false }));
        setError('알림 권한이 허용되지 않았습니다. 브라우저 설정에서 알림을 허용해 주세요.');
        return;
      }
      const reg = await getRegistration();
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        }));
      const json = sub.toJSON();
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const now = new Date().toISOString();

      const items = state.items;
      const rows = items.map((it) => ({
        endpoint: sub.endpoint,
        slot: it.slot,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        user_id: user?.id ?? null,
        days: it.days,
        time_hhmm: `${pad2(it.hour)}:${pad2(it.minute)}`,
        tz,
        enabled: true,
        updated_at: now,
      }));
      const { error: upErr } = await supabase.from('push_subscriptions').upsert(rows, { onConflict: 'endpoint,slot' });
      if (upErr) throw new Error(upErr.message);

      // 화면에서 지운 slot 이 서버에 남아 있으면 제거합니다.
      const keepSlots = items.map((it) => it.slot);
      if (keepSlots.length > 0) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint)
          .not('slot', 'in', `(${keepSlots.join(',')})`);
      }

      setState((s) => ({ ...s, permission, enabled: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '알림을 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }, [state.items, user]);

  /** 테스트 알림 — 이 기기에서 알림 "표시"가 되는지 즉시 확인(서버를 거치지 않음). */
  const testNotify = useCallback(async () => {
    if (!isSupported()) return;
    setBusy(true);
    setError(undefined);
    try {
      let permission = Notification.permission;
      if (permission !== 'granted') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') {
        setState((s) => ({ ...s, permission }));
        setError('알림 권한이 허용되지 않았습니다. 브라우저 설정에서 알림을 허용해 주세요.');
        return;
      }
      const reg = await getRegistration();
      await reg.showNotification('테스트 알림 🙏', {
        body: '이 알림이 보이면 표시는 정상입니다. 이제 실제 알림도 옵니다.',
        icon: `${basePath()}/app-icon.png`,
        badge: `${basePath()}/app-icon.png`,
        tag: 'prayer-test',
        vibrate: [300, 150, 300, 150, 300],
      } as NotificationOptions);
      setState((s) => ({ ...s, permission }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '테스트 알림을 띄우지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }, []);

  /** 알림 끄기 — 모든 slot 을 비활성화합니다(설정은 남겨 둡니다). */
  const disable = useCallback(async () => {
    if (!isSupported() || !supabase) return;
    setBusy(true);
    setError(undefined);
    try {
      const reg = await navigator.serviceWorker.getRegistration(`${basePath()}/`);
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await supabase.from('push_subscriptions').update({ enabled: false }).eq('endpoint', sub.endpoint);
      }
      setState((s) => ({ ...s, enabled: false }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '알림을 끄지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, loading, busy, error, addItem, removeItem, setItemDays, setItemTime, save, disable, testNotify };
}
