import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { dataMode, repository, useAsyncData } from '@/lib/data';
import type { PrayerRequest } from '@/lib/data/types';
import { durationLabel } from '@/lib/format';
import { useAllPrayerTime } from '@/lib/prayer-log';

/** 기도 시작(오늘의 기도) 진입에 쓰는 다이얼 이미지 */
const START_IMAGE = require('@/assets/images/prayer-start.png');

/** 기도하기 — 오늘 기도 누적을 보여 주고, 다이얼을 누르면 '오늘의 기도'로 들어갑니다. */
export default function MyPrayerScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const active = useAllPrayerTime();

  const topics = useAsyncData<PrayerRequest[]>(
    () => (dataMode === 'supabase' && !user ? Promise.resolve([]) : repository.listMyPrayerRequests()),
    [user],
  );
  useFocusEffect(topics.reload);
  const pending = (topics.data ?? []).filter((t) => t.status === '기도중').length;

  return (
    <Screen>
      <Card elevated style={styles.timerCard}>
        <ThemedText type="caption" themeColor="textMuted" style={styles.center}>
          오늘 기도{' '}
          <ThemedText type="smallBold" themeColor="primary">
            {active.todayMinutes > 0 ? durationLabel(active.todayMinutes) : '0분'}
          </ThemedText>
        </ThemedText>

        <Pressable
          onPress={() => router.push('/prayer/today')}
          accessibilityRole="button"
          accessibilityLabel="오늘의 기도 시작"
          style={({ pressed }) => [styles.startImageBtn, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
          <Image source={START_IMAGE} style={styles.startImage} contentFit="cover" transition={200} />
        </Pressable>

        <ThemedText type="smallBold" themeColor="primary" style={styles.center}>
          눌러서 오늘의 기도
        </ThemedText>
        <ThemedText type="caption" themeColor="textMuted" style={styles.center}>
          {pending > 0 ? `기도할 제목 ${pending}개를 하나씩 기도해요` : '기도제목을 하나씩 넘기며 기도해요'}
        </ThemedText>
      </Card>

      <ThemedText type="caption" themeColor="textMuted" style={styles.note}>
        기도제목은 ‘기도제목’ 탭에서, 기록·통계는 ‘기도 기록’ 탭에서 볼 수 있어요.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', textAlign: 'center' },
  note: { textAlign: 'center', marginTop: Spacing.one },
  timerCard: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.four },
  startImageBtn: { width: 220, height: 220, borderRadius: 110, alignSelf: 'center', overflow: 'hidden' },
  startImage: { width: '100%', height: '100%' },
});
