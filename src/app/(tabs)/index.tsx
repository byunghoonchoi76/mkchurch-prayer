import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrayerDial } from '@/components/prayer-dial';
import { CategoryChip } from '@/components/prayer-meta';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dataMode, repository, useAsyncData } from '@/lib/data';
import type { CommunalPrayer, PrayerCategory, PrayerRequest } from '@/lib/data/types';
import { durationLabel, stackedDuration } from '@/lib/format';
import { usePrayerBgm } from '@/lib/prayer-bgm';
import { TODAY_PRAYER_OPTIONS, useTodayPrayerKind, type TodayPrayerKind } from '@/lib/today-prayer';
import { useWeeklyGoal } from '@/lib/prayer-goal';
import { useAllPrayerTime, usePrayerTime } from '@/lib/prayer-log';
import { allTimeSeconds, goalLabel, monthSeconds, weekSeconds } from '@/lib/prayer-stats';

/** 기도 시작 버튼에 쓰는 다이얼 이미지 */
const START_IMAGE = require('@/assets/images/prayer-start.png');

/** 전체 화면 기도 모드에서 기도제목이 다음으로 넘어가는 간격(ms) */
const TOPIC_ROTATE_MS = 8000;

type PrayerTime = ReturnType<typeof usePrayerTime>;

/** '오늘의 기도'에서 돌려 가며 보여 주는 한 장(개인·공동·중보 공통 모양). */
type FocusTopic = { id: string; title: string; body: string; category?: PrayerCategory; answered?: boolean };

const requestToTopic = (r: PrayerRequest): FocusTopic => ({
  id: r.id,
  title: r.title,
  body: r.body,
  category: r.category,
  answered: r.answered,
});
const communalToTopic = (c: CommunalPrayer): FocusTopic => ({ id: c.id, title: c.title, body: c.body });

/** 선택한 종류에 맞는 기도제목 목록을 불러옵니다. */
function loadTopics(kind: TodayPrayerKind): Promise<FocusTopic[]> {
  if (kind === 'communal') return repository.listCommunalPrayers().then((xs) => xs.map(communalToTopic));
  if (kind === 'intercession') return repository.listSharedPrayerRequests().then((xs) => xs.map(requestToTopic));
  return repository.listMyPrayerRequests().then((xs) => xs.map(requestToTopic));
}

/** 목록이 비었을 때 안내 문구 — 종류별로 다르게. */
const EMPTY_MESSAGE: Record<TodayPrayerKind, string> = {
  personal: '개인 기도제목을 추가하면\n이곳에서 함께 기도할 수 있어요.',
  communal: '등록된 공동 기도제목이 없어요.',
  intercession: '등록된 중보기도제목이 없어요.',
};

/** 기도하기 — 기도 타이머. 다이얼을 누르면 전체 화면 기도 모드로 들어갑니다. */
export default function MyPrayerScreen() {
  // 개인 + 공동 참여 시간을 하나로 합쳐 봅니다.
  const active = useAllPrayerTime();
  const { goal } = useWeeklyGoal('personal');

  return (
    <Screen scroll={false} contentStyle={styles.homeCenter}>
      {/* 큰 기도 타이머 — 화면 세로 중앙 */}
      <TimerCard active={active} goal={goal} />

      <ThemedText type="caption" themeColor="textMuted" style={styles.homeNote}>
        기도제목은 ‘기도제목’ 탭에서, 기록·통계는 ‘기도 기록’ 탭에서 볼 수 있어요.
      </ThemedText>
    </Screen>
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

  // 사용자가 고른 '오늘의 기도' 종류(개인·공동·중보). 기기에 저장되어 다음에도 유지됩니다.
  const { kind, setKind } = useTodayPrayerKind();

  const currentMs = () => baseRef.current + (segStartRef.current !== null ? Date.now() - segStartRef.current : 0);

  // 전체 화면 기도 중에 함께 볼 기도제목 — 고른 종류에 따라 바뀝니다. (로그인 필요한 경우 비움)
  const topics = useAsyncData<FocusTopic[]>(
    () => (dataMode === 'supabase' && !user ? Promise.resolve([]) : loadTopics(kind)),
    [user, kind],
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
        kind={kind}
        onKindChange={setKind}
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
  kind,
  onKindChange,
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
  topics: FocusTopic[];
  kind: TodayPrayerKind;
  onKindChange: (kind: TodayPrayerKind) => void;
  onStop: () => void;
  bgmAvailable: boolean;
  bgmEnabled: boolean;
  onToggleBgm: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // 기도 중인(응답 전) 제목을 먼저, 응답된 제목을 뒤에 둡니다.
  const ordered = [...topics.filter((t) => !t.answered), ...topics.filter((t) => t.answered)];

  // 기도제목을 일정 시간마다 한 장씩 자동으로 넘겨 가며 보여 줍니다.
  const [topicIdx, setTopicIdx] = useState(0);
  const count = ordered.length;

  // 기도 모드가 열릴 때, 또 종류를 바꿀 때 처음 제목부터 시작합니다.
  useEffect(() => {
    if (visible) setTopicIdx(0);
  }, [visible, kind]);

  // 일정 시간(TOPIC_ROTATE_MS)마다 다음 제목으로. 일시정지 중에는 멈춥니다.
  useEffect(() => {
    if (!visible || paused || count <= 1) return;
    const t = setInterval(() => setTopicIdx((i) => (i + 1) % count), TOPIC_ROTATE_MS);
    return () => clearInterval(t);
  }, [visible, paused, count]);

  const pos = count ? topicIdx % count : 0;
  const current = count ? ordered[pos] : null;

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
          <ThemedText type="caption" themeColor="textMuted" fixed>
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
              <ThemedText type="caption" themeColor={bgmEnabled ? 'primary' : 'textMuted'} fixed>
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
          <ThemedText type="smallBold" themeColor="primary" fixed>
            오늘의 기도
          </ThemedText>
          {count > 1 ? (
            <ThemedText type="caption" themeColor="textMuted" fixed>
              {pos + 1} / {count}
            </ThemedText>
          ) : null}
        </View>

        {/* 개인 · 공동 · 중보 중에서 골라 봅니다. (고른 종류는 저장되어 다음에도 유지) */}
        <View style={[styles.kindSegment, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          {TODAY_PRAYER_OPTIONS.map((o) => {
            const sel = o.kind === kind;
            return (
              <Pressable
                key={o.kind}
                onPress={() => onKindChange(o.kind)}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
                style={[styles.kindItem, sel && { backgroundColor: theme.primary + '22', borderColor: theme.primary }]}>
                <ThemedText type="caption" fixed numberOfLines={1} style={{ color: sel ? theme.primary : theme.textMuted, fontWeight: sel ? '800' : '600' }}>
                  {o.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.focusTopicArea}>
          {current ? (
            <Pressable
              onPress={() => count > 1 && setTopicIdx((i) => (i + 1) % count)}
              style={[styles.focusTopicCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {current.category || current.answered ? (
                <View style={styles.focusTopicMeta}>
                  {current.category ? <CategoryChip category={current.category} /> : null}
                  {current.answered ? <Ionicons name="checkmark-circle" size={16} color={theme.success} /> : null}
                </View>
              ) : null}
              <ThemedText type="subtitle" style={[styles.center, current.answered && styles.focusAnswered]}>
                {current.title}
              </ThemedText>
              {current.body ? (
                <ThemedText type="small" themeColor="textSecondary" style={[styles.center, current.answered && styles.focusAnswered]}>
                  {current.body}
                </ThemedText>
              ) : null}
            </Pressable>
          ) : (
            <View style={[styles.focusEmpty, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textMuted" style={styles.center}>
                {EMPTY_MESSAGE[kind]}
              </ThemedText>
            </View>
          )}

          {count > 1 ? (
            <View style={styles.dotsRow}>
              {ordered.map((t, i) => (
                <View key={t.id} style={[styles.dot, { backgroundColor: i === pos ? theme.primary : theme.border }]} />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.focusButtonRow}>
          <Pressable
            onPress={onPauseToggle}
            style={({ pressed }) => [styles.pauseBtn, { borderColor: theme.primary, backgroundColor: paused ? theme.primary : 'transparent', opacity: pressed ? 0.85 : 1 }]}>
            <Ionicons name={paused ? 'play' : 'pause'} size={22} color={paused ? theme.onPrimary : theme.primary} />
            <ThemedText type="subtitle" fixed numberOfLines={1} style={{ color: paused ? theme.onPrimary : theme.primary }}>
              {paused ? '이어서' : '일시정지'}
            </ThemedText>
          </Pressable>
          <Pressable onPress={onStop} style={({ pressed }) => [styles.stopBtn, { backgroundColor: theme.accent, opacity: pressed ? 0.9 : 1 }]}>
            <Ionicons name="checkmark" size={24} color="#fff" />
            <ThemedText type="subtitle" fixed numberOfLines={1} style={{ color: '#fff' }}>
              아멘
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

  // 기도하기 홈 — 다이얼을 세로 중앙에, 안내 문구는 왼쪽 맞춤
  homeCenter: { justifyContent: 'center' },
  homeNote: { textAlign: 'left', marginTop: Spacing.two },

  // 큰 기도 타이머
  timerCard: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.four },
  startImageBtn: { width: 220, height: 220, borderRadius: 110, alignSelf: 'center', overflow: 'hidden' },
  startImage: { width: '100%', height: '100%' },

  // 전체 화면 기도 모드
  focusRoot: { flex: 1, paddingHorizontal: Spacing.four, gap: Spacing.two },
  dialMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', rowGap: Spacing.one },
  bgmRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  bgmTrack: { width: 46, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  bgmThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  focusTopicsHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: Spacing.two },
  kindSegment: {
    flexDirection: 'row',
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    gap: 3,
    marginTop: Spacing.one,
  },
  kindItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  focusTopicArea: { flex: 1, justifyContent: 'center', gap: Spacing.three },
  focusTopicCard: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.two,
    alignItems: 'center',
  },
  focusTopicMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  focusEmpty: {
    padding: Spacing.five,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
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
