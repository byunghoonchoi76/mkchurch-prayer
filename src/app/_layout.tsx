import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { FontScaleProvider } from '@/lib/font-scale';
import { registerServiceWorker } from '@/lib/register-sw';

SplashScreen.preventAutoHideAsync();

/**
 * 로그인/손님 선택 여부에 따라 시작 화면(welcome)과 앱을 오가게 합니다.
 * - 로그인했거나 '손님으로 둘러보기'를 고른 사용자는 바로 기도 홈으로.
 * - 아직 아무것도 고르지 않은 새 사용자는 시작 화면으로.
 */
function useStartupGate() {
  const { user, loading, guestAck } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const ready = !loading;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const onWelcome = segments[0] === 'welcome';
    // 아직 로그인/손님을 정하지 않아도 열 수 있어야 하는 화면들.
    // 로그인·회원가입과, 앱스토어 심사·외부 링크에서 로그인 없이 접근해야 하는 약관/방침 페이지.
    const PUBLIC_ROUTES = ['sign-in', 'privacy', 'terms', 'email-refusal', 'display'];
    const onAuthFlow = onWelcome || PUBLIC_ROUTES.includes(segments[0] ?? '');
    const decided = !!user || guestAck === true;
    if (!decided && !onAuthFlow) {
      router.replace('/welcome');
    } else if (decided && onWelcome) {
      router.replace('/');
    }
  }, [ready, user, guestAck, segments, router]);
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const palette = isDark ? Colors.dark : Colors.light;

  // 웹(PWA) 자동 갱신: 새 버전이 배포되면 다음에 열 때 자동으로 최신 화면이 뜹니다.
  useEffect(() => {
    registerServiceWorker();
  }, []);

  const navigationTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          primary: palette.primary,
          background: palette.background,
          card: palette.backgroundElement,
          text: palette.text,
          border: palette.border,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          primary: palette.primary,
          background: palette.background,
          card: palette.backgroundElement,
          text: palette.text,
          border: palette.border,
        },
      };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <FontScaleProvider>
        <AuthProvider>
          <ThemeProvider value={navigationTheme}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <RootNavigator />
          </ThemeProvider>
        </AuthProvider>
      </FontScaleProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  useStartupGate();
  return (
    <Stack screenOptions={{ headerBackTitle: '뒤로' }}>
      <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="prayer/today" options={{ title: '오늘의 기도' }} />
      <Stack.Screen name="prayer/stats" options={{ title: '기도 통계' }} />
      <Stack.Screen name="prayer/communal" options={{ title: '공동 기도제목' }} />
      <Stack.Screen name="prayer/personal" options={{ title: '개인 기도제목' }} />
      <Stack.Screen name="prayer/requests" options={{ title: '중보기도제목' }} />
      <Stack.Screen name="prayer/new" options={{ title: '기도제목 나누기', presentation: 'modal' }} />
      <Stack.Screen name="prayer/edit/[id]" options={{ title: '기도제목 수정', presentation: 'modal' }} />
      <Stack.Screen name="reminders" options={{ title: '기도 알림' }} />
      <Stack.Screen name="profile" options={{ title: '내 정보 수정' }} />
      <Stack.Screen name="display" options={{ headerShown: false }} />
      <Stack.Screen name="privacy" options={{ title: '개인정보처리방침' }} />
      <Stack.Screen name="terms" options={{ title: '이용약관' }} />
      <Stack.Screen name="email-refusal" options={{ title: '이메일무단수집거부' }} />
      <Stack.Screen name="sign-in" options={{ title: '로그인', presentation: 'modal' }} />
      <Stack.Screen name="admin/index" options={{ title: '관리자 대시보드' }} />
      <Stack.Screen name="admin/members" options={{ title: '성도 명단' }} />
      <Stack.Screen name="admin/communal/[id]" options={{ title: '공동 기도제목' }} />
    </Stack>
  );
}
