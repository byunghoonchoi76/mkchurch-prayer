import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeroBanner } from '@/components/hero-banner';
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
import {
  isCategoryAll,
  TODAY_PRAYER_LABEL,
  TODAY_PRAYER_ORDER,
  toggleCategoryAll,
  toggleId,
  useTodaySelection,
  type TodayPrayerKind,
  type TodaySelection,
} from '@/lib/today-prayer';
import { useWeeklyGoal } from '@/lib/prayer-goal';
import { useAllPrayerTime, usePrayerTime } from '@/lib/prayer-log';
import { allTimeSeconds, goalLabel, monthSeconds, weekSeconds } from '@/lib/prayer-stats';

/** 기도 시작 버튼에 쓰는 다이얼 이미지 */
const START_IMAGE = require('@/assets/images/prayer-start.png');
/** 기도하기 홈 상단 배너 이미지 (등대 — 빛·인도) */
const HOME_HERO = require('@/assets/images/prayer-home-hero.jpg');

/** 전체 화면 기도 모드에서 기도제목이 다음으로 넘어가는 간격(ms) */
const TOPIC_ROTATE_MS = 8000;

type PrayerTime = ReturnType<typeof usePrayerTime>;

/** '오늘의 기도'에서 돌려 가며 보여 주는 한 장(개인·공동·중보 공통 모양). */
type FocusTopic = { id: string; title: string; body: string; kind: TodayPrayerKind; category?: PrayerCategory; answered?: boolean };

/** 카테고리별 기도제목 묶음. */
type TopicsByKind = Record<TodayPrayerKind, FocusTopic[]>;
const EMPTY_BY_KIND: TopicsByKind = { personal: [], communal: [], intercession: [] };

const requestToTopic =
  (kind: TodayPrayerKind) =>
  (r: PrayerRequest): FocusTopic => ({
    id: r.id,
    title: r.title,
    body: r.body,
    kind,
    category: r.category,
    answered: r.answered,
  });
const communalToTopic = (c: CommunalPrayer): FocusTopic => ({ id: c.id, title: c.title, body: c.body, kind: 'communal' });

/** 개인·공동·중보 기도제목을 한꺼번에 불러옵니다. */
async function loadAllTopics(): Promise<TopicsByKind> {
  const [personal, communal, intercession] = await Promise.all([
    repository.listMyPrayerRequests(),
    repository.listCommunalPrayers(),
    repository.listSharedPrayerRequests(),
  ]);
  return {
    personal: personal.map(requestToTopic('personal')),
    communal: communal.map(communalToTopic),
    intercession: intercession.map(requestToTopic('intercession')),
  };
}

/** 선택(전체 카테고리 + 개별 ID)에 맞는 기도제목만 순서대로 모읍니다. */
function selectedTopics(byKind: TopicsByKind, sel: TodaySelection): FocusTopic[] {
  const out: FocusTopic[] = [];
  for (const kind of TODAY_PRAYER_ORDER) {
    const list = byKind[kind] ?? [];
    if (sel.allCategories.includes(kind)) out.push(...list);
    else out.push(...list.filter((t) => sel.selectedIds.includes(t.id)));
  }
  return out;
}

/** 기도하기 — 기도 타이머. 다이얼을 누르면 전체 화면 기도 모드로 들어갑니다. */
export default function MyPrayerScreen() {
  // 개인 + 공동 참여 시간을 하나로 합쳐 봅니다.
  const active = useAllPrayerTime();
  const { goal } = useWeeklyGoal('personal');

  return (
    <Screen scroll={false} contentStyle={styles.home}>
      {/* 상단 배너 — 등대의 빛(인도·소망) */}
      <HeroBanner imageSource={HOME_HERO} height={168}>
        <ThemedText style={styles.heroTitle}>주는 나의 빛, 나의 구원</ThemedText>
        <ThemedText style={styles.heroSubtitle}>오늘도 기도로 하루를 밝혀요 · 시편 27:1</ThemedText>
      </HeroBanner>

      {/* 큰 기도 타이머 — 남은 공간의 세로 중앙 */}
      <View style={styles.homeBody}>
        <TimerCard active={active} goal={goal} />
        <ThemedText type="caption" themeColor="textMuted" style={styles.homeNote}>
          기도제목과 기록은 아래 탭에서 볼 수 있어요.
        </ThemedText>
      </View>
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

  // 사용자가 고른 '오늘의 기도' 선택(전체 카테고리 + 개별 제목). 기기에 저장되어 유지됩니다.
  const { selection, setSelection } = useTodaySelection();

  const currentMs = () => baseRef.current + (segStartRef.current !== null ? Date.now() - segStartRef.current : 0);

  // 개인·공동·중보 기도제목을 모두 불러와, 고른 선택에 맞게 보여 줍니다. (로그인 필요한 경우 비움)
  const topics = useAsyncData<TopicsByKind>(
    () => (dataMode === 'supabase' && !user ? Promise.resolve(EMPTY_BY_KIND) : loadAllTopics()),
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
        byKind={topics.data ?? EMPTY_BY_KIND}
        selection={selection}
        onChangeSelection={setSelection}
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
  byKind,
  selection,
  onChangeSelection,
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
  byKind: TopicsByKind;
  selection: TodaySelection;
  onChangeSelection: (sel: TodaySelection) => void;
  onStop: () => void;
  bgmAvailable: boolean;
  bgmEnabled: boolean;
  onToggleBgm: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [pickerOpen, setPickerOpen] = useState(false);

  // 고른 선택에 맞는 기도제목만 모읍니다. (기도 중인 제목 먼저, 응답된 제목은 뒤)
  const chosen = selectedTopics(byKind, selection);
  const ordered = [...chosen.filter((t) => !t.answered), ...chosen.filter((t) => t.answered)];

  // 기도제목을 일정 시간마다 한 장씩 자동으로 넘겨 가며 보여 줍니다.
  const [topicIdx, setTopicIdx] = useState(0);
  const count = ordered.length;
  const selectionKey = `${selection.allCategories.join(',')}|${selection.selectedIds.join(',')}`;

  // 기도 모드가 열릴 때, 또 선택을 바꿀 때 처음 제목부터 시작합니다.
  useEffect(() => {
    if (visible) setTopicIdx(0);
  }, [visible, selectionKey]);

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
          {count > 0 ? (
            <ThemedText type="caption" themeColor="textMuted" fixed>
              {count > 1 ? `${pos + 1} / ${count}` : `${count}`}
            </ThemedText>
          ) : null}
          <View style={styles.flex} />
          {/* 개인·공동·중보 카테고리 전체, 또는 원하는 기도제목만 골라요. (선택은 저장돼 유지) */}
          <Pressable
            onPress={() => setPickerOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="기도제목 선택"
            style={({ pressed }) => [styles.pickBtn, { borderColor: theme.primary + '55', opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="options-outline" size={15} color={theme.primary} />
            <ThemedText type="caption" themeColor="primary" fixed numberOfLines={1}>
              선택
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.focusTopicArea}>
          {current ? (
            <Pressable
              onPress={() => count > 1 && setTopicIdx((i) => (i + 1) % count)}
              style={[styles.focusTopicCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.focusTopicMeta}>
                <View style={[styles.kindBadge, { backgroundColor: theme.primary + '18', borderColor: theme.primary + '40' }]}>
                  <ThemedText type="caption" fixed style={{ color: theme.primary, fontWeight: '700' }}>
                    {TODAY_PRAYER_LABEL[current.kind].long}
                  </ThemedText>
                </View>
                {current.category ? <CategoryChip category={current.category} /> : null}
                {current.answered ? <Ionicons name="checkmark-circle" size={16} color={theme.success} /> : null}
              </View>
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
                표시할 기도제목이 없어요.{'\n'}‘선택’에서 기도제목을 골라 보세요.
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

        <TodayPrayerPicker
          visible={pickerOpen}
          byKind={byKind}
          selection={selection}
          onChange={onChangeSelection}
          onClose={() => setPickerOpen(false)}
        />
      </View>
    </Modal>
  );
}

/** '오늘의 기도' 고르기 — 카테고리 전체, 또는 원하는 기도제목만 선택합니다. */
function TodayPrayerPicker({
  visible,
  byKind,
  selection,
  onChange,
  onClose,
}: {
  visible: boolean;
  byKind: TopicsByKind;
  selection: TodaySelection;
  onChange: (sel: TodaySelection) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const total = selectedTopics(byKind, selection).length;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.pickerBackdrop}>
        <View
          style={[
            styles.pickerSheet,
            { backgroundColor: theme.background, borderColor: theme.border, paddingBottom: insets.bottom + Spacing.three },
          ]}>
          <View style={styles.pickerHead}>
            <ThemedText type="heading">오늘의 기도 선택</ThemedText>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="닫기">
              <Ionicons name="close" size={24} color={theme.textMuted} />
            </Pressable>
          </View>
          <ThemedText type="caption" themeColor="textMuted" style={styles.pickerHint}>
            카테고리 ‘전체’를 켜거나, 원하는 기도제목만 골라 보세요. 기도하기에서 이 제목들이 번갈아 나옵니다.
          </ThemedText>

          <ScrollView style={styles.pickerScroll} contentContainerStyle={styles.pickerScrollBody}>
            {TODAY_PRAYER_ORDER.map((kind) => {
              const list = byKind[kind] ?? [];
              const all = isCategoryAll(selection, kind);
              // 공동 기도제목은 '전체'만 — 개별 선택 없이 모두 함께 표시합니다.
              const allowIndividual = kind !== 'communal';
              return (
                <View key={kind} style={styles.pickerGroup}>
                  {/* 카테고리 헤더 + 켜고 끄기 ('전체' 토글) */}
                  <Pressable
                    onPress={() => onChange(toggleCategoryAll(selection, kind))}
                    style={[styles.pickerGroupHead, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
                    <View style={styles.flexRow}>
                      <Ionicons
                        name={all ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={all ? theme.primary : theme.textMuted}
                      />
                      <ThemedText type="smallBold" numberOfLines={1} style={styles.flexShrink}>
                        {TODAY_PRAYER_LABEL[kind].long}
                      </ThemedText>
                      {allowIndividual ? (
                        <View style={[styles.pickerAllTag, { backgroundColor: all ? theme.primary : theme.border }]}>
                          <ThemedText type="caption" fixed style={{ color: all ? theme.onPrimary : theme.textMuted, fontWeight: '700' }}>
                            전체
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                    <ThemedText type="caption" themeColor="textMuted" fixed>
                      {list.length}개
                    </ThemedText>
                  </Pressable>

                  {/* 개인·중보: '전체'가 아니면 원하는 제목만 고릅니다. (공동은 개별 선택 없음) */}
                  {allowIndividual && !all
                    ? list.length === 0
                      ? (
                        <ThemedText type="caption" themeColor="textMuted" style={styles.pickerEmpty}>
                          기도제목이 없어요.
                        </ThemedText>
                      )
                      : list.map((t) => {
                          const on = selection.selectedIds.includes(t.id);
                          return (
                            <Pressable key={t.id} onPress={() => onChange(toggleId(selection, t.id))} style={styles.pickerItem}>
                              <Ionicons
                                name={on ? 'checkbox' : 'square-outline'}
                                size={20}
                                color={on ? theme.primary : theme.textMuted}
                              />
                              <ThemedText type="small" numberOfLines={2} style={styles.flex}>
                                {t.title}
                              </ThemedText>
                            </Pressable>
                          );
                        })
                    : null}
                </View>
              );
            })}
          </ScrollView>

          <Button label={total > 0 ? `완료 (${total}개)` : '완료'} icon="checkmark-circle-outline" onPress={onClose} />
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
  flexShrink: { flexShrink: 1 },
  center: { alignItems: 'center', textAlign: 'center' },
  mt4: { marginTop: 4 },

  // 기도하기 홈 — 상단 배너 + 남은 공간에 다이얼 중앙, 안내 문구는 왼쪽 맞춤
  home: { gap: Spacing.three },
  homeBody: { flex: 1, justifyContent: 'center', gap: Spacing.three },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    marginTop: 3,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  homeNote: { textAlign: 'center', marginTop: Spacing.two },

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
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  kindBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  focusTopicArea: { flex: 1, justifyContent: 'center', gap: Spacing.three },
  focusTopicCard: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.two,
    alignItems: 'center',
  },
  focusTopicMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: Spacing.two },

  // '오늘의 기도 고르기' 시트
  flexRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flex: 1 },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerSheet: {
    maxHeight: '86%',
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.two,
  },
  pickerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerHint: { marginBottom: Spacing.one },
  pickerScroll: { flexGrow: 0 },
  pickerScrollBody: { gap: Spacing.three, paddingBottom: Spacing.two },
  pickerGroup: { gap: Spacing.one },
  pickerGroupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pickerAllTag: { paddingHorizontal: Spacing.two, paddingVertical: 1, borderRadius: Radius.pill },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two, paddingLeft: Spacing.two },
  pickerEmpty: { paddingVertical: Spacing.two, paddingLeft: Spacing.three },
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
  resultStats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one, marginBottom: Spacing.two },
  resultStat: { flexGrow: 1, flexBasis: '46%', minWidth: 72, alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth },
});
