import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ListRow, SectionHeader } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { durationLabel, toDateKey } from '@/lib/format';
import { GOAL_CONFIG, useWeeklyGoal } from '@/lib/prayer-goal';
import { recentDays, useAllPrayerTime, usePrayerTime } from '@/lib/prayer-log';
import { goalLabel, weekSeconds } from '@/lib/prayer-stats';

const WEEKDAY_LABEL = ['일', '월', '화', '수', '목', '금', '토'];

type PrayerTime = ReturnType<typeof usePrayerTime>;

/** 기도 기록 — 이번 주 달성률 · 기도 달력 · 최근 평균 · 상세 통계 */
export default function PrayerRecordsScreen() {
  const router = useRouter();
  const active = useAllPrayerTime();
  const { goal, setGoal } = useWeeklyGoal('personal');

  return (
    <Screen onRefresh={active.reload}>
      <GaugeCard active={active} goal={goal} onGoal={setGoal} />
      <CalendarCard active={active} />
      <AverageCard active={active} />

      <Card>
        <ListRow
          icon="stats-chart-outline"
          title="기도 통계"
          subtitle="기도제목 상태·응답률·분류별 분포를 한눈에"
          onPress={() => router.push('/prayer/stats')}
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
  const week = weekSeconds(active.entries); // 초
  const pct = goal > 0 ? Math.min(1, week / (goal * 60)) : 0;
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

/** 목표를 눌러 '시간'으로 직접 입력합니다. */
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
      <Pressable onPress={start} style={[styles.goalLabelBtn, { borderColor: theme.primary, backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="caption" themeColor="textMuted" numberOfLines={1}>목표 </ThemedText>
        <ThemedText type="smallBold" themeColor="primary" numberOfLines={1} style={styles.flexShrink}>{goalLabel(goal)}</ThemedText>
        <Ionicons name="create-outline" size={14} color={theme.primary} style={{ marginLeft: 4 }} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.goalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.goalSheet, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => {}}>
            <ThemedText type="smallBold" style={styles.center}>기도 목표 시간</ThemedText>
            <ThemedText type="caption" themeColor="textMuted" style={[styles.center, styles.mt4]}>나의 주간 기도 목표예요.</ThemedText>
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

// ── 기도 잔디(달력) ──────────────────────────────────────────────
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
  const month = base.getMonth();
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
        <View style={styles.grassHeadTitle}>
          <SectionHeader title="나의 기도 기록" />
        </View>
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
  const days = recentDays(active.entries, 10);
  const total = days.reduce((s, d) => s + d.minutes, 0);
  const avg = Math.round(total / days.length);
  const max = Math.max(30 * 60, ...days.map((d) => d.minutes));

  return (
    <View>
      <View style={styles.grassHead}>
        <View style={styles.grassHeadTitle}>
          <SectionHeader title="최근 10일 하루 평균 기도 시간" />
        </View>
        <ThemedText type="smallBold" themeColor="primary" numberOfLines={1} style={styles.flexShrink}>
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  center: { alignItems: 'center', textAlign: 'center' },
  mt4: { marginTop: 4 },
  menuDivider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.one },

  gaugeCenter: { position: 'absolute', left: 0, right: 0, bottom: 4, alignItems: 'center' },
  goalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', columnGap: Spacing.three, rowGap: Spacing.two, marginTop: Spacing.two },
  goalStep: { width: 36, height: 36, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  goalLabelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    paddingVertical: 8,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
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

  grassHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: Spacing.two, rowGap: Spacing.one },
  grassHeadTitle: { flexShrink: 1, minWidth: '55%' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingHorizontal: Spacing.two, paddingVertical: 3, borderRadius: Radius.pill, flexShrink: 0 },
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
});
