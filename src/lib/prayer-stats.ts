import type { PrayerLogEntry } from '@/lib/data/types';
import { toDateKey } from '@/lib/format';

/*
 * 기도시간 기록(PrayerLogEntry)의 minutes 필드는 과거 호환으로 이름만 'minutes' 이고
 * 실제 단위는 '초'입니다. 아래 합계 함수들은 모두 '초'를 반환합니다.
 */

/** 이번 주(일요일부터 오늘까지) 합계 초 */
export function weekSeconds(entries: PrayerLogEntry[]): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const startKey = toDateKey(start);
  return entries.reduce((sum, e) => (e.date >= startKey ? sum + e.minutes : sum), 0);
}

/** 이번 달 합계 초 */
export function monthSeconds(entries: PrayerLogEntry[]): number {
  const prefix = toDateKey(new Date()).slice(0, 7); // 'YYYY-MM'
  return entries.reduce((sum, e) => (e.date.startsWith(prefix) ? sum + e.minutes : sum), 0);
}

/** 전체 누적 초 */
export function allTimeSeconds(entries: PrayerLogEntry[]): number {
  return entries.reduce((sum, e) => sum + e.minutes, 0);
}

/** 목표 시간(분)을 보기 좋게 표시 — 60분 이상은 시간 단위, 천 단위 콤마 */
export function goalLabel(min: number): string {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hs = h.toLocaleString('ko-KR');
  return m === 0 ? `${hs}시간` : `${hs}시간 ${m}분`;
}
