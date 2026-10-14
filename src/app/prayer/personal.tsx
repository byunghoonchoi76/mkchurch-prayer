import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { HeroBanner } from '@/components/hero-banner';
import { CategoryChip, StatusBadge, StatusPicker } from '@/components/prayer-meta';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dataMode, repository, useAsyncData } from '@/lib/data';
import { PRAYER_CATEGORIES, PRAYER_STATUSES, type PrayerCategory, type PrayerRequest, type PrayerStatus } from '@/lib/data/types';
import { formatRelative } from '@/lib/format';

type StatusFilter = '전체' | PrayerStatus;
type CategoryFilter = '전체' | PrayerCategory;

/** 개인 기도제목 — 나만 보는 목록. 원하면 '기도 요청'으로 올려 성도들과 함께 기도할 수 있습니다. */
export default function PersonalPrayerScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const needsSignIn = dataMode === 'supabase' && !user;

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('전체');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('전체');

  const myRequests = useAsyncData(
    () => (needsSignIn ? Promise.resolve([]) : repository.listMyPrayerRequests()),
    [needsSignIn],
  );
  const reloadMy = myRequests.reload;
  useFocusEffect(reloadMy);

  const setStatus = async (id: string, status: PrayerStatus) => {
    myRequests.setData((cur) => cur?.map((item) => (item.id === id ? { ...item, status, answered: status === '응답됨' } : item)));
    try {
      await repository.setPrayerStatus(id, status);
    } catch {
      reloadMy();
    }
  };

  const setShared = async (id: string, shared: boolean) => {
    myRequests.setData((cur) => cur?.map((item) => (item.id === id ? { ...item, shared } : item)));
    try {
      await repository.setPrayerShared(id, shared);
    } catch {
      reloadMy();
    }
  };

  const allItems = myRequests.data ?? [];
  const items = useMemo(
    () =>
      allItems.filter(
        (it) =>
          (statusFilter === '전체' || it.status === statusFilter) &&
          (categoryFilter === '전체' || it.category === categoryFilter),
      ),
    [allItems, statusFilter, categoryFilter],
  );

  return (
    <Screen onRefresh={reloadMy}>
      <HeroBanner imageSource={require('@/assets/images/prayer-personal.jpg')} height={170}>
        <ThemedText style={styles.heroTitle}>개인 기도제목</ThemedText>
      </HeroBanner>

      {needsSignIn ? (
        <Card>
          <EmptyState icon="lock-closed-outline" message="로그인하면 나만의 기도제목을 적을 수 있어요." />
          <Button label="로그인하기" icon="log-in-outline" onPress={() => router.push('/sign-in')} />
        </Card>
      ) : (
        <>
          <Button
            label="기도제목 추가"
            icon="add"
            variant="secondary"
            onPress={() => router.push('/prayer/new')}
          />

          {allItems.length > 0 ? (
            <View style={styles.filters}>
              <FilterRow
                options={['전체', ...PRAYER_STATUSES] as StatusFilter[]}
                value={statusFilter}
                onChange={setStatusFilter}
              />
              <FilterRow
                options={['전체', ...PRAYER_CATEGORIES] as CategoryFilter[]}
                value={categoryFilter}
                onChange={setCategoryFilter}
              />
            </View>
          ) : null}

          {myRequests.loading && !myRequests.data ? (
            <LoadingState />
          ) : myRequests.error ? (
            <ErrorState message={myRequests.error} onRetry={myRequests.reload} />
          ) : allItems.length === 0 ? (
            <EmptyState icon="flower-outline" message="나만의 기도제목을 적어 보세요." />
          ) : items.length === 0 ? (
            <EmptyState icon="funnel-outline" message="이 조건에 해당하는 기도제목이 없어요." />
          ) : (
            <View style={styles.stack}>
              {items.map((item) => (
                <MyPrayerCard
                  key={item.id}
                  item={item}
                  onEdit={() => router.push(`/prayer/edit/${item.id}`)}
                  onStatus={(s) => setStatus(item.id, s)}
                  onShare={() => setShared(item.id, true)}
                  onUnshare={() => setShared(item.id, false)}
                />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

/** 가로 스크롤 필터 칩 줄 (상태 / 분류) */
function FilterRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
      {options.map((opt) => {
        const selected = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[
              styles.filterChip,
              {
                backgroundColor: selected ? theme.primary : theme.backgroundElement,
                borderColor: selected ? theme.primary : theme.border,
              },
            ]}>
            <ThemedText type="caption" style={{ color: selected ? theme.onPrimary : theme.textSecondary, fontWeight: selected ? '800' : '600' }}>
              {opt}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** 개인 기도제목 카드 — 분류·상태를 보여 주고, 상태를 바로 바꿀 수 있습니다. */
function MyPrayerCard({
  item,
  onEdit,
  onStatus,
  onShare,
  onUnshare,
}: {
  item: PrayerRequest;
  onEdit: () => void;
  onStatus: (s: PrayerStatus) => void;
  onShare: () => void;
  onUnshare: () => void;
}) {
  const theme = useTheme();
  const closed = item.status === '종료';
  return (
    <Card>
      <View style={styles.rowBetween}>
        <View style={styles.metaRow}>
          <CategoryChip category={item.category} />
          <StatusBadge status={item.status} />
        </View>
        <View style={styles.headRight}>
          <ThemedText type="caption" themeColor="textMuted">
            {formatRelative(item.createdAt)}
          </ThemedText>
          <Pressable onPress={onEdit} hitSlop={8} accessibilityLabel="기도제목 수정">
            <Ionicons name="create-outline" size={18} color={theme.textMuted} />
          </Pressable>
        </View>
      </View>

      <ThemedText type="smallBold" style={closed && styles.closedText}>
        {item.title}
      </ThemedText>
      {item.body ? (
        <ThemedText type="small" themeColor="textSecondary" style={closed && styles.closedText}>
          {item.body}
        </ThemedText>
      ) : null}

      {item.shared ? (
        <View style={styles.sharedRow}>
          <Badge label="기도 요청 중" tone="primary" />
          <ThemedText type="caption" themeColor="textMuted">
            함께 기도 {item.prayCount}번
          </ThemedText>
        </View>
      ) : (
        <Badge label="나만 보기" tone="textSecondary" />
      )}

      {/* 상태 바꾸기 */}
      <ThemedText type="caption" themeColor="textMuted" style={styles.sectionLabel}>
        상태
      </ThemedText>
      <StatusPicker value={item.status} onChange={onStatus} />

      {/* 공개 여부 */}
      {item.shared ? (
        <Button label="기도 요청 내리기" icon="eye-off-outline" variant="ghost" onPress={onUnshare} />
      ) : (
        <Button label="기도 요청으로 올리기" icon="megaphone-outline" variant="ghost" onPress={onShare} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  heroTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  stack: { gap: Spacing.two },
  filters: { gap: Spacing.one },
  filterRow: { gap: Spacing.one, paddingVertical: 2 },
  filterChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, flexWrap: 'wrap', flex: 1 },
  headRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sharedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sectionLabel: { marginTop: Spacing.one },
  closedText: { textDecorationLine: 'line-through', opacity: 0.55 },
});
