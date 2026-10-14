import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * 앱 전체 글자 크기 설정. 어르신도 편하게 보실 수 있도록 설정에서 조절합니다.
 * 기준(보통) 본문 크기를 16pt 로 보고, scale = pt / 16 을 모든 ThemedText 에 곱합니다.
 */
const KEY = 'church-app/font-pt';
export const MIN_PT = 14;
export const MAX_PT = 24;
export const DEFAULT_PT = 16;

type FontScaleCtx = { pt: number; scale: number; setPt: (n: number) => void };

const Ctx = createContext<FontScaleCtx>({ pt: DEFAULT_PT, scale: 1, setPt: () => {} });

export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [pt, setPtState] = useState(DEFAULT_PT);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        const n = Number(v);
        if (Number.isFinite(n) && n >= MIN_PT && n <= MAX_PT) setPtState(n);
      })
      .catch(() => {});
  }, []);

  const setPt = useCallback((n: number) => {
    const clamped = Math.min(MAX_PT, Math.max(MIN_PT, Math.round(n)));
    setPtState(clamped);
    void AsyncStorage.setItem(KEY, String(clamped)).catch(() => {});
  }, []);

  const value = useMemo(() => ({ pt, scale: pt / DEFAULT_PT, setPt }), [pt, setPt]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** ThemedText 등에서 쓰는 배율(기본 1) */
export function useFontScale(): number {
  return useContext(Ctx).scale;
}

/** 설정 화면에서 pt 값을 읽고 바꾸는 용도 */
export function useFontScaleControl(): FontScaleCtx {
  return useContext(Ctx);
}
