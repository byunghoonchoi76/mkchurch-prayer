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

// 스플릿-플랩(공항 안내판) 타일 색
const TILE_BG = '#14181d';
const TILE_TOP_BG = '#191e24'; // 윗장은 살짝 밝게 → 입체감
const TILE_BORDER = '#2b343e';
const SPLIT_LINE = '#05070a';
// 웹에서는 안내판 느낌을 살리려 고정폭(monospace) 글꼴을 씁니다.
const DIGIT_FONT = Platform.OS === 'web' ? 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' : Fonts.sans;

/** 누적 초 → "1,284시간 37분" (시 단위 천 단위 콤마) */
function formatTotal(seconds: number): { hours: string; minutes: string } {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return { hours: h.toLocaleString('ko-KR'), minutes: String(m) };
}

/**
 * 스플릿-플랩 한 글자 — 공항·기차역 안내판처럼 윗장이 아래로 '탁' 떨어지며
 * 새 글자로 바뀝니다. (위 절반 정적 + 아래 절반 정적 + 떨어지는 윗장 + 올라오는 아랫장)
 */
function SplitFlapChar({ char, w, h, fontSize }: { char: string; w: number; h: number; fontSize: number }) {
  const [top, setTop] = useState(char); // 위 절반(정적) — 바뀔 때 '새 글자' 윗부분
  const [bottom, setBottom] = useState(char); // 아래 절반(정적) — 아랫장이 덮기 전까진 '옛 글자'
  const [leafTop, setLeafTop] = useState(char); // 떨어지는 윗장 — '옛 글자' 윗부분
  const prevRef = useRef(char);
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (char === prevRef.current) return;
    const old = prevRef.current;
    prevRef.current = char;
    setLeafTop(old);
    setTop(char);
    setBottom(old);
    anim.setValue(0);
    Animated.sequence([
      // 1) 옛 윗장이 중앙선 기준으로 앞으로 떨어짐 (가속)
      Animated.timing(anim, { toValue: 0.5, duration: 140, easing: Easing.in(Easing.quad), useNativeDriver: false }),
      // 2) 새 아랫장이 중앙선에서 내려와 자리 잡음 (감속)
      Animated.timing(anim, { toValue: 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: false }),
    ]).start(() => setBottom(char));
  }, [char, anim]);

  const half = h / 2;
  const topRot = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '-90deg', '-90deg'] });
  const topOpacity = anim.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] });
  const botRot = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['90deg', '90deg', '0deg'] });
  const botOpacity = anim.interpolate({ inputRange: [0, 0.5, 0.51, 1], outputRange: [0, 0, 1, 1] });

  const digitStyle = { height: h, lineHeight: h, width: w, fontSize, ...styles.digit } as const;

  return (
    <View style={[styles.tile, { width: w, height: h, borderRadius: Math.round(w * 0.14) }]}>
      {/* 위 절반 (정적) — 새 글자 윗부분 */}
      <View style={[styles.layerTop, { width: w, height: half }]}>
        <Text style={digitStyle} numberOfLines={1}>{top}</Text>
      </View>
      {/* 아래 절반 (정적) */}
      <View style={[styles.layerBottom, { width: w, height: half }]}>
        <Text style={[digitStyle, { marginTop: -half }]} numberOfLines={1}>{bottom}</Text>
      </View>
      {/* 올라오는 아랫장 — 새 글자 아랫부분 */}
      <Animated.View
        style={[
          styles.layerBottom,
          { width: w, height: half, opacity: botOpacity, transform: [{ perspective: 600 }, { rotateX: botRot }] },
          { transformOrigin: '50% 0%' } as object,
        ]}>
        <Text style={[digitStyle, { marginTop: -half }]} numberOfLines={1}>{char}</Text>
      </Animated.View>
      {/* 떨어지는 윗장 — 옛 글자 윗부분 */}
      <Animated.View
        style={[
          styles.layerTop,
          styles.leafTop,
          { width: w, height: half, opacity: topOpacity, transform: [{ perspective: 600 }, { rotateX: topRot }] },
          { transformOrigin: '50% 100%' } as object,
        ]}>
        <Text style={digitStyle} numberOfLines={1}>{leafTop}</Text>
      </Animated.View>
      {/* 중앙 분할선 */}
      <View pointerEvents="none" style={[styles.split, { top: half - 1, width: w }]} />
    </View>
  );
}

/** 숫자 문자열을 스플릿-플랩 타일로 나열. 콤마(,)는 타일 대신 얇은 구분자로. */
function SplitFlapNumber({ text, w, h, fontSize }: { text: string; w: number; h: number; fontSize: number }) {
  return (
    <View style={[styles.flapRow, { gap: Math.max(3, Math.round(w * 0.09)) }]}>
      {text.split('').map((c, i) =>
        /\d/.test(c) ? (
          <SplitFlapChar key={i} char={c} w={w} h={h} fontSize={fontSize} />
        ) : (
          <Text key={i} style={[styles.sep, { fontSize: Math.round(fontSize * 0.9) }]}>
            {c}
          </Text>
        ),
      )}
    </View>
  );
}

/**
 * 본당 디스플레이 — 온 성도의 누적 기도시간을 공항 안내판(스플릿-플랩) 스타일로 보여 줍니다.
 * 로그인 없이 열리는 공개 화면이라, 본당 입구의 태블릿·TV에서 바로 띄울 수 있습니다.
 * 주소: …/display
 */
export default function PrayerWallDisplay() {
  const { width, height } = useWindowDimensions();
  const church = useAsyncData(() => repository.getChurchPrayerSeconds().catch(() => 0), []);

  // 주기적으로 최신 합계를 가져옵니다. (값이 바뀌면 타일이 플립됩니다)
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

  // 가로/세로, 큰 화면/작은 화면에 맞춰 타일 크기를 조절합니다.
  const landscape = width > height;
  const base = Math.min(width, height);
  // 큰 TV·모니터(32인치+)에서도 시원하게 보이도록 상한을 넉넉히 둡니다.
  // (가로: 화면 높이의 약 22%, 최대 300px / 세로: 약 20%, 최대 120px)
  const fs = Math.round(Math.max(40, Math.min(landscape ? 300 : 120, base * (landscape ? 0.22 : 0.2))));
  const tileW = Math.round(fs * 0.76);
  const tileH = Math.round(fs * 1.2);
  const unitSize = Math.round(fs * 0.42);
  const labelSize = Math.round(Math.max(18, Math.min(56, base * 0.048)));

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
            <SplitFlapNumber text={hours} w={tileW} h={tileH} fontSize={fs} />
            <Text style={[styles.unit, { fontSize: unitSize }]}>시간</Text>
            <SplitFlapNumber text={minutes} w={tileW} h={tileH} fontSize={fs} />
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
  overlay: { backgroundColor: 'rgba(8,24,38,0.74)' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: '7%', paddingHorizontal: '6%' },
  spacer: { height: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  label: { fontFamily: Fonts.sans, color: '#dce7ef', fontWeight: '600', textAlign: 'center' },
  numberRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  flapRow: { flexDirection: 'row', alignItems: 'center' },
  unit: { fontFamily: Fonts.sans, color: '#ffffff', fontWeight: '700', marginRight: 6 },
  sep: { fontFamily: DIGIT_FONT, color: GOLD, fontWeight: '800', alignSelf: 'flex-end', marginBottom: '6%' },

  // 스플릿-플랩 타일
  tile: {
    position: 'relative',
    backgroundColor: TILE_BG,
    borderWidth: 1,
    borderColor: TILE_BORDER,
    overflow: 'hidden',
  },
  layerTop: { position: 'absolute', top: 0, left: 0, overflow: 'hidden', alignItems: 'center', backgroundColor: TILE_TOP_BG },
  layerBottom: { position: 'absolute', bottom: 0, left: 0, overflow: 'hidden', alignItems: 'center', backgroundColor: TILE_BG },
  leafTop: { backfaceVisibility: 'hidden' },
  digit: {
    textAlign: 'center',
    color: GOLD,
    fontWeight: '800',
    fontFamily: DIGIT_FONT,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  split: { position: 'absolute', left: 0, height: 2, backgroundColor: SPLIT_LINE },

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
