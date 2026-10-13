import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ListRow, SectionHeader } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dataMode, repository, useAsyncData } from '@/lib/data';
import type { PrayerLogEntry, PrayerRequest } from '@/lib/data/types';
import { durationLabel, stackedDuration } from '@/lib/format';
import { toDateKey } from '@/lib/format';
import { usePrayerBgm } from '@/lib/prayer-bgm';
import { GOAL_CONFIG, useWeeklyGoal } from '@/lib/prayer-goal';
import { recentDays, useAllPrayerTime, usePrayerTime } from '@/lib/prayer-log';

const WEEKDAY_LABEL = ['일', '월', '화', '수', '목', '금', '토'];

/** 기도 시작 버튼에 쓰는 다이얼 이미지 */
const START_IMAGE = require('@/assets/images/prayer-start.png');

type PrayerTime = ReturnType<typeof usePrayerTime>;

export default function PrayerScreen() {
  const router = useRouter();
  // 개인 + 공동 참여 시간을 하나로 합쳐 봅니다.
  const active = useAllPrayerTime();
  const { goal, setGoal } = useWeeklyGoal('personal');

  return (
    <Screen>
      {/* 큰 기도 타이머 — 화면 맨 위, 마치면 결과가 바로 나옵니다 */}
      <TimerCard active={active} goal={goal} />

      <GaugeCard active={active} goal={goal} onGoal={setGoal} />
      <CalendarCard active={active} />
      <AverageCard active={active} />

      <TopicsCard />

      <Card>
        <ListRow
          icon="notifications-outline"
          title="기도 알림"
          subtitle="정한 요일·시간에 기도 알림을 받아요"
          onPress={() => router.push('/reminders')}
        />
      </Card>
    </Screen>
  );
}

// ── 달성률 반원 게이지 ────────────────────────────────────────────
function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

// 아래 합계 함수들이 반환하는 값의 단위는 '초'입니다. (entries[].minutes 필드가 이제 초를 담습니다)
/** 이번 주(일요일부터 오늘까지) 합계 초 */
function thisWeekMinutes(entries: PrayerLogEntry[]): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const startKey = toDateKey(start);
  return entries.reduce((sum, e) => (e.date >= startKey ? sum + e.minutes : sum), 0);
}

/** 이번 달 합계 초 */
function thisMonthMinutes(entries: PrayerLogEntry[]): number {
  const prefix = toDateKey(new Date()).slice(0, 7); // 'YYYY-MM'
  return entries.reduce((sum, e) => (e.date.startsWith(prefix) ? sum + e.minutes : sum), 0);
}

/** 전체 누적 초 */
function allTimeMinutes(entries: PrayerLogEntry[]): number {
  return entries.reduce((sum, e) => sum + e.minutes, 0);
}

function GaugeCard({
  active,
  goal,
  onGoal,
}: {
  active: PrayerTime;
  goal: number;
  onGoal: (n: number) => void | Promise<void>;
}) {
  const theme = useTheme();
  const cfg = GOAL_CONFIG.personal;
  const week = thisWeekMinutes(active.entries); // 초
  const pct = goal > 0 ? Math.min(1, week / (goal * 60)) : 0; // goal 은 '분', week 는 '초'
  const pct100 = Math.round(pct * 100);

  const W = 210;
  const cx = 105;
  const cy = 104;
  const r = 86;
  const endDeg = 180 + 180 * pct;

  return (
    <View>
      <SectionHeader title="이번 주 기도 시간 달성률" />
      <Card style={styles.center}>
        <View style={{ width: W, height: 118 }}>
          <Svg width={W} height={118} viewBox={`0 0 ${W} 118`}>
            <Path d={arcPath(cx, cy, r, 180, 360)} stroke={theme.backgroundSelected} strokeWidth={16} strokeLinecap="round" fill="none" />
            {pct > 0.004 ? (
              <Path d={arcPath(cx, cy, r, 180, endDeg)} stroke={theme.accent} strokeWidth={16} strokeLinecap="round" fill="none" />
            ) : null}
          </Svg>
          <View style={styles.gaugeCenter}>
            <ThemedText type="title">{pct100}%</ThemedText>
          </View>
        </View>

        <View style={styles.goalRow}>
          <Pressable onPress={() => void onGoal(goal - cfg.step)} hitSlop={8} style={[styles.goalStep, { borderColor: theme.border }]}>
            <Ionicons name="remove" size={16} color={theme.textSecondary} />
          </Pressable>
          <GoalPicker goal={goal} onGoal={onGoal} />
          <Pressable onPress={() => void onGoal(goal + cfg.step)} hitSlop={8} style={[styles.goalStep, { borderColor: theme.border }]}>
            <Ionicons name="add" size={16} color={theme.textSecondary} />
          </Pressable>
        </View>
        <ThemedText type="caption" themeColor="textMuted" style={styles.center}>
          이번 주 {durationLabel(week)} 기도했어요.
        </ThemedText>
      </Card>
    </View>
  );
}

/** 목표 시간을 큰 값도 편하게 표시(시간 단위, 천 단위 콤마). */
function goalLabel(min: number): string {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hs = h.toLocaleString('ko-KR');
  return m === 0 ? `${hs}시간` : `${hs}시간 ${m}분`;
}

/** 목표를 눌러 '시간'으로 직접 입력합니다. (공동은 최대 730,000시간까지) */
function GoalPicker({ goal, onGoal }: { goal: number; onGoal: (n: number) => void | Promise<void> }) {
  const theme = useTheme();
  const cfg = GOAL_CONFIG.personal;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const maxHours = Math.round(cfg.max / 60);

  const start = () => {
    setText(String(Math.round((goal / 60) * 10) / 10));
    setError(undefined);
    setOpen(true);
  };
  const apply = async () => {
    const hours = parseFloat(text.replace(/,/g, '').trim());
    if (!Number.isFinite(hours) || hours <= 0) {
      setError('시간을 숫자로 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await onGoal(Math.round(hours * 60));
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Pressable
        onPress={start}
        style={[styles.goalLabelBtn, { borderColor: theme.primary, backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="caption" themeColor="textMuted">목표 </ThemedText>
        <ThemedText type="smallBold" themeColor="primary">{goalLabel(goal)}</ThemedText>
        <Ionicons name="create-outline" size={14} color={theme.primary} style={{ marginLeft: 4 }} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.goalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.goalSheet, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => {}}>
            <ThemedText type="smallBold" style={styles.center}>
              기도 목표 시간
            </ThemedText>
            <ThemedText type="caption" themeColor="textMuted" style={[styles.center, styles.mt4]}>
              나의 주간 기도 목표예요.
            </ThemedText>
            <View style={[styles.goalInputRow, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
              <TextInput
                value={text}
                onChangeText={setText}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                style={[styles.goalInput, { color: theme.text }]}
                autoFocus
              />
              <ThemedText type="small" themeColor="textSecondary">시간</ThemedText>
            </View>
            <ThemedText type="caption" themeColor="textMuted" style={[styles.center, styles.mt4]}>
              1 ~ {maxHours.toLocaleString('ko-KR')}시간 사이로 입력하세요.
            </ThemedText>
            {error ? (
              <ThemedText type="caption" themeColor="danger" style={[styles.center, styles.mt4]}>
                {error}
              </ThemedText>
            ) : null}
            <View style={styles.goalBtnRow}>
              <Button label="취소" variant="ghost" style={styles.flex} onPress={() => setOpen(false)} />
              <Button label="저장" style={styles.flex} loading={saving} onPress={() => void apply()} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ── 기도 잔디 ──────────────────────────────────────────────────
function grassColor(seconds: number, emptyColor: string): string {
  if (seconds <= 0) return emptyColor;
  if (seconds < 15 * 60) return '#BFE3B4';
  if (seconds < 30 * 60) return '#8AD07A';
  if (seconds < 60 * 60) return '#57B547';
  return '#2F8F2A';
}

function CalendarCard({ active }: { active: PrayerTime }) {
  const theme = useTheme();
  const [offset, setOffset] = useState(0); // 0 = 이번 달
  const map = new Map(active.entries.map((e) => [e.date, e.minutes]));
  const todayKey = toDateKey(new Date());

  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + offset);
  const year = base.getFullYear();
  const month = base.getMonth(); // 0~11
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const keyOf = (d: number) => toDateKey(new Date(year, month, d));
  const prayedDays = cells.filter((d) => d !== null && (map.get(keyOf(d)) ?? 0) > 0).length;

  return (
    <View>
      <View style={styles.grassHead}>
        <SectionHeader title="나의 기도 기록" />
        {active.streak > 0 ? (
          <View style={[styles.streakBadge, { backgroundColor: theme.backgroundSelected }]}>
            <Ionicons name="flame" size={13} color={theme.accent} />
            <ThemedText type="caption" themeColor="textSecondary">
              {active.streak}일 연속 기도 중
            </ThemedText>
          </View>
        ) : null}
      </View>
      <Card>
        <View style={styles.calHeader}>
          <Pressable onPress={() => setOffset(offset - 1)} hitSlop={8} style={styles.calNav}>
            <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
          </Pressable>
          <ThemedText type="smallBold">
            {year}년 {month + 1}월
          </ThemedText>
          <Pressable onPress={() => offset < 0 && setOffset(offset + 1)} hitSlop={8} style={styles.calNav}>
            <Ionicons name="chevron-forward" size={18} color={offset < 0 ? theme.textSecondary : theme.border} />
          </Pressable>
        </View>

        <View style={styles.calWeekRow}>
          {WEEKDAY_LABEL.map((w, i) => (
            <ThemedText key={w} type="caption" style={[styles.calWeekCell, { color: i === 0 ? '#D9534F' : theme.textMuted }]}>
              {w}
            </ThemedText>
          ))}
        </View>

        {rows.map((row, ri) => (
          <View key={ri} style={styles.calRow}>
            {row.map((d, di) => {
              if (d === null) return <View key={di} style={styles.calCell} />;
              const minutes = map.get(keyOf(d)) ?? 0;
              const prayed = minutes > 0;
              const isToday = keyOf(d) === todayKey;
              return (
                <View key={di} style={styles.calCell}>
                  <View
                    style={[
                      styles.calDay,
                      prayed && { backgroundColor: grassColor(minutes, 'transparent') },
                      isToday && { borderWidth: 2, borderColor: theme.primary },
                    ]}>
                    <ThemedText
                      type="caption"
                      style={{
                        color: prayed ? '#14340F' : di === 0 ? '#D9534F' : theme.text,
                        fontWeight: prayed ? '800' : '500',
                      }}>
                      {d}
                    </ThemedText>
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        <ThemedText type="caption" themeColor="textMuted" style={styles.calFooter}>
          {offset === 0 ? '이번 달' : `${month + 1}월`} {prayedDays}일 기도했어요.
        </ThemedText>
      </Card>
    </View>
  );
}

// ── 최근 10일 하루 평균 ──────────────────────────────────────────
function AverageCard({ active }: { active: PrayerTime }) {
  const theme = useTheme();
  const days = recentDays(active.entries, 10); // d.minutes 는 '초'
  const total = days.reduce((s, d) => s + d.minutes, 0);
  const avg = Math.round(total / days.length);
  const max = Math.max(30 * 60, ...days.map((d) => d.minutes)); // 최소 30분 기준으로 막대 높이 정규화

  return (
    <View>
      <View style={styles.grassHead}>
        <SectionHeader title="최근 10일 하루 평균 기도 시간" />
        <ThemedText type="smallBold" themeColor="primary">
          평균 {durationLabel(avg)}
        </ThemedText>
      </View>
      <Card>
        <View style={styles.barChart}>
          {days.map((d) => {
            const h = Math.max(4, Math.round((d.minutes / max) * 64));
            const label = `${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8, 10))}`;
            return (
              <View key={d.date} style={styles.barCol}>
                <ThemedText type="caption" themeColor="textMuted" style={styles.barValue}>
                  {d.minutes >= 60 ? Math.round(d.minutes / 60) : ''}
                </ThemedText>
                <View style={[styles.bar, { height: h, backgroundColor: d.minutes > 0 ? theme.accent : theme.border }]} />
                <ThemedText type="caption" themeColor="textMuted" style={styles.barLabel}>
                  {label}
                </ThemedText>
              </View>
            );
          })}
        </View>
      </Card>
    </View>
  );
}

// ── 기도제목 · 기도 요청 진입 ────────────────────────────────────
function TopicsCard() {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View>
      <SectionHeader title="기도제목" />
      <Card>
        <ListRow
          icon="people-outline"
          title="공동 기도제목"
          subtitle="온 성도가 함께 기도하는 제목이에요"
          onPress={() => router.push('/prayer/communal')}
        />
        <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
        <ListRow
          icon="flower-outline"
          title="개인 기도제목"
          subtitle="나만의 기도제목을 적고 관리해요"
          onPress={() => router.push('/prayer/personal')}
        />
        <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
        <ListRow
          icon="hand-right-outline"
          title="중보기도제목"
          subtitle="성도들과 나누고 함께 중보해요"
          onPress={() => router.push('/prayer/requests')}
        />
      </Card>
    </View>
  );
}

// ── 큰 기도 타이머 (맨 위) ───────────────────────────────────────
function TimerCard({ active, goal }: { active: PrayerTime; goal: number }) {
  const theme = useTheme();
  const { user } = useAuth();
  const bgm = usePrayerBgm();
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const baseRef = useRef(0); // 일시정지까지 누적된 시간(ms)
  const segStartRef = useRef<number | null>(null); // 현재 진행 세그먼트 시작 시각
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [resultSeconds, setResultSeconds] = useState<number | null>(null);

  // 현재까지의 총 경과(ms) — 누적된 시간 + 진행 중인 세그먼트
  const currentMs = () => baseRef.current + (segStartRef.current !== null ? Date.now() - segStartRef.current : 0);

  // 전체 화면 기도 중에 함께 볼 '나의 기도제목' (로그인 안 하면 비움)
  const topics = useAsyncData<PrayerRequest[]>(
    () => (dataMode === 'supabase' && !user ? Promise.resolve([]) : repository.listMyPrayerRequests()),
    [user],
  );

  const begin = () => {
    topics.reload(); // 시작할 때 최신 기도제목을 불러옵니다.
    baseRef.current = 0;
    segStartRef.current = Date.now();
    setElapsed(0);
    setPaused(false);
    setRunning(true);
    if (bgm.enabled) bgm.start(); // 배경음악이 켜져 있으면 함께 재생합니다.
  };

  // 일시정지 — 시간을 멈추고 배경음악도 멈춥니다.
  const pause = () => {
    if (segStartRef.current !== null) {
      baseRef.current += Date.now() - segStartRef.current;
      segStartRef.current = null;
    }
    setElapsed(baseRef.current);
    setPaused(true);
    bgm.stop();
  };
  // 이어서 기도 — 멈춘 지점부터 다시 셉니다.
  const resume = () => {
    segStartRef.current = Date.now();
    setPaused(false);
    if (bgm.enabled) bgm.start();
  };

  // 전체 화면에서 배경음 켜기/끄기 (즉시 반영).
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

  // 기도 화면(탭)을 벗어나면 배경음을 멈춥니다. (뒤로가기·다른 탭 이동 등)
  const stopBgm = bgm.stop;
  useFocusEffect(
    useCallback(() => {
      return () => stopBgm();
    }, [stopBgm]),
  );

  const stop = async () => {
    // 실제 경과 시간을 '초' 단위 그대로 기록합니다. (3초 기도하면 3초로 저장)
    const secs = Math.round(currentMs() / 1000);
    setRunning(false);
    setPaused(false);
    baseRef.current = 0;
    segStartRef.current = null;
    setElapsed(0);
    bgm.stop(); // 기도를 마치면 배경음악을 멈춥니다.
    if (secs > 0) {
      await active.addMinutes(secs);
      setResultSeconds(secs); // 마치면 결과 모달 표시
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
        // 전체 화면 기도 모드가 위에 뜨는 동안, 카드 자리에는 간단한 안내만 둡니다.
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

      <PrayerResultModal
        seconds={resultSeconds}
        onClose={() => setResultSeconds(null)}
        active={active}
        goal={goal}
      />
    </Card>
  );
}

/**
 * 아날로그 기도 다이얼 — 파란 원판 위에 60개의 흰색 눈금이 시계처럼 둘려 있고,
 * 초가 지날수록 눈금이 노란색으로 채워지며 초침이 함께 돕니다. 가운데에는
 * 기존 디지털 시간(MM:SS)을 그대로 크게 표시합니다.
 */
// 시작 버튼 이미지(+1H prayer)에서 뽑은 색 — 다이얼과 통일합니다.
const DIAL_BLUE = '#1B498E';
const DIAL_GOLD = '#EADB4E';

function PrayerDial({ seconds, display, paused }: { seconds: number; display: string; paused?: boolean }) {
  const size = 268;
  const c = size / 2;
  const rDisc = c - 6; // 파란 원판 반지름
  const rOuter = c - 16; // 눈금 바깥쪽
  const rInner = rOuter - 15; // 짧은 눈금 안쪽
  const rInnerLong = rOuter - 24; // 긴 눈금(5칸마다) 안쪽

  const secOfMin = seconds % 60; // 이번 분 안에서의 초 (0~59)

  const ticks = [];
  for (let i = 0; i < 60; i += 1) {
    const a = ((-90 + i * 6) * Math.PI) / 180; // 맨 위(12시)에서 시작
    const long = i % 5 === 0;
    const ri = long ? rInnerLong : rInner;
    const passed = i <= secOfMin; // 초침이 지나온 눈금은 노랗게 채웁니다
    ticks.push(
      <Line
        key={i}
        x1={c + ri * Math.cos(a)}
        y1={c + ri * Math.sin(a)}
        x2={c + rOuter * Math.cos(a)}
        y2={c + rOuter * Math.sin(a)}
        stroke={passed ? DIAL_GOLD : 'rgba(255,255,255,0.4)'}
        strokeWidth={long ? 3.5 : 2}
        strokeLinecap="round"
      />,
    );
  }

  // 초침 — 가운데에서 현재 초 위치까지
  const ha = ((-90 + secOfMin * 6) * Math.PI) / 180;
  const handLen = rInnerLong - 4;

  return (
    <View style={styles.dialWrap}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={rDisc} fill={DIAL_BLUE} />
        {ticks}
        <Line x1={c} y1={c} x2={c + handLen * Math.cos(ha)} y2={c + handLen * Math.sin(ha)} stroke={DIAL_GOLD} strokeWidth={3} strokeLinecap="round" />
        <Circle cx={c} cy={c} r={4.5} fill={DIAL_GOLD} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.dialCenter]} pointerEvents="none">
        <ThemedText style={styles.dialTime}>{display}</ThemedText>
        <ThemedText style={styles.dialLabel}>{paused ? '일시정지' : '기도중'}</ThemedText>
      </View>
    </View>
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
          <Pressable
            onPress={onStop}
            style={({ pressed }) => [styles.stopBtn, { backgroundColor: theme.accent, opacity: pressed ? 0.9 : 1 }]}>
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

  // 로그인한 분은 이름을, 손님은 '성도'로 표시합니다.
  const who = user?.name ? `${user.name}님의` : '성도의';
  const week = thisWeekMinutes(active.entries); // 초
  const month = thisMonthMinutes(active.entries); // 초
  const total = allTimeMinutes(active.entries); // 초
  const pct = goal > 0 ? Math.min(100, Math.round((week / (goal * 60)) * 100)) : 0; // goal 분 → 초

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

          {/* 목표 달성률 */}
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

          {/* 기간별 합계 */}
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
  flexEnd: { flex: 1, textAlign: 'right' },
  stack: { gap: Spacing.two },
  center: { alignItems: 'center', textAlign: 'center' },
  menuDivider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.one },

  toggle: { flexDirection: 'row', padding: 4, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  toggleItem: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },

  gaugeCenter: { position: 'absolute', left: 0, right: 0, bottom: 4, alignItems: 'center' },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.two },
  goalStep: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalLabelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  goalValue: { fontWeight: '700' },
  mt4: { marginTop: 4 },
  goalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  goalSheet: { width: '86%', maxWidth: 340, borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.four },
  goalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  goalInput: { fontSize: 22, fontWeight: '700', textAlign: 'right', minWidth: 120, paddingVertical: 0 },
  goalBtnRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.four },

  grassHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.two },
  calNav: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  calWeekRow: { flexDirection: 'row', marginBottom: Spacing.one },
  calWeekCell: { flex: 1, textAlign: 'center' },
  calRow: { flexDirection: 'row' },
  calCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  calDay: { width: '86%', aspectRatio: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  calFooter: { textAlign: 'center', marginTop: Spacing.two },

  barChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, paddingTop: Spacing.two },
  barCol: { flex: 1, alignItems: 'center', gap: 2 },
  bar: { width: '64%', borderRadius: Radius.small },
  barValue: { fontSize: 9 },
  barLabel: { fontSize: 9 },

  quickRow: { flexDirection: 'row', gap: Spacing.two },
  timerBox: { borderRadius: Radius.medium, padding: Spacing.three, alignItems: 'center', gap: Spacing.two },

  // 큰 기도 타이머
  timerCard: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.four },
  startImageBtn: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  startImage: { width: '100%', height: '100%' },
  bigStart: {
    width: '100%',
    minHeight: 76,
    borderRadius: Radius.large,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
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
  bigTimer: { fontSize: 64, lineHeight: 72, fontWeight: '800', letterSpacing: 1, fontVariant: ['tabular-nums'] },

  // 전체 화면 기도 모드
  focusRoot: { flex: 1, paddingHorizontal: Spacing.four, gap: Spacing.two },
  dialMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  bgmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  bgmTrack: {
    width: 46,
    height: 28,
    borderRadius: 14,
    padding: 3,
    justifyContent: 'center',
  },
  bgmThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  dialWrap: { alignSelf: 'center', marginTop: Spacing.two },
  dialCenter: { alignItems: 'center', justifyContent: 'center' },
  dialTime: {
    color: '#fff',
    fontSize: 46,
    lineHeight: 54,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  dialLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    letterSpacing: 2,
    marginTop: 2,
  },
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

  // 결과 모달
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

  communalHero: { alignItems: 'center', gap: 2, marginBottom: Spacing.two },
  communalTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    marginVertical: Spacing.one,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
