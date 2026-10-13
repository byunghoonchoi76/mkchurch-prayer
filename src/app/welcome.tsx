import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { dataMode } from '@/lib/data';

const SLOGAN = require('@/assets/images/slogan-hero.jpg');

/** 앱을 처음 열었을 때 보여 주는 시작 화면 — 교회 표어 이미지 위에 로그인·회원가입·손님 진입. */
export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { chooseGuest } = useAuth();
  const isSupabase = dataMode === 'supabase';

  const startAsGuest = async () => {
    await chooseGuest();
    router.replace('/');
  };

  return (
    <View style={styles.root}>
      {/* 표어 이미지를 화면 전체에 꽉 차게(cover) 깝니다. 표어가 위쪽에 오도록 위 정렬. */}
      <Image
        source={SLOGAN}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="center"
      />

      {/* 버튼은 화면 하단 중앙에 절대 위치로 고정합니다. */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.five }]}>
        <View style={styles.actions}>
          {isSupabase ? (
            <>
              <SolidButton label="로그인" onPress={() => router.push('/sign-in')} />
              <OutlineButton
                label="회원가입"
                onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'signUp' } })}
              />
            </>
          ) : (
            <SolidButton label="이름으로 시작하기" onPress={() => router.push('/sign-in')} />
          )}
          <Pressable onPress={() => void startAsGuest()} hitSlop={8} style={styles.guestBtn}>
            <Text style={styles.guestText}>손님으로 둘러보기</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function SolidButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.solidBtn, pressed && styles.pressed]}>
      <Text style={styles.solidText}>{label}</Text>
    </Pressable>
  );
}

function OutlineButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}>
      <Text style={styles.outlineText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#5E1410', overflow: 'hidden' },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
  },
  actions: { width: '100%', maxWidth: 440, gap: Spacing.two },
  solidBtn: {
    minHeight: 52,
    borderRadius: Radius.medium,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  solidText: { color: '#8A1F16', fontSize: 16, fontWeight: '800' },
  outlineBtn: {
    minHeight: 52,
    borderRadius: Radius.medium,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(94,20,16,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  guestBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.one },
  guestText: { color: 'rgba(255,255,255,0.95)', fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
  pressed: { opacity: 0.85 },
});
