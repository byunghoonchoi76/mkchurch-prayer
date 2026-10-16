import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card, ListRow, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dataMode, repository, useAsyncData } from '@/lib/data';

/** 기도제목 — 개인 · 공동 · 중보 기도제목을 한곳에서 */
export default function PrayerTopicsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const needsSignIn = dataMode === 'supabase' && !user;

  // 각 카테고리의 기도제목 개수를 미리 보여 줍니다. (로그인 필요하면 비움)
  const counts = useAsyncData(
    async () => {
      if (needsSignIn) return null;
      const [personal, communal, intercession] = await Promise.all([
        repository.listMyPrayerRequests().catch(() => []),
        repository.listCommunalPrayers().catch(() => []),
        repository.listSharedPrayerRequests().catch(() => []),
      ]);
      return { personal: personal.length, communal: communal.length, intercession: intercession.length };
    },
    [needsSignIn],
  );
  const c = counts.data ?? null;

  return (
    <Screen onRefresh={counts.reload}>
      <View>
        <SectionHeader title="나의 기도" />
        <Card>
          <ListRow
            icon="flower-outline"
            title="개인 기도제목"
            subtitle="나만 보는 기도제목"
            right={<CountRight n={c?.personal} />}
            onPress={() => router.push('/prayer/personal')}
          />
        </Card>
      </View>

      <View>
        <SectionHeader title="함께 드리는 기도" />
        <Card>
          <ListRow
            icon="people-outline"
            title="공동 기도제목"
            subtitle="온 성도가 함께 드리는 기도"
            right={<CountRight n={c?.communal} />}
            onPress={() => router.push('/prayer/communal')}
          />
          <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 4 }} />
          <ListRow
            icon="hand-right-outline"
            title="중보기도제목"
            subtitle="서로를 위해 드리는 기도"
            right={<CountRight n={c?.intercession} />}
            onPress={() => router.push('/prayer/requests')}
          />
        </Card>
      </View>

      <ThemedText type="caption" themeColor="textMuted" style={{ textAlign: 'center' }}>
        사랑하는 이들과 교회를 위해 함께 기도해요.
      </ThemedText>
    </Screen>
  );
}

/** 목록 행 오른쪽 — 개수 + 화살표. (개수를 아직 모르면 화살표만) */
function CountRight({ n }: { n?: number }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
      {typeof n === 'number' ? (
        <View style={{ paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: 999, backgroundColor: theme.backgroundSelected }}>
          <ThemedText type="caption" themeColor="textSecondary" fixed>
            {n}개
          </ThemedText>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
    </View>
  );
}
