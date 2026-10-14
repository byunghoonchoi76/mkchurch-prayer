import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card, SectionHeader } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dataMode, repository, useAsyncData } from '@/lib/data';
import {
  PRAYER_CATEGORIES,
  PRAYER_CATEGORY_COLORS,
  PRAYER_STATUSES,
  type PrayerLogEntry,
  type PrayerRequest,
} from '@/lib/data/types';
import { durationLabel, toDateKey } from '@/lib/format';
import { useAllPrayerTime } from '@/lib/prayer-log';

type Period = '이번 주' | '이번 달' | '전체';
const PERIODS: Period[] = ['이번 주', '이번 달', '전체'];

/** 기간에 해당하는 기록만 추립니다. */
function inPeriod(entries: PrayerLogEntry[], period: Period): PrayerLogEntry[] {
  if (period === '전체') return entries;
  if (period === '이번 달') {
    const prefix = toDateKey(new Date()).slice(0, 7);
    return entries.filter((e) => e.date.startsWith(prefix));
  }
  // 이번 주 (일요일부터)
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const startKey = toDateKey(start);
  return entries.filter((e) => e.date >= startKey);
}

/** 가장 길게 이어진 연속 기도 일수 */
function longestStreak(entries: PrayerLogEntry[]): number {
  const days = entries
    .filter((e) => e.minutes > 0)
    .map((e) => e.date)
    .sort();
  if (days.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    const prev = new Date(days[i - 1]);
    const cur = new Date(days[i]);
    const diff = Math.round((cur.getTime() - prev.getTime()) / 86400000);
    if (diff === 1) {
      run += 1;
      best = Math.max(best, run);
    } else if (diff > 1) {
      run = 1;
    }
  }
  return best;
}

export default function PrayerStatsScreen() {
  const { user } = useAuth();
  const active = useAllPrayerTime();
  const [period, setPeriod] = useState<Period>('이번 달');

  const requests = useAsyncData<PrayerRequest[]>(
    () => (dataMode === 'supabase' && !user ? Promise.resolve([]) : repository.listMyPrayerRequests()),
    [user],
  );
  useFocusEffect(requests.reload);

  const scoped = inPeriod(active.entries, period);
  const totalSeconds = scoped.reduce((s, e) => s + e.minutes, 0);
  const prayedDays = scoped.filter((e) => e.minutes > 0).length;
  const avgSeconds = prayedDays > 0 ? Math.round(totalSeconds / prayedDays) : 0;

  return (
    <Screen onRefresh={requests.reload}>
      {/* 기간 선택 */}
      <View style={styles.periodRow}>
        {PERIODS.map((p) => (
          <PeriodChip key={p} label={p} selected={p === period} onPress={() => setPeriod(p)} />
        ))}
      </View>

      <TimeCard period={period} totalSeconds={totalSeconds} prayedDays={prayedDays} avgSeconds={avgSeconds} />

      <StreakCard current={active.streak} longest={longestStreak(active.entries)} />

      <StatusCard requests={requests.data ?? []} />

      <CategoryCard requests={requests.data ?? []} />
    </Screen>
  );
}

function PeriodChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.periodChip,
        { backgroundColor: selected ? theme.primary : theme.backgroundElement, borderColor: selected ? theme.primary : theme.border },
      ]}>
      <ThemedText type="small" style={{ color: selected ? theme.onPrimary : theme.textSecondary, fontWeight: selected ? '800' : '600' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** 기도 시간 요약 */
function TimeCard({
  period,
  totalSeconds,
  prayedDays,
  avgSeconds,
}: {
  period: Period;
  totalSeconds: number;
  prayedDays: number;
  avgSeconds: number;
}) {
  const theme = useTheme();
  return (
    <View>
      <SectionHeader title={`${period} 기도 시간`} />
      <Card>
        <View style={styles.statRow}>
          <Stat label="기도한 시간" value={durationLabel(totalSeconds)} />
          <View style={[styles.vline, { backgroundColor: theme.border }]} />
          <Stat label="기도한 날" value={`${prayedDays}일`} />
          <View style={[styles.vline, { backgroundColor: theme.border }]} />
          <Stat label="하루 평균" value={durationLabel(avgSeconds)} />
        </View>
      </Card>
    </View>
  );
}

/** 연속 기도 */
function StreakCard({ current, longest }: { current: number; longest: number }) {
  const theme = useTheme();
  return (
    <View>
      <SectionHeader title="연속 기도" />
      <Card>
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <View style={styles.streakValue}>
              <Ionicons name="flame" size={20} color={theme.accent} />
              <ThemedText type="title" themeColor="primary">
                {current}
              </ThemedText>
            </View>
            <ThemedText type="caption" themeColor="textMuted">
              지금 이어가는 날
            </ThemedText>
          </View>
          <View style={[styles.vline, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <ThemedText type="title">{longest}</ThemedText>
            <ThemedText type="caption" themeColor="textMuted">
              가장 길게 이어간 날
            </ThemedText>
          </View>
        </View>
        {current > 0 ? (
          <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
            {current}일째 기도를 이어가고 있어요. 오늘도 함께해요.
          </ThemedText>
        ) : null}
      </Card>
    </View>
  );
}

/** 내 기도제목 상태 현황 + 응답률 */
function StatusCard({ requests }: { requests: PrayerRequest[] }) {
  const theme = useTheme();
  const total = requests.length;
  const counts: Record<string, number> = {};
  for (const s of PRAYER_STATUSES) counts[s] = 0;
  for (const r of requests) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const answered = counts['응답됨'] ?? 0;
  const rate = total > 0 ? Math.round((answered / total) * 100) : 0;

  const TONE: Record<string, string> = {
    전체: theme.text,
    기도중: theme.primary,
    응답됨: theme.success,
    종료: theme.textMuted,
  };

  return (
    <View>
      <SectionHeader title="내 기도제목 현황" />
      <Card>
        {total === 0 ? (
          <ThemedText type="small" themeColor="textMuted" style={styles.center}>
            아직 등록한 기도제목이 없어요.
          </ThemedText>
        ) : (
          <>
            <View style={styles.statRow}>
              <CountStat label="전체" value={total} color={TONE['전체']} />
              <CountStat label="기도중" value={counts['기도중'] ?? 0} color={TONE['기도중']} />
              <CountStat label="응답됨" value={answered} color={TONE['응답됨']} />
              <CountStat label="종료" value={counts['종료'] ?? 0} color={TONE['종료']} />
            </View>
            <View style={styles.rateRow}>
              <ThemedText type="small" themeColor="textSecondary">
                응답률
              </ThemedText>
              <ThemedText type="smallBold" themeColor="success">
                {rate}%
              </ThemedText>
            </View>
            <View style={[styles.track, { backgroundColor: theme.border }]}>
              <View style={[styles.fill, { width: `${rate}%`, backgroundColor: theme.success }]} />
            </View>
          </>
        )}
      </Card>
    </View>
  );
}

/** 분류(카테고리)별 기도제목 분포 */
function CategoryCard({ requests }: { requests: PrayerRequest[] }) {
  const theme = useTheme();
  const counts = PRAYER_CATEGORIES.map((c) => ({
    category: c,
    count: requests.filter((r) => r.category === c).length,
  }));
  const max = Math.max(1, ...counts.map((c) => c.count));
  const top = [...counts].sort((a, b) => b.count - a.count)[0];

  return (
    <View>
      <SectionHeader title="분류별 기도제목" />
      <Card>
        {requests.length === 0 ? (
          <ThemedText type="small" themeColor="textMuted" style={styles.center}>
            아직 등록한 기도제목이 없어요.
          </ThemedText>
        ) : (
          <>
            {top && top.count > 0 ? (
              <View style={[styles.topBox, { backgroundColor: theme.backgroundSelected }]}>
                <Ionicons name="pricetag" size={14} color={theme.primary} />
                <ThemedText type="caption" themeColor="textSecondary">
                  가장 많은 분류{'  '}
                  <ThemedText type="smallBold" themeColor="primary">
                    {top.category}
                  </ThemedText>
                </ThemedText>
              </View>
            ) : null}
            <View style={styles.catList}>
              {counts.map(({ category, count }) => {
                const color = PRAYER_CATEGORY_COLORS[category];
                return (
                  <View key={category} style={styles.catRow}>
                    <View style={styles.catHead}>
                      <View style={styles.catName}>
                        <View style={[styles.dot, { backgroundColor: color }]} />
                        <ThemedText type="small">{category}</ThemedText>
                      </View>
                      <ThemedText type="smallBold" themeColor="textSecondary">
                        {count}개
                      </ThemedText>
                    </View>
                    <View style={[styles.track, { backgroundColor: theme.border }]}>
                      <View style={[styles.fill, { width: `${(count / max) * 100}%`, backgroundColor: color }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </Card>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <ThemedText type="smallBold" themeColor="primary" style={styles.center}>
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textMuted">
        {label}
      </ThemedText>
    </View>
  );
}

function CountStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statItem}>
      <ThemedText type="title" style={{ color }}>
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textMuted">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center', alignSelf: 'center' },
  periodRow: { flexDirection: 'row', gap: Spacing.two },
  periodChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  streakValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  vline: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 4 },
  rateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.three },
  track: { height: 10, borderRadius: Radius.pill, overflow: 'hidden', marginTop: Spacing.one },
  fill: { height: '100%', borderRadius: Radius.pill },
  topBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    marginBottom: Spacing.three,
  },
  catList: { gap: Spacing.three },
  catRow: { gap: 2 },
  catHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catName: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
