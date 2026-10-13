import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/**
 * '새 소식' 기준 — 소식 목록을 마지막으로 본 시각. 이 시각 이후에 올라온 글만 '새 소식'입니다.
 * 처음 앱을 열면 '지금'으로 잡혀, 이미 올라와 있던 글은 새 소식으로 표시되지 않습니다.
 * (이 기기에만 저장합니다.)
 */
const KEY = 'church-app/news-seen-at';

async function readSeenAt(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const v = raw ? Number(raw) : NaN;
    if (Number.isFinite(v)) return v;
  } catch {
    /* 무시 */
  }
  return Date.now();
}

async function writeSeenAt(t: number): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, String(t));
  } catch {
    /* 무시 */
  }
}

/**
 * 화면이 focus 될 때 기준 시각을 불러옵니다.
 * markOnView=true(소식 탭)이면 현재 화면엔 배지를 보여 주되, 저장된 기준을 '지금'으로 올려
 * 다음 방문부터는 그 글들이 '새 소식'에서 사라지게 합니다.
 */
export function useNewsSeenAt(markOnView = false): number {
  const [seenAt, setSeenAt] = useState<number>(Number.MAX_SAFE_INTEGER); // 로드 전엔 아무것도 새 글로 보지 않음
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void readSeenAt().then((v) => {
        if (!active) return;
        setSeenAt(v);
        if (markOnView) void writeSeenAt(Date.now());
      });
      return () => {
        active = false;
      };
    }, [markOnView]),
  );
  return seenAt;
}

/** publishedAt(ISO)이 기준 시각 이후면 '새 소식'입니다. */
export function isUnread(publishedAt: string, seenAt: number): boolean {
  const t = new Date(publishedAt).getTime();
  if (Number.isNaN(t)) return false;
  return t > seenAt;
}
