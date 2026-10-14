import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrayerDial } from '@/components/prayer-dial';
import { CategoryChip } from '@/components/prayer-meta';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, LoadingState } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dataMode, repository } from '@/lib/data';
import type { PrayerRequest } from '@/lib/data/types';
import { durationLabel } from '@/lib/format';
import { usePrayerBgm } from '@/lib/prayer-bgm';
import { usePrayerTime } from '@/lib/prayer-log';

type Phase = 'loading' | 'signin' | 'empty' | 'praying' | 'done';

/**
 * 오늘의 기도 — '기도중' 상태인 나의 기도제목을 한 장씩 넘기며 집중해서 기도합니다.
 * 제목마다 타이머가 돌고, '아멘'을 누르면 그 시간이 기록되고 다음 제목으로 넘어갑니다.
 */
export default function TodayPrayerScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const bgm = usePrayerBgm();
  const personal = usePrayerTime('personal');

  const [phase, setPhase] = useState<Phase>('loading');
  const [topics, setTopics] = useState<PrayerRequest[]>([]);
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0); // 현재 제목 경과(ms)
  const [paused, setPaused] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [prayedCount, setPrayedCount] = useState(0);

  const baseRef = useRef(0); // 일시정지까지 누적(ms)
  const segStartRef = useRef<number | null>(null); // 현재 세그먼트 시작 시각
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentMs = () => baseRef.current + (segStartRef.current !== null ? Date.now() - segStartRef.current : 0);

  const startSegment = useCallback(() => {
    baseRef.current = 0;
    segStartRef.current = Date.now();
    setElapsed(0);
    setPaused(false);
  }, []);

  // 처음 들어오면 나의 '기도중' 제목을 불러와 바로 시작합니다.
  useEffect(() => {
    let active = true;
    if (dataMode === 'supabase' && !user) {
      setPhase('signin');
      return;
    }
    repository
      .listMyPrayerRequests()
      .then((list) => {
        if (!active) return;
        const deck = list.filter((t) => t.status === '기도중');
        setTopics(deck);
        if (deck.length === 0) {
          setPhase('empty');
          return;
        }
        setPhase('praying');
        startSegment();
        if (bgm.enabled) bgm.start();
      })
      .catch(() => active && setPhase('empty'));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // 타이머 틱
  useEffect(() => {
    if (phase !== 'praying' || paused) return;
    intervalRef.current = setInterval(() => setElapsed(currentMs()), 500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase, paused, index]);

  // 화면을 벗어나면 배경음을 멈춥니다.
  const stopBgm = bgm.stop;
  useFocusEffect(
    useCallback(() => {
      return () => stopBgm();
    }, [stopBgm]),
  );

  const recordCurrent = useCallback(async () => {
    const secs = Math.round(currentMs() / 1000);
    if (secs > 0) {
      setTotalSeconds((t) => t + secs);
      setPrayedCount((c) => c + 1);
      try {
        await personal.addMinutes(secs);
      } catch {
        /* 기록 실패해도 흐름은 이어 갑니다. */
      }
    }
    return secs;
  }, [personal]);

  const pause = () => {
    if (segStartRef.current !== null) {
      baseRef.current += Date.now() - segStartRef.current;
      segStartRef.current = null;
    }
    setElapsed(baseRef.current);
    setPaused(true);
    bgm.stop();
  };
  const resume = () => {
    segStartRef.current = Date.now();
    setPaused(false);
    if (bgm.enabled) bgm.start();
  };

  // 아멘 — 이 제목 기도를 마치고 다음 제목으로.
  const amen = async () => {
    await recordCurrent();
    const next = index + 1;
    if (next >= topics.length) {
      bgm.stop();
      setPhase('done');
      return;
    }
    setIndex(next);
    startSegment();
    if (bgm.enabled && !paused) bgm.start();
  };

  // 그만하기 — 현재까지 기도한 시간을 기록하고 마칩니다.
  const finishEarly = async () => {
    await recordCurrent();
    bgm.stop();
    setPhase('done');
  };

  const toggleBgm = () => {
    const nextOn = !bgm.enabled;
    bgm.setEnabled(nextOn);
    if (nextOn && !paused && phase === 'praying') bgm.start();
    else bgm.stop();
  };

  // ── 화면 분기 ──────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <Screen>
        <LoadingState message="오늘의 기도를 준비하고 있어요…" />
      </Screen>
    );
  }

  if (phase === 'signin') {
    return (
      <Screen>
        <Card>
          <EmptyState icon="lock-closed-outline" message="로그인하면 나의 기도제목으로 오늘의 기도를 할 수 있어요." />
          <Button label="로그인하기" icon="log-in-outline" onPress={() => router.replace('/sign-in')} />
        </Card>
      </Screen>
    );
  }

  if (phase === 'empty') {
    return (
      <Screen>
        <Card>
          <EmptyState icon="flower-outline" message={'기도할 제목이 없어요.\n기도제목을 추가하면 이곳에서 하나씩 기도할 수 있어요.'} />
          <Button label="기도제목 추가" icon="add" onPress={() => router.replace('/prayer/new')} />
        </Card>
      </Screen>
    );
  }

  if (phase === 'done') {
    return (
      <Screen>
        <Card elevated style={styles.doneCard}>
          <View style={[styles.doneCheck, { backgroundColor: theme.success }]}>
            <Ionicons name="checkmark" size={34} color="#fff" />
          </View>
          <ThemedText type="subtitle" style={styles.center}>
            오늘의 기도를 마쳤어요
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
            {user?.name ? `${user.name}님, ` : ''}
            {prayedCount}개의 기도제목을 위해 기도했어요.
          </ThemedText>
          <View style={[styles.doneStat, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="caption" themeColor="textMuted">
              이번 기도 시간
            </ThemedText>
            <ThemedText type="title" themeColor="primary">
              {durationLabel(totalSeconds)}
            </ThemedText>
          </View>
          <ThemedText type="caption" themeColor="textMuted" style={[styles.center, styles.mt4]}>
            하나님께서 {user?.name ? `${user.name}님의` : '성도의'} 기도를 기억하십니다.
          </ThemedText>
          <Button label="기도 통계 보기" icon="stats-chart-outline" variant="secondary" onPress={() => router.replace('/prayer/stats')} />
          <Button label="홈으로" icon="home-outline" variant="ghost" onPress={() => router.back()} />
        </Card>
      </Screen>
    );
  }

  // phase === 'praying'
  const topic = topics[index];
  const seconds = Math.floor(elapsed / 1000);
  const display = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <Screen scroll={false}>
      <View style={styles.prayRoot}>
        {/* 진행률 */}
        <View style={styles.progressHead}>
          <View style={styles.progressTextRow}>
            <ThemedText type="smallBold" themeColor="primary">
              오늘의 기도
            </ThemedText>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {index + 1} / {topics.length}
            </ThemedText>
          </View>
          {bgm.available ? (
            <Pressable onPress={toggleBgm} hitSlop={8} accessibilityLabel="배경음악" style={styles.bgmBtn}>
              <Ionicons
                name={bgm.enabled ? 'musical-notes' : 'musical-notes-outline'}
                size={18}
                color={bgm.enabled ? theme.primary : theme.textMuted}
              />
            </Pressable>
          ) : null}
        </View>
        <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
          <View style={[styles.progressFill, { width: `${((index + 1) / topics.length) * 100}%`, backgroundColor: theme.accent }]} />
        </View>

        {/* 다이얼 */}
        <PrayerDial seconds={seconds} display={display} paused={paused} size={240} />

        {/* 현재 기도제목 */}
        <View style={[styles.topicBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.topicMeta}>
            <CategoryChip category={topic.category} />
          </View>
          <ThemedText type="subtitle" style={styles.center}>
            {topic.title}
          </ThemedText>
          {topic.body ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {topic.body}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.flexSpacer} />

        {/* 버튼 */}
        <View style={styles.btnRow}>
          <Pressable
            onPress={paused ? resume : pause}
            style={({ pressed }) => [styles.pauseBtn, { borderColor: theme.primary, backgroundColor: paused ? theme.primary : 'transparent', opacity: pressed ? 0.85 : 1 }]}>
            <Ionicons name={paused ? 'play' : 'pause'} size={20} color={paused ? theme.onPrimary : theme.primary} />
            <ThemedText type="subtitle" style={{ color: paused ? theme.onPrimary : theme.primary }}>
              {paused ? '이어서' : '일시정지'}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => void amen()}
            style={({ pressed }) => [styles.amenBtn, { backgroundColor: theme.accent, opacity: pressed ? 0.9 : 1 }]}>
            <Ionicons name="checkmark" size={24} color="#fff" />
            <ThemedText type="subtitle" style={{ color: '#fff' }}>
              {index + 1 >= topics.length ? '아멘 · 마치기' : '아멘 · 다음'}
            </ThemedText>
          </Pressable>
        </View>
        <Pressable onPress={() => void finishEarly()} hitSlop={8} style={styles.quitBtn}>
          <ThemedText type="caption" themeColor="textMuted" style={styles.underline}>
            여기까지 하고 마치기
          </ThemedText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  mt4: { marginTop: 4 },
  underline: { textDecorationLine: 'underline' },

  prayRoot: { flex: 1, alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  progressHead: { flexDirection: 'row', alignItems: 'center', width: '100%', gap: Spacing.two },
  progressTextRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bgmBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 8, borderRadius: Radius.pill, width: '100%', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.pill },

  topicBox: {
    width: '100%',
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.two,
    alignItems: 'center',
  },
  topicMeta: { flexDirection: 'row', justifyContent: 'center' },
  flexSpacer: { flex: 1 },

  btnRow: { flexDirection: 'row', gap: Spacing.two, width: '100%' },
  pauseBtn: {
    flex: 1,
    minHeight: 60,
    borderRadius: Radius.large,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  amenBtn: {
    flex: 1.4,
    minHeight: 60,
    borderRadius: Radius.large,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  quitBtn: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },

  doneCard: { alignItems: 'stretch', gap: Spacing.two, paddingVertical: Spacing.four },
  doneCheck: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: Spacing.one },
  doneStat: { borderRadius: Radius.medium, padding: Spacing.three, alignItems: 'center', gap: 2, marginTop: Spacing.two },
});
