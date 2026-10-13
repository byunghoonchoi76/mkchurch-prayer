/**
 * 앱 전역 색상 · 간격 · 폰트 토큰.
 * 라이트/다크 모드 값을 같은 키로 정의해 두고 `useTheme()` 으로 꺼내 씁니다.
 * 주요 색은 교회 CI(남색 + 청록)에서 가져왔습니다.
 */

import '@/global.css';

import { Platform } from 'react-native';

/** 교회 CI 색상. 로고와 앱 전체가 같은 색을 씁니다. */
export const Brand = {
  /** CI 원본에서 추출한 색입니다. */
  navy: '#104C6E',
  navyDark: '#0B3752',
  teal: '#1DAFC2',
  tealLight: '#63CAD8',
} as const;

export const Colors = {
  light: {
    text: '#231F1A',
    textSecondary: '#6B6355',
    textMuted: '#A79E8E',
    background: '#F6F3ED',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EFEADF',
    card: '#FFFFFF',
    border: '#EAE3D6',
    primary: Brand.navy,
    onPrimary: '#FFFFFF',
    accent: '#BE8A4C',
    danger: '#C4453B',
    success: '#4F8A6B',
  },
  dark: {
    text: '#F3ECDF',
    textSecondary: '#B4AB99',
    textMuted: '#847B6B',
    background: '#17140F',
    backgroundElement: '#221E17',
    backgroundSelected: '#2E281E',
    card: '#221E17',
    border: '#332C22',
    primary: Brand.tealLight,
    onPrimary: '#17140F',
    accent: '#D8AE72',
    danger: '#E4776C',
    success: '#5CB98F',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** 히어로/배너에 쓰는 따뜻한 그라데이션과 사진 위 스크림 */
export const Gradients = {
  // 따뜻한 베이지→세이지 (사진이 없을 때 히어로 배경)
  warm: ['#8FA68E', '#6E8A79'] as const,
  // 사진 위에 얹어 글씨가 잘 보이게 하는 어두운 스크림
  scrim: ['transparent', 'rgba(20,16,10,0.72)'] as const,
  // CI 남색 카드용
  navy: ['#1B5A80', '#0E3F5C'] as const,
} as const;

export const Radius = {
  small: 10,
  medium: 16,
  large: 24,
  pill: 999,
} as const;

/**
 * 부드러운 그림자 토큰. 카드가 배경에서 살짝 떠 보이게 해 완성도를 높입니다.
 * (따뜻한 갈색 계열 그림자라 베이지 배경과 자연스럽게 어울립니다.)
 * react-native-web 은 shadow* 값을 boxShadow 로 자동 변환합니다.
 */
export const Shadow = {
  // 카드용 — 넓고 부드럽게 떠 있는 모던한 느낌(살짝 차가운 톤)
  card: {
    shadowColor: '#1C2B36',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 3,
  },
  // 작은 타일·칩용 — 더 얕은 그림자
  soft: {
    shadowColor: '#1C2B36',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
} as const;

export const MaxContentWidth = 720;
