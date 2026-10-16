import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/** 기도하기(타이머) 화면의 '오늘의 기도'에서 어떤 기도제목을 볼지. */
export type TodayPrayerKind = 'personal' | 'communal' | 'intercession';

const KEY = 'church-app/today-prayer-kind';
const DEFAULT: TodayPrayerKind = 'personal';
const VALID: TodayPrayerKind[] = ['personal', 'communal', 'intercession'];

/** 세그먼트 버튼에 쓰는 선택지(짧은 라벨). */
export const TODAY_PRAYER_OPTIONS: { kind: TodayPrayerKind; label: string }[] = [
  { kind: 'personal', label: '개인' },
  { kind: 'communal', label: '공동' },
  { kind: 'intercession', label: '중보' },
];

/**
 * 사용자가 고른 '오늘의 기도' 종류를 기억합니다. (기기에 저장되어 다음에도 유지)
 */
export function useTodayPrayerKind() {
  const [kind, setKindState] = useState<TodayPrayerKind>(DEFAULT);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (alive && v && VALID.includes(v as TodayPrayerKind)) setKindState(v as TodayPrayerKind);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const setKind = useCallback((next: TodayPrayerKind) => {
    setKindState(next);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  }, []);

  return { kind, setKind };
}
