import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import type { PrayerKind } from '@/lib/data/types';
import { hasSupabaseConfig, supabase } from '@/lib/supabase';

/**
 * 주간 기도 목표(분). 달성률 게이지의 기준이 됩니다.
 * 이 기기에 저장되며, 종류(개인·공동)별로 따로 둡니다.
 */
const KEY = (kind: PrayerKind) => `church-app/prayer-goal/${kind}`;

/** 종류별 목표 설정(모두 '분' 단위)
 *  - 개인: 나 한 사람의 주간 기도 목표 (최대 24시간)
 *  - 공동: 온 성도가 함께 채우는 목표. 전교인 규모를 고려해 아주 크게 잡을 수 있습니다.
 *          예) 2,000명 × 365일 × 1시간 = 730,000시간
 */
export interface GoalConfig {
  default: number; // 분
  min: number; // 분
  max: number; // 분
  step: number; // ± 버튼 단위(분)
}

export const GOAL_CONFIG: Record<PrayerKind, GoalConfig> = {
  personal: { default: 210, min: 30, max: 60 * 24, step: 30 },
  communal: { default: 60 * 100, min: 60, max: 60 * 730000, step: 60 * 10 }, // 최대 730,000시간, ±10시간
};

// 이전 코드 호환용(개인 기준). 새 코드는 GOAL_CONFIG[kind]를 쓰세요.
export const GOAL_STEP = GOAL_CONFIG.personal.step;
export const GOAL_MIN = GOAL_CONFIG.personal.min;
export const GOAL_MAX = GOAL_CONFIG.personal.max;

export function useWeeklyGoal(kind: PrayerKind) {
  const cfg = GOAL_CONFIG[kind];
  const [goal, setGoalState] = useState<number>(cfg.default);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    AsyncStorage.getItem(KEY(kind))
      .then((raw) => {
        if (!active) return;
        const parsed = raw ? parseInt(raw, 10) : NaN;
        setGoalState(Number.isFinite(parsed) && parsed > 0 ? parsed : cfg.default);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [kind]);

  const setGoal = useCallback(
    (next: number) => {
      const clamped = Math.min(cfg.max, Math.max(cfg.min, Math.round(next)));
      setGoalState(clamped);
      void AsyncStorage.setItem(KEY(kind), String(clamped));
    },
    [kind, cfg.max, cfg.min],
  );

  return { goal, setGoal, loading };
}

// ── 공동 기도 목표 (교회 공통값) ─────────────────────────────────
// 서버(app_settings.communal_goal_minutes)에 저장되어 관리자가 바꾸면 모든 성도에게 반영됩니다.
// Supabase 미연결(샘플 모드)에서는 이 기기에만 저장됩니다.
const COMMUNAL_LOCAL_KEY = 'church-app/prayer-goal/communal';

function clampCommunal(n: number): number {
  const cfg = GOAL_CONFIG.communal;
  return Math.min(cfg.max, Math.max(cfg.min, Math.round(n)));
}

export async function getCommunalGoal(): Promise<number> {
  if (hasSupabaseConfig && supabase) {
    try {
      const { data } = await supabase.from('app_settings').select('communal_goal_minutes').eq('id', 1).maybeSingle();
      const v = data?.communal_goal_minutes;
      if (typeof v === 'number' && v > 0) return clampCommunal(v);
    } catch {
      // 실패 시 기본값
    }
    return GOAL_CONFIG.communal.default;
  }
  const raw = await AsyncStorage.getItem(COMMUNAL_LOCAL_KEY);
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? clampCommunal(parsed) : GOAL_CONFIG.communal.default;
}

export async function setCommunalGoal(minutes: number): Promise<void> {
  const clamped = clampCommunal(minutes);
  if (hasSupabaseConfig && supabase) {
    const { data, error } = await supabase
      .from('app_settings')
      .update({ communal_goal_minutes: clamped, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .select('communal_goal_minutes');
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      throw new Error('목표를 저장하지 못했습니다. 관리자 계정으로 로그인했는지, DB에 communal_goal_minutes 컬럼이 있는지 확인해 주세요.');
    }
    return;
  }
  await AsyncStorage.setItem(COMMUNAL_LOCAL_KEY, String(clamped));
}

/** 공동 기도 목표 훅. 값은 모두가 읽고, 저장은 관리자만(서버 RLS) 가능합니다. */
export function useCommunalGoal() {
  const [goal, setGoalState] = useState<number>(GOAL_CONFIG.communal.default);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getCommunalGoal()
      .then((v) => active && setGoalState(v))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [nonce]);

  const setGoal = useCallback(async (next: number) => {
    const clamped = clampCommunal(next);
    setGoalState(clamped); // 낙관적 반영
    try {
      await setCommunalGoal(clamped);
    } catch (e) {
      setNonce((n) => n + 1); // 실패 시 서버값으로 되돌림
      throw e;
    }
  }, []);

  return { goal, setGoal, loading };
}
