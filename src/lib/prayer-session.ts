import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 진행 중인 기도 타이머를 기기에 임시로 저장합니다.
 *
 * 목적: 사용자가 "아멘"을 누르지 않고 화면을 벗어나거나 앱이 꺼져도 기도 시간이 사라지지 않도록.
 *  - 기도 중에는 몇 초마다, 그리고 앱이 백그라운드로 갈 때 여기 저장합니다(elapsedSec).
 *  - elapsedSec 은 '마지막으로 확인된 누적 기도 시간'이라, 앱이 꺼져 있던 시간은 포함하지 않습니다.
 *    (그래서 다음에 복구할 때 시간이 부풀지 않습니다.)
 *  - 기도를 정상적으로 마치면(clearActiveSession) 지워집니다.
 *  - 앱을 다시 켰을 때 남아 있으면 "이어서 기록할까요?" 안내를 띄웁니다.
 */
const KEY = 'church-app/active-prayer-session';

export interface ActivePrayerSession {
  /** 마지막으로 확인된 누적 기도 시간(초). 앱이 꺼져 있던 시간은 포함하지 않습니다. */
  elapsedSec: number;
  /** 기도를 시작한 시각(epoch ms) — 안내 문구용 */
  startedAt: number;
  /** 마지막으로 저장한 시각(epoch ms) */
  updatedAt: number;
}

export async function saveActiveSession(elapsedSec: number, startedAt: number): Promise<void> {
  try {
    const payload: ActivePrayerSession = {
      elapsedSec: Math.max(0, Math.round(elapsedSec)),
      startedAt,
      updatedAt: Date.now(),
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // 저장 실패는 조용히 무시 (복구는 보조 기능이므로 기도 흐름을 막지 않음)
  }
}

export async function loadActiveSession(): Promise<ActivePrayerSession | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ActivePrayerSession;
    if (p && typeof p.elapsedSec === 'number' && p.elapsedSec > 0) return p;
    return null;
  } catch {
    return null;
  }
}

export async function clearActiveSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}
