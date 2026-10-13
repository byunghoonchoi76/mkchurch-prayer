import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { hasSupabaseConfig, supabase } from '@/lib/supabase';

/**
 * 실시간 예배 방송 표시.
 *  - 관리자 강제 스위치(app_settings.live_override): 'on' 강제 켜기 / 'off' 강제 끄기 / 'auto' 자동
 *  - 'auto' 일 때는 Supabase 함수(live-status)로 유튜브 라이브 여부를 자동 감지합니다.
 *
 * 중요: 확인(체크)이 한 번 실패했다고 배지를 끄지 않습니다.
 *  - 설정 읽기가 실패하면 마지막에 확인된 모드를 그대로 유지합니다.
 *  - 자동 감지가 실패(함수·네트워크 오류)하면 이전 상태를 유지하고,
 *    '방송 아님'이 연속 2번 확인돼야 배지를 끕니다. → 방송 내내 안정적으로 유지됩니다.
 */
export type LiveOverride = 'auto' | 'on' | 'off';

export interface LiveStatus {
  live: boolean;
  watchUrl: string | null;
  title: string | null;
}

const IDLE: LiveStatus = { live: false, watchUrl: null, title: null };
const OVERRIDE_KEY = 'church-app/live-override';
const POLL_MS = 60_000;
// 자동 모드에서 '방송 아님'이 이만큼 연속 확인돼야 배지를 끕니다(깜빡임 방지).
const OFF_STREAK_NEEDED = 2;

function normalizeOverride(value: unknown): LiveOverride {
  return value === 'on' || value === 'off' ? value : 'auto';
}

/** 강제 스위치 값을 읽습니다. 읽지 못하면 null (호출한 쪽이 이전 값을 유지). */
async function readOverride(): Promise<LiveOverride | null> {
  if (hasSupabaseConfig && supabase) {
    try {
      const { data, error } = await supabase.from('app_settings').select('live_override').eq('id', 1).maybeSingle();
      if (error) return null;
      return normalizeOverride(data?.live_override);
    } catch {
      return null;
    }
  }
  try {
    return normalizeOverride(await AsyncStorage.getItem(OVERRIDE_KEY));
  } catch {
    return null;
  }
}

/** 현재 강제 스위치 값. (관리자 화면 표시용 — 읽기 실패 시 'auto') */
export async function getLiveOverride(): Promise<LiveOverride> {
  return (await readOverride()) ?? 'auto';
}

/**
 * 강제 스위치 값을 저장합니다. (Supabase 모드에서는 관리자만 가능)
 * 권한이 없거나 테이블이 없어 실제로 저장되지 않으면 오류를 던져 알려 줍니다.
 */
export async function setLiveOverride(mode: LiveOverride): Promise<void> {
  if (hasSupabaseConfig && supabase) {
    const { data, error } = await supabase
      .from('app_settings')
      .update({ live_override: mode, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .select('live_override');
    if (error) throw new Error(error.message);
    // RLS 로 막히면 오류 없이 0행만 바뀝니다 — 실제 저장 여부를 확인합니다.
    if (!data || data.length === 0 || data[0].live_override !== mode) {
      throw new Error(
        '설정을 저장하지 못했습니다. 관리자 계정으로 로그인했는지, 그리고 DB 마이그레이션(app_settings 테이블)이 적용됐는지 확인해 주세요.',
      );
    }
    return;
  }
  await AsyncStorage.setItem(OVERRIDE_KEY, mode);
}

/** 유튜브 자동 감지. 확인 성공 시 결과, 확인 실패(오류·미배포) 시 null. */
async function detect(): Promise<LiveStatus | null> {
  if (!hasSupabaseConfig || !supabase) return IDLE; // 샘플 모드: 감지 없음(= 방송 아님)
  try {
    const { data, error } = await supabase.functions.invoke('live-status');
    if (error || !data) return null;
    return { live: Boolean(data.live), watchUrl: data.watchUrl ?? null, title: data.title ?? null };
  } catch {
    return null;
  }
}

/** 관리자 진단용 — live-status 함수의 원시 응답(진단 필드 포함)을 그대로 돌려줍니다. */
export async function fetchLiveStatusRaw(): Promise<Record<string, unknown>> {
  if (!hasSupabaseConfig || !supabase) {
    return { error: '샘플 모드에서는 실시간 감지를 사용하지 않습니다. (Supabase 연결 필요)' };
  }
  try {
    const { data, error } = await supabase.functions.invoke('live-status');
    if (error) return { error: error.message };
    return (data as Record<string, unknown>) ?? { error: '응답이 비어 있습니다.' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export function useLiveStatus(): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>(IDLE);
  const statusRef = useRef<LiveStatus>(IDLE);
  const overrideRef = useRef<LiveOverride>('auto');
  const offStreak = useRef(0);

  const commit = useCallback((next: LiveStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const check = useCallback(async () => {
    // 설정 읽기 실패 시 마지막에 확인된 모드를 유지합니다.
    const override = (await readOverride()) ?? overrideRef.current;
    overrideRef.current = override;

    if (override === 'off') {
      offStreak.current = 0;
      commit(IDLE);
      return;
    }

    if (override === 'on') {
      // 강제 켜기: 배지는 무조건 켜 두고, 라이브 영상 링크는 감지되면 갱신합니다.
      offStreak.current = 0;
      const detected = await detect();
      commit({
        live: true,
        watchUrl: detected?.watchUrl ?? statusRef.current.watchUrl,
        title: detected?.title ?? statusRef.current.title,
      });
      return;
    }

    // auto
    const detected = await detect();
    if (detected === null) return; // 확인 실패 → 이전 상태 유지(끄지 않음)
    if (detected.live) {
      offStreak.current = 0;
      commit(detected);
      return;
    }
    // '방송 아님'이 확인됨 — 연속 2번째부터 끕니다.
    offStreak.current += 1;
    if (offStreak.current >= OFF_STREAK_NEEDED) commit(IDLE);
  }, [commit]);

  useEffect(() => {
    let active = true;
    const run = () => {
      if (active) void check();
    };
    const timer = setInterval(run, POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => {
      active = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [check]);

  useFocusEffect(
    useCallback(() => {
      void check();
    }, [check]),
  );

  return status;
}

/** 관리자 화면용 — 현재 강제 스위치 값과 변경 함수를 제공합니다. */
export function useLiveOverride() {
  const [mode, setMode] = useState<LiveOverride>('auto');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let active = true;
    void getLiveOverride().then((m) => {
      if (active) {
        setMode(m);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const update = useCallback(
    async (next: LiveOverride) => {
      const prev = mode;
      setError(undefined);
      setMode(next); // 먼저 화면에 반영
      setSaving(true);
      try {
        await setLiveOverride(next);
      } catch (e) {
        setMode(prev); // 실패하면 되돌리고 이유를 보여 줍니다.
        setError(e instanceof Error ? e.message : '설정을 저장하지 못했습니다.');
      } finally {
        setSaving(false);
      }
    },
    [mode],
  );

  return { mode, setMode: update, loading, saving, error };
}
