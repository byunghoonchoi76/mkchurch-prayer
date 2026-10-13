import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { dataMode, repository } from '@/lib/data';
import { toDateKey } from '@/lib/format';
import type { PrayerKind, PrayerLogEntry } from '@/lib/data/types';

// 저장 값의 단위는 '초'입니다. (예전에는 '분'이었으나 초 단위 카운팅으로 바뀌면서
// 키를 -v2 로 올려, 옛 분(minute) 값이 초로 잘못 읽히지 않게 했습니다.)
/** 개인(나의) 기도시간 저장 키 */
export const PERSONAL_PRAYER_KEY = 'church-app/prayer-log-v2';
/** 공동 기도에 내가 참여한 시간 저장 키 (기기 로컬, 나의 몫) */
export const COMMUNAL_PRAYER_KEY = 'church-app/communal-prayer-log-v2';

const KEY_BY_KIND: Record<PrayerKind, string> = {
  personal: PERSONAL_PRAYER_KEY,
  communal: COMMUNAL_PRAYER_KEY,
};

/** 같은 날 기록을 합쳐 최신이 앞에 오도록 정리합니다. */
function mergeToday(entries: PrayerLogEntry[], date: string, minutes: number, note?: string): PrayerLogEntry[] {
  const existing = entries.find((e) => e.date === date);
  const merged: PrayerLogEntry = {
    date,
    minutes: (existing?.minutes ?? 0) + minutes,
    note: note?.trim() || existing?.note,
  };
  return [merged, ...entries.filter((e) => e.date !== date)];
}

async function readLog(storageKey: string): Promise<PrayerLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PrayerLogEntry[]) : [];
  } catch {
    return [];
  }
}

/** 오늘부터 거꾸로 세어 기도 기록이 이어진 날 수 */
export function calculateStreak(entries: PrayerLogEntry[]): number {
  const done = new Set(entries.filter((e) => e.minutes > 0).map((e) => e.date));
  let streak = 0;
  const cursor = new Date();

  // 오늘 기록이 아직 없으면 어제부터 세어 연속 기록이 끊긴 것처럼 보이지 않게 합니다.
  if (!done.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (done.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** 오늘 포함 최근 `days` 일의 기록을 과거→오늘 순서로 반환 */
export function recentDays(entries: PrayerLogEntry[], days = 7): PrayerLogEntry[] {
  const map = new Map(entries.map((e) => [e.date, e]));
  const result: PrayerLogEntry[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = toDateKey(d);
    result.push(map.get(key) ?? { date: key, minutes: 0 });
  }
  return result;
}

/**
 * 오늘(로컬) 날짜 키(YYYY-MM-DD)를 '반응형'으로 제공합니다.
 * 화면을 열어 둔 채 자정이 지나거나, 앱이 백그라운드에서 다시 활성화되면
 * 값이 갱신되어 '오늘 기도시간' 등이 새 날짜 기준으로 리셋됩니다.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => toDateKey());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refresh = () => setToday((prev) => {
      const now = toDateKey();
      return prev === now ? prev : now;
    });

    const schedule = () => {
      if (timer) clearTimeout(timer);
      const d = new Date();
      // 다음 로컬 자정 + 5초 뒤에 날짜를 갱신하고 다시 예약합니다.
      const nextMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 5).getTime();
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, Math.max(1000, nextMidnight - d.getTime()));
    };
    schedule();

    // 앱이 다시 보이거나 포커스를 받으면 즉시 날짜를 확인합니다.
    const onWake = () => {
      if (typeof document === 'undefined' || !document.hidden) refresh();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onWake);
    if (typeof window !== 'undefined') window.addEventListener('focus', onWake);

    return () => {
      if (timer) clearTimeout(timer);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onWake);
      if (typeof window !== 'undefined') window.removeEventListener('focus', onWake);
    };
  }, []);

  return today;
}

/**
 * 계정 인식 기도시간 훅.
 * - 로그인한 성도(Supabase): 서버에 계정별로 저장되어 기기를 바꿔도 유지됩니다.
 * - 비로그인/샘플 모드: 지금처럼 이 기기에만 저장됩니다.
 */
export function usePrayerTime(kind: PrayerKind) {
  const { user } = useAuth();
  const server = dataMode === 'supabase' && !!user;
  const storageKey = KEY_BY_KIND[kind];

  const [entries, setEntries] = useState<PrayerLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const load = async (): Promise<PrayerLogEntry[]> => {
      if (server) {
        const rows = await repository.listMyPrayerTime();
        return rows
          .filter((r) => r.kind === kind)
          .map((r) => ({ date: r.date, minutes: r.minutes }));
      }
      return readLog(storageKey);
    };
    load()
      .then((loaded) => {
        if (active) {
          setEntries(loaded);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setEntries([]);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [server, kind, storageKey, nonce]);

  const addMinutes = useCallback(
    async (minutes: number, note?: string) => {
      if (minutes <= 0) return;
      const today = toDateKey();
      // 화면을 먼저 올려 두고, 저장은 뒤에서 처리합니다.
      setEntries((prev) => mergeToday(prev, today, minutes, note));
      if (server) {
        await repository.addMyPrayerTime(kind, today, minutes);
      } else {
        const next = mergeToday(entries, today, minutes, note);
        await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      }
    },
    [server, kind, entries, storageKey],
  );

  const clearToday = useCallback(async () => {
    const today = toDateKey();
    setEntries((prev) => prev.filter((e) => e.date !== today));
    if (server) {
      await repository.clearMyPrayerTime(kind, today);
    } else {
      const next = entries.filter((e) => e.date !== today);
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
    }
  }, [server, kind, entries, storageKey]);

  // 반응형 오늘 날짜 — 자정이 지나면 갱신되어 '오늘 기도시간'이 리셋됩니다.
  const todayKey = useToday();
  const today = entries.find((e) => e.date === todayKey);
  const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);

  return {
    entries,
    loading,
    server,
    reload,
    todayMinutes: today?.minutes ?? 0,
    streak: calculateStreak(entries),
    week: recentDays(entries, 7),
    totalMinutes,
    addMinutes,
    clearToday,
  };
}

/**
 * 개인 + 공동 참여 시간을 하나로 합친 '나의 기도 시간'.
 * 화면(타이머·달성률·달력·평균)은 이 통합값 하나만 봅니다.
 * 타이머로 쌓는 시간은 개인(personal) 기록에 누적하고, 공동 기도제목에서 쌓는 시간은
 * 공동(communal) 기록에 누적되지만, 여기서 둘을 합쳐 보여 줍니다.
 */
export function useAllPrayerTime() {
  const personal = usePrayerTime('personal');
  const communal = usePrayerTime('communal');

  const entries = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of [...personal.entries, ...communal.entries]) {
      map.set(e.date, (map.get(e.date) ?? 0) + e.minutes);
    }
    return [...map.entries()]
      .map(([date, minutes]) => ({ date, minutes }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [personal.entries, communal.entries]);

  const reload = useCallback(() => {
    personal.reload();
    communal.reload();
  }, [personal.reload, communal.reload]);

  const clearToday = useCallback(async () => {
    await personal.clearToday();
    await communal.clearToday();
  }, [personal.clearToday, communal.clearToday]);

  return {
    entries,
    loading: personal.loading || communal.loading,
    server: personal.server,
    reload,
    todayMinutes: personal.todayMinutes + communal.todayMinutes,
    streak: calculateStreak(entries),
    week: recentDays(entries, 7),
    totalMinutes: personal.totalMinutes + communal.totalMinutes,
    addMinutes: personal.addMinutes, // 통합 타이머 → 개인 기록에 누적
    clearToday,
  };
}

/** 로그인 계정에 아직 옮기지 않은 이 기기의 기도시간(분) 합계. 0 이면 가져올 것이 없습니다. */
export async function pendingLocalPrayerMinutes(): Promise<number> {
  let total = 0;
  for (const kind of ['communal', 'personal'] as PrayerKind[]) {
    const synced = await AsyncStorage.getItem(syncedFlagKey(kind));
    if (synced === 'true') continue;
    const local = await readLog(KEY_BY_KIND[kind]);
    total += local.reduce((sum, e) => sum + e.minutes, 0);
  }
  return total;
}

/** 이 기기에 저장된 기도시간을 로그인 계정(서버)으로 1회 옮깁니다. 중복 반영되지 않도록 플래그를 남깁니다. */
export async function syncLocalPrayerTimeToAccount(): Promise<void> {
  for (const kind of ['communal', 'personal'] as PrayerKind[]) {
    const synced = await AsyncStorage.getItem(syncedFlagKey(kind));
    if (synced === 'true') continue;
    const local = await readLog(KEY_BY_KIND[kind]);
    for (const entry of local) {
      if (entry.minutes > 0) {
        await repository.addMyPrayerTime(kind, entry.date, entry.minutes);
      }
    }
    await AsyncStorage.setItem(syncedFlagKey(kind), 'true');
  }
}

function syncedFlagKey(kind: PrayerKind): string {
  return `church-app/prayer-synced/${kind}`;
}
