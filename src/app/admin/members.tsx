import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { MemberListDivider, MemberRow } from '@/components/member-row';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card, EmptyState, ErrorState, LoadingState, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { repository, useAsyncData } from '@/lib/data';
import type { AppMember } from '@/lib/data/types';
import { ageGroupOf } from '@/lib/member-stats';

type Field = 'parish' | 'position' | 'age';

const FIELD_LABEL: Record<Field, string> = { parish: '교구', position: '직분', age: '연령대' };

/** 한 분류(교구·직분·연령대)에 속한 성도 명단 — 관리자 통계에서 눌러 들어옵니다. */
export default function AdminMembersScreen() {
  const { user, isAdmin } = useAuth();
  const params = useLocalSearchParams<{ field?: string; value?: string }>();
  const field: Field = params.field === 'position' ? 'position' : params.field === 'age' ? 'age' : 'parish';
  const value = params.value ?? '미지정';

  const members = useAsyncData(() => repository.listMembers().catch(() => [] as AppMember[]), []);

  const matches = (m: AppMember) => {
    if (field === 'age') return ageGroupOf(m.birthDate) === value;
    const raw = field === 'parish' ? m.parish : m.position;
    const key = raw && raw.trim() ? raw.trim() : '미지정';
    return key === value;
  };

  if (!isAdmin) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '성도 명단' }} />
        <EmptyState icon="lock-closed-outline" message="관리자만 볼 수 있는 화면입니다." />
      </Screen>
    );
  }

  const list = (members.data ?? []).filter(matches);
  // 네비게이션 제목: 교구는 '1교구 성도'처럼, 직분·연령대는 값만 ('성도 성도' 같은 중복 방지)
  const navTitle = field === 'parish' ? `${value} 성도` : value;

  return (
    <Screen onRefresh={members.reload}>
      <Stack.Screen options={{ title: navTitle }} />

      <View style={{ gap: Spacing.one }}>
        <SectionHeader title={`${FIELD_LABEL[field]} · ${value}`} />
        <ThemedText type="caption" themeColor="textMuted">
          모두 {list.length}명
        </ThemedText>
      </View>

      {members.loading && !members.data ? (
        <LoadingState />
      ) : members.error ? (
        <ErrorState message={members.error} onRetry={members.reload} />
      ) : list.length === 0 ? (
        <EmptyState icon="person-outline" message="해당하는 성도가 없습니다." />
      ) : (
        <Card>
          {list.map((m, i) => (
            <View key={m.id}>
              {i > 0 ? <MemberListDivider /> : null}
              <MemberRow member={m} isMe={m.id === user?.id} onDeleted={members.reload} />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
