import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card, ListRow, SectionHeader } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

/** 중보기도 — 온 성도가 함께 기도하는 공동·중보 기도제목 */
export default function IntercessionScreen() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Screen>
      <View>
        <SectionHeader title="함께 드리는 기도" />
        <Card>
          <ListRow
            icon="people-outline"
            title="공동 기도제목"
            subtitle="온 성도가 함께 기도하는 교회 공통 제목이에요"
            onPress={() => router.push('/prayer/communal')}
          />
          <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 4 }} />
          <ListRow
            icon="hand-right-outline"
            title="중보기도제목"
            subtitle="성도들과 나누고 서로 중보하는 기도제목이에요"
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
