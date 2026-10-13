import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { HeroBanner } from '@/components/hero-banner';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dataMode, repository, useAsyncData } from '@/lib/data';
import type { PrayerRequest } from '@/lib/data/types';
import { formatRelative } from '@/lib/format';

/** 개인 기도제목 — 나만 보는 목록. 원하면 '기도 요청'으로 올려 성도들과 함께 기도할 수 있습니다. */
export default function PersonalPrayerScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const needsSignIn = dataMode === 'supabase' && !user;

  const myRequests = useAsyncData(
    () => (needsSignIn ? Promise.resolve([]) : repository.listMyPrayerRequests()),
    [needsSignIn],
  );
  const reloadMy = myRequests.reload;
  useFocusEffect(reloadMy);

  const toggleAnswered = async (id: string, answered: boolean) => {
    myRequests.setData((cur) => cur?.map((item) => (item.id === id ? { ...item, answered } : item)));
    try {
      await repository.markPrayerAnswered(id, answered);
    } catch {
      /* 화면은 유지하고 다음 새로고침에서 맞춥니다. */
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

  const myItems = myRequests.data ?? [];

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
          {myRequests.loading && !myRequests.data ? (
            <LoadingState />
          ) : myRequests.error ? (
            <ErrorState message={myRequests.error} onRetry={myRequests.reload} />
          ) : myItems.length === 0 ? (
            <EmptyState icon="flower-outline" message="나만의 기도제목을 적어 보세요." />
          ) : (
            <View style={styles.stack}>
              {myItems.map((item) => (
                <MyPrayerCard
                  key={item.id}
                  item={item}
                  onEdit={() => router.push(`/prayer/edit/${item.id}`)}
                  onToggleAnswered={() => toggleAnswered(item.id, !item.answered)}
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

/** 개인 기도제목 카드 — 나만 보이며, 원하면 '기도 요청'으로 공개할 수 있습니다. */
function MyPrayerCard({
  item,
  onEdit,
  onToggleAnswered,
  onShare,
  onUnshare,
}: {
  item: PrayerRequest;
  onEdit: () => void;
  onToggleAnswered: () => void;
  onShare: () => void;
  onUnshare: () => void;
}) {
  const theme = useTheme();
  return (
    <Card>
      <View style={styles.rowBetween}>
        {item.shared ? (
          <Badge label="기도 요청 중" tone="primary" />
        ) : (
          <Badge label="나만 보기" tone="textSecondary" />
        )}
        <View style={styles.headRight}>
          <ThemedText type="caption" themeColor="textMuted">
            {formatRelative(item.createdAt)}
          </ThemedText>
          <Pressable onPress={onEdit} hitSlop={8} accessibilityLabel="기도제목 수정">
            <Ionicons name="create-outline" size={18} color={theme.textMuted} />
          </Pressable>
        </View>
      </View>
      <ThemedText type="smallBold">{item.title}</ThemedText>
      {item.body ? (
        <ThemedText type="small" themeColor="textSecondary">
          {item.body}
        </ThemedText>
      ) : null}
      {item.shared ? (
        <ThemedText type="caption" themeColor="textMuted">
          함께 기도 {item.prayCount}번 · 성도들이 함께 기도하고 있어요
        </ThemedText>
      ) : null}
      {item.shared ? (
        <Button label="기도 요청 내리기" icon="eye-off-outline" variant="ghost" onPress={onUnshare} />
      ) : (
        <Button label="기도 요청으로 올리기" icon="megaphone-outline" variant="secondary" onPress={onShare} />
      )}
      <Button
        label={item.answered ? '다시 기도 중으로' : '기도 응답되었어요'}
        icon={item.answered ? 'refresh-outline' : 'checkmark-circle-outline'}
        variant="ghost"
        onPress={onToggleAnswered}
      />
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
  headRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
