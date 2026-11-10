import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ConfirmModal } from '@/components/confirm-modal';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ListRow, SectionHeader } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { durationLabel, toDateKey } from '@/lib/format';
import { useWeeklyGoal } from '@/lib/prayer-goal';
import { recentDays, useAllPrayerTime, usePrayerTime } from '@/lib/prayer-log';
import { goalLabel, weekSeconds } from '@/lib/prayer-stats';

const WEEKDAY_LABEL = ['일', '월', '화', '수', '목', '금', '토'];

type PrayerTime = ReturnType<typeof usePrayerTime>;

/** 기도 기록 — 이번 주 달성률 · 기도 달력 · 최근 평균 · 상세 통계 */
export default function PrayerRecordsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const active = useAllPrayerTime();
  const { goal } = useWeeklyGoal('personal');

  // 시작 버튼 없이 기도한 경우 오늘 기도 시간을 직접 기록하거나(추가),
  // 잘못 입력했을 때 되돌릴 수 있도록(빼기) 합니다.
  const [manualOpen, setManualOpen] = useState(false);
  const [manualMode, setManualMode] = useState<'add' | 'subtract'>('add');
  const [manualText, setManualText] = useState('');
  const [manualErr, setManualErr] = useState<string | undefined>();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const openManual = () => {
    setManualText('');
    setManualErr(undefined);
    setManualMode('add');
    setManualOpen(true);
  };

  const saveManual = async () => {
    const mins = parseInt(manualText.replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(mins) || mins <= 0) {
      setManualErr('시간을 분 단위 숫자로 입력해 주세요.');
      return;
    }
    if (mins > 1440) {
      setManualErr('하루 최대 1440분(24시간)까지 입력할 수 있어요.');
      return;
    }
    setManualOpen(false);
    if (manualMode === 'add') {
      await active.addMinutes(mins * 60); // 분 → 초
      active.reload();
      setSavedMsg(`오늘 기도에 ${mins}분을 더했어요.`);
    } else {
      // 빼기: 개인 기록의 '오늘' 값에서 빼되 0분 아래로는 내려가지 않게 합니다.
      const curSec = active.personalTodayMinutes; // 초
      const nextSec = Math.max(0, curSec - mins * 60);
      const removedMin = Math.round((curSec - nextSec) / 60);
      await active.setTodayMinutes(nextSec);
      active.reload();
      setSavedMsg(removedMin > 0 ? `오늘 기도에서 ${removedMin}분을 뺐어요.` : '오늘 뺄 기도 기록이 없어요.');
    }
  };

  return (
    <Screen onRefresh={active.reload}>
      <GaugeCard active={active} goal={goal} />
      <CalendarCard active={active} />
      <AverageCard active={active} />

      <Card>
        <ListRow
          icon="create-outline"
          title="기도 시간 직접 입력"
          subtitle="시작 버튼 없이 기도했다면 오늘 시간을 기록해요"
          onPress={openManual}
        />
        <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
        <ListRow
          icon="stats-chart-outline"
          title="기도 통계"
          subtitle="기도제목 상태·응답률·분류별 분포를 한눈에"
          onPress={() => router.push('/prayer/stats')}
        />
      </Card>

      {/* 시작 버튼 없이 기도한 경우 시간 직접 입력 */}
      <Modal visible={manualOpen} transparent animationType="fade" onRequestClose={() => setManualOpen(false)}>
        <Pressable style={styles.manualBackdrop} onPress={() => setManualOpen(false)}>
          <Pressable style={[styles.manualSheet, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => {}}>
            <ThemedText type="subtitle" style={styles.center}>
              기도 시간 직접 입력
            </ThemedText>

            {/* 추가 / 빼기 선택 */}
            <View style={[styles.segment, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
              {(['add', 'subtract'] as const).map((m) => {
                const on = manualMode === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setManualMode(m);
                      setManualErr(undefined);
                    }}
                    style={[styles.segmentBtn, on && { backgroundColor: theme.primary }]}>
                    <ThemedText type="smallBold" fixed style={{ color: on ? theme.onPrimary : theme.textSecondary }}>
                      {m === 'add' ? '추가' : '빼기'}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {manualMode === 'add'
                ? '시작 버튼 없이 기도하셨다면,\n오늘 기도한 시간을 분 단위로 더하세요.'
                : `잘못 입력하셨다면 분 단위로 빼세요.\n(오늘 기록: ${Math.round(active.personalTodayMinutes / 60)}분)`}
            </ThemedText>
            <View style={[styles.manualInputRow, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="subtitle" themeColor={manualMode === 'add' ? 'primary' : 'danger'}>
                {manualMode === 'add' ? '+' : '−'}
              </ThemedText>
              <TextInput
                value={manualText}
                onChangeText={(t) => {
                  setManualText(t);
                  setManualErr(undefined);
                }}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                style={[styles.manualInput, { color: theme.text }]}
                autoFocus
              />
              <ThemedText type="subtitle" themeColor="textSecondary">
                분
              </ThemedText>
            </View>
            {manualErr ? (
              <ThemedText type="caption" themeColor="danger" style={styles.center}>
                {manualErr}
              </ThemedText>
            ) : null}
            <View style={styles.manualBtnRow}>
              <Button label="취소" variant="ghost" style={styles.flex} onPress={() => setManualOpen(false)} />
              <Button
                label={manualMode === 'add' ? '추가' : '빼기'}
                variant={manualMode === 'add' ? 'primary' : 'danger'}
                style={styles.flex}
                onPress={() => void saveManual()}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmModal
        visible={savedMsg != null}
        title="기도 기록을 반영했어요"
        message={savedMsg != null ? `${savedMsg}\n위 기록에 바로 반영됩니다.` : undefined}
        confirmLabel="확인"
        hideCancel
        onCancel={() => setSavedMsg(null)}
        onConfirm={() => setSavedMsg(null)}
      />
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

function GaugeCard({ active, goal }: { active: PrayerTime; goal: number }) {
  const theme = useTheme();
  const router = useRouter();
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

        <ThemedText type="caption" themeColor="textMuted" style={[styles.center, styles.mt4]}>
          이번 주 {durationLabel(week)} 기도했어요.
        </ThemedText>

        {/* 목표 시간은 '설정'에서 바꿉니다. 여기서는 현재 목표만 보여 주고, 눌러서 설정으로 이동해요. */}
        <Pressable
          onPress={() => router.push('/settings')}
          style={[styles.goalLabelBtn, { borderColor: theme.border, backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="caption" themeColor="textMuted" numberOfLines={1}>주간 목표 </ThemedText>
          <ThemedText type="smallBold" themeColor="primary" numberOfLines={1} style={styles.flexShrink}>{goalLabel(goal)}</ThemedText>
          <Ionicons name="chevron-forward" size={14} color={theme.textMuted} style={{ marginLeft: 4 }} />
        </Pressable>
        <ThemedText type="caption" themeColor="textMuted" style={[styles.center, styles.mt4]}>
          목표 시간은 ‘설정 › 기도 목표’에서 바꿀 수 있어요.
        </ThemedText>
      </Card>
    </View>
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
  rowDivider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.one, marginLeft: 44 },

  manualBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  manualSheet: { width: '88%', maxWidth: 360, borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.four, gap: Spacing.two },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    marginTop: Spacing.one,
  },
  manualInput: { flex: 1, minWidth: 0, fontSize: 28, fontWeight: '800', textAlign: 'right', paddingVertical: 0 },
  manualBtnRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
  segment: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
    padding: 3,
    gap: 3,
    marginTop: Spacing.one,
  },
  segmentBtn: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.one + 2, borderRadius: Radius.pill, alignItems: 'center' },

  gaugeCenter: { position: 'absolute', left: 0, right: 0, bottom: 4, alignItems: 'center' },
  goalLabelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    flexShrink: 1,
    marginTop: Spacing.three,
    paddingVertical: 8,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },

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
