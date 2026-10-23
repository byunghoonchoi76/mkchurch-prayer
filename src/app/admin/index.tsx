import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { MemberListDivider, MemberRow } from '@/components/member-row';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card, EmptyState, ErrorState, ListRow, LoadingState, SectionHeader } from '@/components/ui';
import { PARISH_OPTIONS, POSITION_OPTIONS } from '@/constants/church-roles';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { repository, useAsyncData } from '@/lib/data';
import type { AppMember } from '@/lib/data/types';
import { AGE_GROUP_ORDER, ageGroupOf } from '@/lib/member-stats';

/**
 * 관리자 대시보드 — 교회 관리자가 성도·공동 기도제목을 한곳에서 관리합니다.
 * (설정 › 관리자 › 관리자 대시보드)
 */
export default function AdminDashboardScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user, isAdmin } = useAuth();

  // 요약 수치 + 성도 명단을 함께 불러옵니다.
  const summary = useAsyncData(async () => {
    const [memberCount, communal, members] = await Promise.all([
      repository.countMembers().catch(() => 0),
      repository.listCommunalPrayers().catch(() => []),
      repository.listMembers().catch(() => [] as AppMember[]),
    ]);
    return { memberCount, communalCount: communal.length, members };
  }, []);

  if (!isAdmin) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '관리자 대시보드' }} />
        <EmptyState icon="lock-closed-outline" message="관리자만 볼 수 있는 화면입니다." />
      </Screen>
    );
  }

  const data = summary.data;

  return (
    <Screen onRefresh={summary.reload}>
      <Stack.Screen options={{ title: '관리자 대시보드' }} />

      {/* 요약 ─ 가입 성도 수 · 공동 기도제목 수 */}
      <View style={styles.statRow}>
        <StatTile icon="people-outline" label="가입 성도" value={data ? `${data.memberCount}명` : '…'} />
        <StatTile icon="megaphone-outline" label="공동 기도제목" value={data ? `${data.communalCount}개` : '…'} />
      </View>

      {/* 교구별 성도 통계 */}
      <View>
        <SectionHeader title="교구별 성도 통계" />
        {summary.loading && !data ? (
          <LoadingState />
        ) : !data || data.members.length === 0 ? (
          <Card>
            <EmptyState icon="pie-chart-outline" message="집계할 성도가 없습니다." />
          </Card>
        ) : (
          <DistributionStats
            members={data.members}
            pick={(m) => m.parish}
            order={PARISH_OPTIONS}
            onSelect={(value) => router.push({ pathname: '/admin/members', params: { field: 'parish', value } })}
          />
        )}
      </View>

      {/* 직분별 성도 통계 */}
      <View>
        <SectionHeader title="직분별 성도 통계" />
        {summary.loading && !data ? (
          <LoadingState />
        ) : !data || data.members.length === 0 ? (
          <Card>
            <EmptyState icon="pie-chart-outline" message="집계할 성도가 없습니다." />
          </Card>
        ) : (
          <DistributionStats
            members={data.members}
            pick={(m) => m.position}
            order={POSITION_OPTIONS}
            onSelect={(value) => router.push({ pathname: '/admin/members', params: { field: 'position', value } })}
          />
        )}
      </View>

      {/* 연령대별 성도 통계 */}
      <View>
        <SectionHeader title="연령대별 성도 통계" />
        {summary.loading && !data ? (
          <LoadingState />
        ) : !data || data.members.length === 0 ? (
          <Card>
            <EmptyState icon="pie-chart-outline" message="집계할 성도가 없습니다." />
          </Card>
        ) : (
          <DistributionStats
            members={data.members}
            pick={(m) => ageGroupOf(m.birthDate)}
            order={AGE_GROUP_ORDER}
            onSelect={(value) => router.push({ pathname: '/admin/members', params: { field: 'age', value } })}
          />
        )}
      </View>

      {/* 콘텐츠 관리 */}
      <View>
        <SectionHeader title="콘텐츠 관리" />
        <Card>
          <ListRow
            icon="megaphone-outline"
            title="공동 기도제목 관리"
            subtitle="말씀선포 기도문을 추가·수정·삭제"
            right={
              <View style={styles.rightRow}>
                {data ? (
                  <ThemedText type="caption" themeColor="textMuted" fixed>
                    {data.communalCount}개
                  </ThemedText>
                ) : null}
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </View>
            }
            onPress={() => router.push('/prayer/communal')}
          />
        </Card>
      </View>

      {/* 성도 관리 */}
      <View>
        <SectionHeader title="성도 관리" />
        {summary.loading && !data ? (
          <LoadingState />
        ) : summary.error ? (
          <ErrorState message={summary.error} onRetry={summary.reload} />
        ) : !data || data.members.length === 0 ? (
          <EmptyState icon="person-outline" message="아직 가입한 성도가 없습니다." />
        ) : (
          <Card>
            {data.members.map((m, i) => (
              <View key={m.id}>
                {i > 0 ? <MemberListDivider /> : null}
                <MemberRow member={m} isMe={m.id === user?.id} onDeleted={summary.reload} />
              </View>
            ))}
          </Card>
        )}
      </View>

      <ThemedText type="caption" themeColor="textMuted" style={styles.note}>
        성도 계정을 삭제하면 되돌릴 수 없습니다. 삭제 전에 한 번 더 확인해 주세요.
      </ThemedText>
    </Screen>
  );
}

/** 상단 요약 타일. */
function StatTile({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  const theme = useTheme();
  return (
    <Card style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: theme.backgroundSelected }]}>
        <Ionicons name={icon} size={18} color={theme.primary} />
      </View>
      <ThemedText type="title">{value}</ThemedText>
      <ThemedText type="caption" themeColor="textMuted" fixed>
        {label}
      </ThemedText>
    </Card>
  );
}

/**
 * 성도 분포 막대 통계 (교구별·직분별 공통).
 * pick: 성도에서 분류 값(교구/직분)을 꺼내는 함수. order: 보여 줄 순서 목록.
 */
function DistributionStats({
  members,
  pick,
  order,
  onSelect,
}: {
  members: AppMember[];
  pick: (m: AppMember) => string | undefined;
  order: readonly string[];
  /** 주어지면 각 행을 누를 수 있고, 누르면 그 분류 값을 넘겨 줍니다. */
  onSelect?: (label: string) => void;
}) {
  const theme = useTheme();

  // 분류별 인원 집계 (값이 없으면 '미지정'으로)
  const counts = new Map<string, number>();
  for (const m of members) {
    const v = pick(m);
    const key = v && v.trim() ? v.trim() : '미지정';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // 정렬: 지정한 순서 → 그 밖의 값 → '미정' · '미지정'은 맨 뒤. (인원 0인 항목은 생략)
  const ordered: string[] = [];
  for (const o of order) if (o !== '미정' && counts.has(o)) ordered.push(o);
  for (const k of counts.keys()) if (!order.includes(k) && k !== '미지정' && k !== '미정') ordered.push(k);
  if (counts.has('미정')) ordered.push('미정');
  if (counts.has('미지정')) ordered.push('미지정');

  const total = members.length;
  const max = Math.max(1, ...ordered.map((k) => counts.get(k) ?? 0));

  return (
    <Card>
      {ordered.map((label, i) => {
        const n = counts.get(label) ?? 0;
        const pct = total > 0 ? Math.round((n / total) * 100) : 0;
        const muted = label === '미지정' || label === '미정';
        const tappable = !!onSelect;
        return (
          <Pressable
            key={label}
            onPress={tappable ? () => onSelect(label) : undefined}
            disabled={!tappable}
            style={({ pressed }) => [
              styles.parishRow,
              i > 0 && styles.parishRowGap,
              tappable && pressed && { opacity: 0.6 },
            ]}>
            <ThemedText type="small" style={styles.parishLabel} numberOfLines={1}>
              {label}
            </ThemedText>
            <View style={[styles.parishTrack, { backgroundColor: theme.backgroundSelected }]}>
              <View
                style={[
                  styles.parishFill,
                  { width: `${Math.max(6, (n / max) * 100)}%`, backgroundColor: muted ? theme.textMuted : theme.primary },
                ]}
              />
            </View>
            <ThemedText type="smallBold" style={styles.parishCount} fixed>
              {n}명
            </ThemedText>
            <ThemedText type="caption" themeColor="textMuted" style={styles.parishPct} fixed>
              {pct}%
            </ThemedText>
            {tappable ? <Ionicons name="chevron-forward" size={14} color={theme.textMuted} /> : null}
          </Pressable>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  center: { alignItems: 'center', textAlign: 'center' },
  mt4: { marginTop: 4 },
  note: { textAlign: 'center', marginTop: Spacing.one },

  statRow: { flexDirection: 'row', gap: Spacing.three },
  statTile: { flex: 1, alignItems: 'center', gap: Spacing.one },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },

  // 교구별 통계
  parishRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  parishRowGap: { marginTop: Spacing.three },
  parishLabel: { width: 52 },
  parishTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  parishFill: { height: 10, borderRadius: 5 },
  parishCount: { width: 40, textAlign: 'right' },
  parishPct: { width: 36, textAlign: 'right' },

  rightRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
