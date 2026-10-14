import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrayerDial } from '@/components/prayer-dial';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dataMode, repository, useAsyncData } from '@/lib/data';
import type { PrayerRequest } from '@/lib/data/types';
import { durationLabel, stackedDuration } from '@/lib/format';
import { usePrayerBgm } from '@/lib/prayer-bgm';
import { useWeeklyGoal } from '@/lib/prayer-goal';
import { useAllPrayerTime, usePrayerTime } from '@/lib/prayer-log';
import { allTimeSeconds, goalLabel, monthSeconds, weekSeconds } from '@/lib/prayer-stats';

/** 기도 시작 버튼에 쓰는 다이얼 이미지 */
const START_IMAGE = require('@/assets/images/prayer-start.png');

type PrayerTime = ReturnType<typeof usePrayerTime>;

/** 나의 기도 — 기도 타이머 + 오늘의 기도 + 개인 기도제목 */
export default function MyPrayerScreen() {
  // 개인 + 공동 참여 시간을 하나로 합쳐 봅니다.
  const active = useAllPrayerTime();
  const { goal } = useWeeklyGoal('personal');

  return (
    <Screen>
      {/* 큰 기도 타이머 — 화면 맨 위, 마치면 결과가 바로 나옵니다 */}
      <TimerCard active={active} goal={goal} />

      {/* 오늘의 기도 — 기도제목을 하나씩 넘기며 기도 */}
      <TodayCard />

      <ThemedText type="caption" themeColor="textMuted" style={{ textAlign: 'center', marginTop: Spacing.one }}>
        기도제목은 ‘기도제목’ 탭에서, 기록·통계는 ‘기도 기록’ 탭에서 볼 수 있어요.
      </ThemedText>
    </Screen>
  );
}

/** 홈의 '오늘의 기도' 진입 카드 — 기도중인 제목 수를 보여 주고 카드덱 기도로 들어갑니다. */
function TodayCard() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const topics = useAsyncData<PrayerRequest[]>(
    () => (dataMode === 'supabase' && !user ? Promise.resolve([]) : repository.listMyPrayerRequests()),
    [user],
  );
  useFocusEffect(topics.reload);
  const pending = (topics.data ?? []).filter((t) => t.status === '기도중').length;

  return (
    <Pressable
      onPress={() => router.push('/prayer/today')}
      style={({ pressed }) => [styles.todayCard, { backgroundColor: theme.primary, opacity: pressed ? 0.92 : 1 }]}>
      <View style={styles.todayIcon}>
        <Ionicons name="sparkles" size={22} color={theme.onPrimary} />
      </View>
      <View style={styles.flex}>
        <ThemedText type="subtitle" style={{ color: theme.onPrimary }}>
          오늘의 기도
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.onPrimary, opacity: 0.85 }}>
          {pending > 0 ? `기도할 제목 ${pending}개를 하나씩 기도해요` : '기도제목을 하나씩 넘기며 기도해요'}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={22} color={theme.onPrimary} />
    </Pressable>
  );
}

// ── 큰 기도 타이머 (맨 위) ───────────────────────────────────────
function TimerCard({ active, goal }: { active: PrayerTime; goal: number }) {
  const { user } = useAuth();
  const bgm = usePrayerBgm();
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const baseRef = useRef(0); // 일시정지까지 누적된 시간(ms)
  const segStartRef = useRef<number | null>(null); // 현재 진행 세그먼트 시작 시각
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [resultSeconds, setResultSeconds] = useState<number | null>(null);

  const currentMs = () => baseRef.current + (segStartRef.current !== null ? Date.now() - segStartRef.current : 0);

  // 전체 화면 기도 중에 함께 볼 '나의 기도제목' (로그인 안 하면 비움)
  const topics = useAsyncData<PrayerRequest[]>(
    () => (dataMode === 'supabase' && !user ? Promise.resolve([]) : repository.listMyPrayerRequests()),
    [user],
  );

  const begin = () => {
    topics.reload();
    baseRef.current = 0;
    segStartRef.current = Date.now();
    setElapsed(0);
    setPaused(false);
    setRunning(true);
    if (bgm.enabled) bgm.start();
  };

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

  const toggleBgm = () => {
    const next = !bgm.enabled;
    bgm.setEnabled(next);
    if (next) bgm.start();
    else bgm.stop();
  };

  useEffect(() => {
    if (!running || paused) return;
    intervalRef.current = setInterval(() => setElapsed(currentMs()), 500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, paused]);

  const stopBgm = bgm.stop;
  useFocusEffect(
    useCallback(() => {
      return () => stopBgm();
    }, [stopBgm]),
  );

  const stop = async () => {
    const secs = Math.round(currentMs() / 1000);
    setRunning(false);
    setPaused(false);
    baseRef.current = 0;
    segStartRef.current = null;
    setElapsed(0);
    bgm.stop();
    if (secs > 0) {
      await active.addMinutes(secs);
      setResultSeconds(secs);
    }
  };

  const seconds = Math.floor(elapsed / 1000);
  const display = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return (
    <Card elevated style={styles.timerCard}>
      {!running ? (
        <>
          <ThemedText type="caption" themeColor="textMuted" style={styles.center}>
            오늘 기도{' '}
            <ThemedText type="smallBold" themeColor="primary">
              {active.todayMinutes > 0 ? durationLabel(active.todayMinutes) : '0분'}
            </ThemedText>
          </ThemedText>
          <Pressable
            onPress={begin}
            accessibilityRole="button"
            accessibilityLabel="기도 시작"
            style={({ pressed }) => [styles.startImageBtn, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
            <Image source={START_IMAGE} style={styles.startImage} contentFit="cover" transition={200} />
          </Pressable>
          <ThemedText type="smallBold" themeColor="primary" style={styles.center}>
            눌러서 기도 시작
          </ThemedText>
        </>
      ) : (
        <ThemedText type="caption" themeColor="textMuted" style={styles.center}>
          기도 중…
        </ThemedText>
      )}

      <PrayerFocusModal
        visible={running}
        display={display}
        elapsedSeconds={seconds}
        paused={paused}
        onPauseToggle={paused ? resume : pause}
        todaySeconds={active.todayMinutes}
        topics={topics.data ?? []}
        onStop={() => void stop()}
        bgmAvailable={bgm.available}
        bgmEnabled={bgm.enabled}
        onToggleBgm={toggleBgm}
      />

      <PrayerResultModal seconds={resultSeconds} onClose={() => setResultSeconds(null)} active={active} goal={goal} />
    </Card>
  );
}

/** 전체 화면 기도 모드 — 큰 타이머 + 나의 기도제목을 보며 집중해서 기도합니다. */
function PrayerFocusModal({
  visible,
  display,
  elapsedSeconds,
  paused,
  onPauseToggle,
  todaySeconds,
  topics,
  onStop,
  bgmAvailable,
  bgmEnabled,
  onToggleBgm,
}: {
  visible: boolean;
  display: string;
  elapsedSeconds: number;
  paused: boolean;
  onPauseToggle: () => void;
  todaySeconds: number;
  topics: PrayerRequest[];
  onStop: () => void;
  bgmAvailable: boolean;
  bgmEnabled: boolean;
  onToggleBgm: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // 기도 중인(응답 전) 제목을 먼저, 응답된 제목을 뒤에 둡니다.
  const ordered = [...topics.filter((t) => !t.answered), ...topics.filter((t) => t.answered)];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onStop}>
      <View
        style={[
          styles.focusRoot,
          {
            backgroundColor: theme.background,
            paddingTop: insets.top + Spacing.three,
            paddingBottom: insets.bottom + Spacing.three,
          },
        ]}>
        <PrayerDial seconds={elapsedSeconds} display={display} paused={paused} />
        <View style={styles.dialMetaRow}>
          <ThemedText type="caption" themeColor="textMuted">
            오늘 누적 {durationLabel(todaySeconds)}
          </ThemedText>
          {bgmAvailable ? (
            <Pressable
              onPress={onToggleBgm}
              hitSlop={8}
              accessibilityRole="switch"
              accessibilityState={{ checked: bgmEnabled }}
              accessibilityLabel="배경음악"
              style={styles.bgmRow}>
              <Ionicons
                name={bgmEnabled ? 'musical-notes' : 'musical-notes-outline'}
                size={16}
                color={bgmEnabled ? theme.primary : theme.textMuted}
              />
              <ThemedText type="caption" themeColor={bgmEnabled ? 'primary' : 'textMuted'}>
                배경음악
              </ThemedText>
              <View style={[styles.bgmTrack, { backgroundColor: bgmEnabled ? theme.primary : theme.border }]}>
                <View style={[styles.bgmThumb, { alignSelf: bgmEnabled ? 'flex-end' : 'flex-start' }]} />
              </View>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.focusTopicsHead}>
          <Ionicons name="flower-outline" size={16} color={theme.primary} />
          <ThemedText type="smallBold" themeColor="primary">
            나의 기도제목
          </ThemedText>
        </View>

        <ScrollView style={styles.focusScroll} contentContainerStyle={styles.focusScrollInner} showsVerticalScrollIndicator={false}>
          {ordered.length === 0 ? (
            <View style={[styles.focusEmpty, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textMuted" style={styles.center}>
                기도제목을 추가하면{'\n'}이곳에서 함께 기도할 수 있어요.
              </ThemedText>
            </View>
          ) : (
            ordered.map((t) => (
              <View key={t.id} style={[styles.focusTopic, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.focusTopicHead}>
                  <ThemedText type="smallBold" style={[styles.flex, t.answered && styles.focusAnswered]} numberOfLines={2}>
                    {t.title}
                  </ThemedText>
                  {t.answered ? <Ionicons name="checkmark-circle" size={16} color={theme.success} /> : null}
                </View>
                {t.body ? (
                  <ThemedText type="small" themeColor="textSecondary" style={t.answered ? styles.focusAnswered : undefined}>
                    {t.body}
                  </ThemedText>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.focusButtonRow}>
          <Pressable
            onPress={onPauseToggle}
            style={({ pressed }) => [styles.pauseBtn, { borderColor: theme.primary, backgroundColor: paused ? theme.primary : 'transparent', opacity: pressed ? 0.85 : 1 }]}>
            <Ionicons name={paused ? 'play' : 'pause'} size={22} color={paused ? theme.onPrimary : theme.primary} />
            <ThemedText type="subtitle" style={{ color: paused ? theme.onPrimary : theme.primary }}>
              {paused ? '이어서' : '일시정지'}
            </ThemedText>
          </Pressable>
          <Pressable onPress={onStop} style={({ pressed }) => [styles.stopBtn, { backgroundColor: theme.accent, opacity: pressed ? 0.9 : 1 }]}>
            <Ionicons name="stop" size={24} color="#fff" />
            <ThemedText type="subtitle" style={{ color: '#fff' }}>
              마치고 기록
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** 기도를 마치면 바로 뜨는 결과 — 이번 기도·오늘·주간·월간·목표 달성률 */
function PrayerResultModal({
  seconds,
  onClose,
  active,
  goal,
}: {
  seconds: number | null;
  onClose: () => void;
  active: PrayerTime;
  goal: number;
}) {
  const theme = useTheme();
  const { user } = useAuth();
  if (seconds === null) return null;

  const who = user?.name ? `${user.name}님의` : '성도의';
  const week = weekSeconds(active.entries);
  const month = monthSeconds(active.entries);
  const total = allTimeSeconds(active.entries);
  const pct = goal > 0 ? Math.min(100, Math.round((week / (goal * 60)) * 100)) : 0;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.resultBackdrop} onPress={onClose}>
        <Pressable style={[styles.resultSheet, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => {}}>
          <View style={[styles.resultCheck, { backgroundColor: theme.success }]}>
            <Ionicons name="checkmark" size={34} color="#fff" />
          </View>
          <ThemedText type="subtitle" style={styles.center}>
            {who} 기도는
          </ThemedText>
          <ThemedText type="subtitle" style={styles.center}>
            결코 헛되지 않습니다
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" style={[styles.center, styles.mt4]}>
            하나님께서 {who} 기도를 기억하십니다.
          </ThemedText>

          <View style={[styles.resultGoalBox, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="caption" themeColor="textMuted">
              이번 주 목표
            </ThemedText>
            <View style={styles.rowBetween}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                {goalLabel(goal)} 대비
              </ThemedText>
              <ThemedText type="subtitle" themeColor="primary">
                {pct}%
              </ThemedText>
            </View>
            <View style={[styles.resultTrack, { backgroundColor: theme.border }]}>
              <View style={[styles.resultFill, { width: `${pct}%`, backgroundColor: theme.accent }]} />
            </View>
          </View>

          <View style={styles.resultStats}>
            <ResultStat label="오늘" value={stackedDuration(active.todayMinutes)} theme={theme} />
            <ResultStat label="이번 주" value={stackedDuration(week)} theme={theme} />
            <ResultStat label="이번 달" value={stackedDuration(month)} theme={theme} />
            <ResultStat label="전체" value={stackedDuration(total)} theme={theme} />
          </View>

          <Button label="확인" icon="checkmark-circle-outline" onPress={onClose} />
          <ThemedText type="caption" themeColor="textMuted" style={[styles.center, styles.mt4]}>
            기도 기록에 저장되었습니다.
          </ThemedText>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ResultStat({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={[styles.resultStat, { borderColor: theme.border }]}>
      <ThemedText type="caption" themeColor="textMuted">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" themeColor="primary" style={[styles.mt4, styles.center]}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', textAlign: 'center' },
  mt4: { marginTop: 4 },

  todayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.large,
    padding: Spacing.four,
  },
  todayIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 큰 기도 타이머
  timerCard: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.four },
  startImageBtn: { width: 220, height: 220, borderRadius: 110, alignSelf: 'center', overflow: 'hidden' },
  startImage: { width: '100%', height: '100%' },

  // 전체 화면 기도 모드
  focusRoot: { flex: 1, paddingHorizontal: Spacing.four, gap: Spacing.two },
  dialMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  bgmRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  bgmTrack: { width: 46, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  bgmThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  focusTopicsHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: Spacing.two },
  focusScroll: { flex: 1 },
  focusScrollInner: { gap: Spacing.two, paddingVertical: Spacing.two },
  focusEmpty: {
    padding: Spacing.five,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  focusTopic: { padding: Spacing.three, borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  focusTopicHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  focusAnswered: { textDecorationLine: 'line-through', opacity: 0.6 },
  focusButtonRow: { flexDirection: 'row', gap: Spacing.two },
  pauseBtn: {
    flex: 1,
    minHeight: 64,
    borderRadius: Radius.large,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  stopBtn: {
    flex: 1.4,
    minHeight: 64,
    borderRadius: Radius.large,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },

  // 결과 모달
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  resultSheet: {
    width: '90%',
    maxWidth: 360,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    alignItems: 'stretch',
    gap: Spacing.two,
  },
  resultCheck: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: Spacing.one },
  resultGoalBox: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.two, marginTop: Spacing.two },
  resultTrack: { height: 10, borderRadius: Radius.pill, overflow: 'hidden' },
  resultFill: { height: '100%', borderRadius: Radius.pill },
  resultStats: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one, marginBottom: Spacing.two },
  resultStat: { flex: 1, alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth },
});
