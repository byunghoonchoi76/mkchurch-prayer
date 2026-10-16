import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/** 기도하기(타이머) 화면의 '오늘의 기도'에서 볼 기도제목 종류. */
export type TodayPrayerKind = 'personal' | 'communal' | 'intercession';

export const TODAY_PRAYER_ORDER: TodayPrayerKind[] = ['personal', 'communal', 'intercession'];

/** 카테고리 라벨(짧은/긴). */
export const TODAY_PRAYER_LABEL: Record<TodayPrayerKind, { short: string; long: string }> = {
  personal: { short: '개인', long: '개인 기도제목' },
  communal: { short: '공동', long: '공동 기도제목' },
  intercession: { short: '중보', long: '중보기도제목' },
};

/**
 * '오늘의 기도' 선택 상태.
 * - allCategories: '전체'로 켠 카테고리(그 카테고리의 모든 제목 포함, 새로 추가돼도 자동 포함)
 * - selectedIds: 전체가 아닌 카테고리에서 개별로 고른 제목 ID들
 */
export type TodaySelection = {
  allCategories: TodayPrayerKind[];
  selectedIds: string[];
};

const KEY = 'church-app/today-prayer-selection';
const LEGACY_KEY = 'church-app/today-prayer-kind';
const VALID: TodayPrayerKind[] = ['personal', 'communal', 'intercession'];

/** 처음엔 세 카테고리를 모두 '전체'로 — 있는 기도제목을 다 보여 줍니다. */
export const DEFAULT_SELECTION: TodaySelection = {
  allCategories: ['personal', 'communal', 'intercession'],
  selectedIds: [],
};

function sanitize(raw: unknown): TodaySelection {
  if (!raw || typeof raw !== 'object') return DEFAULT_SELECTION;
  const obj = raw as Partial<TodaySelection>;
  const allCategories = Array.isArray(obj.allCategories)
    ? obj.allCategories.filter((k): k is TodayPrayerKind => VALID.includes(k as TodayPrayerKind))
    : [];
  const selectedIds = Array.isArray(obj.selectedIds) ? obj.selectedIds.filter((x) => typeof x === 'string') : [];
  return { allCategories, selectedIds };
}

export const isCategoryAll = (sel: TodaySelection, kind: TodayPrayerKind) => sel.allCategories.includes(kind);

/** 카테고리 '전체' 켜고 끄기. 켤 때는 그 카테고리에서 개별로 고를 필요가 없어집니다. */
export function toggleCategoryAll(sel: TodaySelection, kind: TodayPrayerKind): TodaySelection {
  if (sel.allCategories.includes(kind)) {
    return { ...sel, allCategories: sel.allCategories.filter((k) => k !== kind) };
  }
  return { ...sel, allCategories: [...sel.allCategories, kind] };
}

/** 개별 제목 고르고 빼기. */
export function toggleId(sel: TodaySelection, id: string): TodaySelection {
  if (sel.selectedIds.includes(id)) {
    return { ...sel, selectedIds: sel.selectedIds.filter((x) => x !== id) };
  }
  return { ...sel, selectedIds: [...sel.selectedIds, id] };
}

/**
 * 사용자가 고른 '오늘의 기도' 선택을 기억합니다. (기기에 저장되어 다음에도 유지)
 */
export function useTodaySelection() {
  const [selection, setSel] = useState<TodaySelection>(DEFAULT_SELECTION);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(KEY);
        if (saved) {
          if (alive) setSel(sanitize(JSON.parse(saved)));
        } else {
          // 예전 단일 선택(개인/공동/중보 하나)에서 넘어온 경우 변환합니다.
          const legacy = await AsyncStorage.getItem(LEGACY_KEY);
          if (alive && legacy && VALID.includes(legacy as TodayPrayerKind)) {
            setSel({ allCategories: [legacy as TodayPrayerKind], selectedIds: [] });
          }
        }
      } catch {
        // 저장소를 못 읽어도 기본값으로 동작합니다.
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setSelection = useCallback((next: TodaySelection) => {
    setSel(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  return { selection, setSelection, loaded };
}
