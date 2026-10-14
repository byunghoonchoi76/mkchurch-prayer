import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * 앱 전체 글자 설정 — 크기(scale)와 글꼴(family).
 * - 크기: 기준(보통) 본문 16pt 기준 scale = pt/16 을 ThemedText 에 곱합니다.
 * - 글꼴: 웹 글꼴(CDN, 상업적 무료)을 불러와 CSS 변수 --font-display 를 바꿉니다.
 *   (ThemedText 의 fontFamily 가 var(--font-display) 라 전체에 즉시 적용됩니다.)
 */
const PT_KEY = 'church-app/font-pt';
const FAMILY_KEY = 'church-app/font-family';
export const MIN_PT = 14;
export const MAX_PT = 24;
export const DEFAULT_PT = 16;

export type FontKey = 'default' | 'pretendard' | 'gowun' | 'nanum';

export type FontOption = {
  key: FontKey;
  label: string;
  note: string;
  stack: string;
  href?: string;
};

export const FONT_OPTIONS: FontOption[] = [
  {
    key: 'default',
    label: '기본',
    note: '노토 산스 (깔끔한 고딕)',
    stack:
      "'Noto Sans KR', Pretendard, Inter, ui-sans-serif, system-ui, -apple-system, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'",
  },
  {
    key: 'pretendard',
    label: '프리텐다드',
    note: '또렷하고 현대적인 고딕',
    stack: "Pretendard, 'Noto Sans KR', sans-serif",
    href: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css',
  },
  {
    key: 'gowun',
    label: '고운바탕',
    note: '부드러운 바탕(명조)체',
    stack: "'Gowun Batang', 'Noto Sans KR', serif",
    href: 'https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap',
  },
  {
    key: 'nanum',
    label: '나눔명조',
    note: '단정한 명조체',
    stack: "'Nanum Myeongjo', 'Noto Sans KR', serif",
    href: 'https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&display=swap',
  },
];

function optionOf(key: FontKey): FontOption {
  return FONT_OPTIONS.find((o) => o.key === key) ?? FONT_OPTIONS[0];
}

/** 글꼴 스타일시트를 한 번만 head 에 추가합니다(웹). */
function ensureFontLink(key: FontKey) {
  if (typeof document === 'undefined') return;
  const opt = optionOf(key);
  if (!opt.href) return;
  const id = `appfont-${key}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = opt.href;
  document.head.appendChild(link);
}

/** 미리보기를 위해 모든 글꼴을 미리 불러옵니다. */
export function preloadAllFonts() {
  for (const o of FONT_OPTIONS) ensureFontLink(o.key);
}

function applyFont(key: FontKey) {
  if (typeof document === 'undefined') return;
  ensureFontLink(key);
  document.documentElement.style.setProperty('--font-display', optionOf(key).stack);
}

type FontCtx = {
  pt: number;
  scale: number;
  setPt: (n: number) => void;
  family: FontKey;
  setFamily: (k: FontKey) => void;
};

const Ctx = createContext<FontCtx>({ pt: DEFAULT_PT, scale: 1, setPt: () => {}, family: 'default', setFamily: () => {} });

export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [pt, setPtState] = useState(DEFAULT_PT);
  const [family, setFamilyState] = useState<FontKey>('default');

  useEffect(() => {
    AsyncStorage.getItem(PT_KEY)
      .then((v) => {
        const n = Number(v);
        if (Number.isFinite(n) && n >= MIN_PT && n <= MAX_PT) setPtState(n);
      })
      .catch(() => {});
    AsyncStorage.getItem(FAMILY_KEY)
      .then((v) => {
        if (v && FONT_OPTIONS.some((o) => o.key === v)) {
          setFamilyState(v as FontKey);
          applyFont(v as FontKey);
        }
      })
      .catch(() => {});
  }, []);

  const setPt = useCallback((n: number) => {
    const clamped = Math.min(MAX_PT, Math.max(MIN_PT, Math.round(n)));
    setPtState(clamped);
    void AsyncStorage.setItem(PT_KEY, String(clamped)).catch(() => {});
  }, []);

  const setFamily = useCallback((k: FontKey) => {
    setFamilyState(k);
    applyFont(k);
    void AsyncStorage.setItem(FAMILY_KEY, k).catch(() => {});
  }, []);

  const value = useMemo(() => ({ pt, scale: pt / DEFAULT_PT, setPt, family, setFamily }), [pt, setPt, family, setFamily]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** ThemedText 등에서 쓰는 배율(기본 1) */
export function useFontScale(): number {
  return useContext(Ctx).scale;
}

/** 설정 화면에서 글자 크기·글꼴을 읽고 바꾸는 용도 */
export function useFontScaleControl(): FontCtx {
  return useContext(Ctx);
}
