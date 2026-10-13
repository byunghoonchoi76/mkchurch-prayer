import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HeroBanner } from '@/components/hero-banner';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dataMode, repository, useAsyncData } from '@/lib/data';
import { formatRelative } from '@/lib/format';

/** '함께 기도'를 이미 누른 기도제목 ID 목록(이 기기 기준) 저장 키 */
const PRAYED_KEY = 'church-app/prayed-requests';

/** 기도 요청 — 성도들이 함께 기도하도록 공개된 기도제목 목록. */
export default function PrayerRequestsScreen() {
  const theme = useTheme();
  const { user, isAdmin } = useAuth();
  const needsSignIn = dataMode === 'supabase' && !user;

  const sharedRequests = useAsyncData(
    () => (needsSignIn ? Promise.resolve([]) : repository.listSharedPrayerRequests()),
    [needsSignIn],
  );
  const reloadShared = sharedRequests.reload;
  useFocusEffect(reloadShared);

  // 이미 '함께 기도'를 누른 기도제목(이 기기 기준) — 한 번만 누르도록 막습니다.
  const [prayedIds, setPrayedIds] = useState<Set<string>>(new Set());
  const prayedRef = useRef<Set<string>>(new Set()); // 연속 탭 즉시 차단용
  useEffect(() => {
    AsyncStorage.getItem(PRAYED_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const ids = JSON.parse(raw) as string[];
          prayedRef.current = new Set(ids);
          setPrayedIds(new Set(ids));
        } catch {
          /* noop */
        }
      })
      .catch(() => {});
  }, []);

  const toggleAnswered = async (id: string, answered: boolean) => {
    sharedRequests.setData((cur) => cur?.map((item) => (item.id === id ? { ...item, answered } : item)));
    try {
      await repository.markPrayerAnswered(id, answered);
    } catch {
      reloadShared();
    }
  };

  const pray = async (id: string) => {
    // 이미 누른 기도제목이면 무시합니다. (연속 탭도 ref 로 즉시 차단)
    if (prayedRef.current.has(id)) return;
    prayedRef.current.add(id);
    const next = new Set(prayedRef.current);
    setPrayedIds(next);
    void AsyncStorage.setItem(PRAYED_KEY, JSON.stringify([...next])).catch(() => {});

    sharedRequests.setData((cur) =>
      cur?.map((item) => (item.id === id ? { ...item, prayCount: item.prayCount + 1 } : item)),
    );
    try {
      const updated = await repository.prayForRequest(id);
      sharedRequests.setData((cur) => cur?.map((item) => (item.id === id ? updated : item)));
    } catch {
      reloadShared();
    }
  };

  const sharedItems = sharedRequests.data ?? [];
  const prayingCount = sharedItems.filter((item) => !item.answered).length;
  const answeredCount = sharedItems.filter((item) => item.answered).length;
  const togetherCount = sharedItems.reduce((sum, item) => sum + item.prayCount, 0);

  return (
    <Screen onRefresh={reloadShared}>
      <HeroBanner imageSource={require('@/assets/images/prayer-requests.jpg')} height={170}>
        <ThemedText style={styles.heroTitle}>중보기도제목</ThemedText>
      </HeroBanner>

      {needsSignIn ? (
        <Card>
          <EmptyState icon="lock-closed-outline" message="중보기도제목은 로그인한 성도만 볼 수 있습니다." />
        </Card>
      ) : sharedRequests.loading && !sharedRequests.data ? (
        <LoadingState />
      ) : sharedRequests.error ? (
        <ErrorState message={sharedRequests.error} onRetry={sharedRequests.reload} />
      ) : sharedItems.length === 0 ? (
        <EmptyState icon="hand-right-outline" message="아직 올라온 중보기도제목이 없습니다." />
      ) : (
        <View style={styles.stack}>
          <StatusCounter
            total={sharedItems.length}
            praying={prayingCount}
            answered={answeredCount}
            together={togetherCount}
          />
          {sharedItems.map((item) => (
            <Card key={item.id}>
              <View style={styles.rowBetween}>
                {item.answered ? <Badge label="응답됨" tone="success" /> : <Badge label="기도 중" tone="primary" />}
                <ThemedText type="caption" themeColor="textMuted">
                  {formatRelative(item.createdAt)}
                </ThemedText>
              </View>
              <ThemedText type="smallBold">{item.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.body}
              </ThemedText>
              <View style={styles.rowBetween}>
                <ThemedText type="caption" themeColor="textMuted">
                  {item.author}
                </ThemedText>
                {(() => {
                  const prayed = prayedIds.has(item.id);
                  return (
                    <Pressable
                      onPress={() => void pray(item.id)}
                      disabled={prayed}
                      style={({ pressed }) => [
                        styles.prayButton,
                        {
                          borderColor: prayed ? theme.success : theme.border,
                          backgroundColor: prayed ? theme.backgroundSelected : 'transparent',
                          opacity: pressed ? 0.6 : 1,
                        },
                      ]}>
                      <Ionicons
                        name={prayed ? 'checkmark-circle' : 'hand-right-outline'}
                        size={14}
                        color={prayed ? theme.success : theme.primary}
                      />
                      <ThemedText type="caption" style={{ color: prayed ? theme.success : theme.primary, fontWeight: '700' }}>
                        {prayed ? '기도했어요' : '함께 기도'} {item.prayCount}
                      </ThemedText>
                    </Pressable>
                  );
                })()}
              </View>

              {isAdmin || (user && item.authorId && item.authorId === user.id) ? (
                <Button
                  label={item.answered ? '다시 기도 중으로' : '기도 응답되었어요'}
                  icon={item.answered ? 'refresh-outline' : 'checkmark-circle-outline'}
                  variant="ghost"
                  onPress={() => void toggleAnswered(item.id, !item.answered)}
                />
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

/**
 * 우리의 기도노트 — 조지 뮬러의 '기도 응답 기록' 개념을 담은 현황판.
 * 성도들이 올린 기도제목 총량과, 기도 중 / 응답됨 / 함께 기도 현황을 다 함께 확인합니다.
 */
function StatusCounter({
  total,
  praying,
  answered,
  together,
}: {
  total: number;
  praying: number;
  answered: number;
  together: number;
}) {
  const theme = useTheme();
  const stats: { label: string; value: number; icon: React.ComponentProps<typeof Ionicons>['name']; color: string }[] = [
    { label: '기도제목', value: total, icon: 'book', color: theme.text },
    { label: '기도 중', value: praying, icon: 'hand-right', color: theme.primary },
    { label: '응답됨', value: answered, icon: 'checkmark-circle', color: theme.success },
    { label: '함께 기도', value: together, icon: 'people', color: theme.accent },
  ];
  return (
    <Card style={styles.noteCard}>
      <View style={styles.noteHead}>
        <Ionicons name="journal-outline" size={16} color={theme.primary} />
        <ThemedText type="smallBold" themeColor="primary">
          우리의 기도노트
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.noteVerse}>
        “하나님께서 우리 삶 가운데 일하고 계십니다.”
      </ThemedText>

      <View style={[styles.noteDivider, { backgroundColor: theme.border }]} />

      <View style={styles.counterRow}>
        {stats.map((s, i) => (
          <View key={s.label} style={styles.counterCell}>
            {i > 0 ? <View style={[styles.counterDivider, { backgroundColor: theme.border }]} /> : null}
            <Ionicons name={s.icon} size={17} color={s.color} />
            <ThemedText type="heading" style={{ color: s.color }}>
              {s.value.toLocaleString('ko-KR')}
            </ThemedText>
            <ThemedText type="caption" themeColor="textMuted" numberOfLines={1}>
              {s.label}
            </ThemedText>
          </View>
        ))}
      </View>
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
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  noteCard: { gap: Spacing.two },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  noteVerse: { fontStyle: 'italic' },
  noteDivider: { height: StyleSheet.hairlineWidth, marginTop: Spacing.one },
  counterRow: { flexDirection: 'row', alignItems: 'stretch' },
  counterCell: { flex: 1, alignItems: 'center', gap: 2, position: 'relative' },
  counterDivider: { position: 'absolute', left: 0, top: '15%', bottom: '15%', width: StyleSheet.hairlineWidth },
  prayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
