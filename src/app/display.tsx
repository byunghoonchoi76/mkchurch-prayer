import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { repository, useAsyncData } from '@/lib/data';

const HERO = require('@/assets/images/prayer-home-hero.jpg');
const REFRESH_MS = 10000; // 10초마다 최신 합계 반영
const GOLD = '#F2C14E';

/** 누적 초 → "1,284시간 37분" (시 단위 천 단위 콤마) */
function formatTotal(seconds: number): { hours: string; minutes: string } {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return { hours: h.toLocaleString('ko-KR'), minutes: String(m) };
}

/** 글자가 바뀔 때 세로로 '뒤집히는'(flip) 효과로 새 숫자를 보여 줍니다. */
function FlipChar({ char, style }: { char: string; style: object }) {
  const [shown, setShown] = useState(char);
  const shownRef = useRef(char);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (char === shownRef.current) return;
    anim.setValue(0);
    const id = anim.addListener(({ value }) => {
      // 카드가 모서리(90°)로 섰을 때 숫자를 교체해, 자연스럽게 뒤집혀 보이게 합니다.
      if (value >= 0.5 && shownRef.current !== char) {
        shownRef.current = char;
        setShown(char);
      }
    });
    Animated.timing(anim, {
      toValue: 1,
      duration: 480,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start(() => anim.removeListener(id));
    return () => anim.removeListener(id);
  }, [char, anim]);

  const rotateX = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '90deg', '0deg'] });
  const opacity = anim.interpolate({ inputRange: [0, 0.3, 0.5, 0.7, 1], outputRange: [1, 0.35, 0.1, 0.35, 1] });

  return (
    <Animated.Text style={[style, { opacity, transform: [{ perspective: 600 }, { rotateX }] }]}>{shown}</Animated.Text>
  );
}

/** 숫자 문자열을 한 글자씩 플립 글자로 나열합니다. */
function FlipNumber({ text, style }: { text: string; style: object }) {
  return (
    <View style={styles.flipRow}>
      {text.split('').map((c, i) => (
        <FlipChar key={i} char={c} style={style} />
      ))}
    </View>
  );
}

/**
 * 본당 디스플레이 — 온 성도의 누적 기도시간을 큰 화면으로 보여 줍니다.
 * 로그인 없이 열리는 공개 화면이라, 본당 입구의 태블릿·TV에서 바로 띄울 수 있습니다.
 * 주소: …/display
 */
export default function PrayerWallDisplay() {
  const { width, height } = useWindowDimensions();
  const church = useAsyncData(() => repository.getChurchPrayerSeconds().catch(() => 0), []);

  // 주기적으로 최신 합계를 가져옵니다. (값이 바뀌면 숫자가 플립됩니다)
  useEffect(() => {
    const id = setInterval(() => church.reload(), REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 화면이 꺼지지 않도록(웹) 베스트-에포트 화면 잠금.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        lock = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen');
      } catch {
        /* 무시 */
      }
    };
    void request();
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') void request();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
      try {
        void lock?.release();
      } catch {
        /* 무시 */
      }
    };
  }, []);

  // 전체화면 토글 (웹 전용) — 한 번 탭하면 주소창·탭 없이 꽉 찬 화면이 됩니다.
  const [isFs, setIsFs] = useState(false);
  const fsAvailable = Platform.OS === 'web' && typeof document !== 'undefined' && !!document.documentElement?.requestFullscreen;
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen();
    } catch {
      /* 무시 */
    }
  };

  const { hours, minutes } = formatTotal(church.data ?? 0);

  // 가로/세로, 큰 화면/작은 화면에 맞춰 숫자 크기를 조절합니다.
  const landscape = width > height;
  const base = Math.min(width, height);
  const numSize = Math.round(Math.max(44, Math.min(landscape ? 150 : 96, base * (landscape ? 0.16 : 0.2))));
  const unitSize = Math.round(numSize * 0.42);
  const labelSize = Math.round(Math.max(16, Math.min(34, base * 0.04)));

  const numStyle = { ...styles.number, fontSize: numSize };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false, title: '본당 기도 디스플레이' }} />
      <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />

      <View style={styles.content}>
        <View style={styles.spacer} />
        <View style={styles.center}>
          <Text style={[styles.label, { fontSize: labelSize }]}>목양교회 온 성도가 함께</Text>
          <View style={styles.numberRow}>
            <FlipNumber text={hours} style={numStyle} />
            <Text style={[styles.unit, { fontSize: unitSize }]}>시간</Text>
            <FlipNumber text={minutes} style={numStyle} />
            <Text style={[styles.unit, { fontSize: unitSize }]}>분</Text>
          </View>
          <Text style={[styles.label, { fontSize: labelSize }]}>기도하고 있습니다</Text>
        </View>
        <Text style={[styles.verse, { fontSize: Math.round(labelSize * 0.8) }]}>“쉬지 말고 기도하라” · 데살로니가전서 5장 17절</Text>
      </View>

      {/* 전체화면 버튼 (웹) — 평소엔 은은하게, 눌러서 전체화면 켜고/끕니다. */}
      {fsAvailable ? (
        <Pressable
          onPress={toggleFullscreen}
          accessibilityRole="button"
          accessibilityLabel={isFs ? '전체화면 끄기' : '전체화면'}
          style={({ pressed }) => [styles.fsBtn, { opacity: pressed ? 0.9 : 0.4 }]}>
          <Ionicons name={isFs ? 'contract-outline' : 'expand-outline'} size={20} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b2435' },
  overlay: { backgroundColor: 'rgba(8,24,38,0.7)' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: '7%', paddingHorizontal: '6%' },
  spacer: { height: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  label: { fontFamily: Fonts.sans, color: '#dce7ef', fontWeight: '600', textAlign: 'center' },
  numberRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  flipRow: { flexDirection: 'row', alignItems: 'baseline' },
  number: { fontFamily: Fonts.sans, color: GOLD, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: Fonts.sans, color: '#ffffff', fontWeight: '700', marginRight: 10 },
  verse: { fontFamily: Fonts.sans, color: '#cdd9e2', fontWeight: '500', textAlign: 'center', opacity: 0.85 },
  fsBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
