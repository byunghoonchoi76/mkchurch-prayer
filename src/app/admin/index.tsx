import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, EmptyState, ErrorState, ListRow, LoadingState, SectionHeader } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { repository, useAsyncData } from '@/lib/data';
import type { AppMember } from '@/lib/data/types';
import { formatDate } from '@/lib/format';

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
                {i > 0 ? <Divider /> : null}
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

/** 성도 한 명 행 — 이름 · 역할 · 가입일 + 삭제. */
function MemberRow({ member, isMe, onDeleted }: { member: AppMember; isMe: boolean; onDeleted: () => void }) {
  const theme = useTheme();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const remove = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await repository.deleteMember(member.id);
      setConfirm(false);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.memberRow}>
      <View style={styles.memberInfo}>
        <View style={styles.memberNameRow}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.flexShrink}>
            {member.name}
          </ThemedText>
          {member.role === 'admin' ? <Badge label="관리자" tone="accent" /> : null}
          {isMe ? <Badge label="나" tone="textSecondary" /> : null}
        </View>
        <ThemedText type="caption" themeColor="textMuted">
          {formatDate(member.createdAt)} 가입
        </ThemedText>
      </View>

      {isMe ? (
        <ThemedText type="caption" themeColor="textMuted" fixed style={styles.selfHint}>
          본인
        </ThemedText>
      ) : (
        <Pressable onPress={() => setConfirm(true)} hitSlop={8} style={styles.delBtn}>
          <Ionicons name="trash-outline" size={18} color={theme.danger} />
        </Pressable>
      )}

      <Modal visible={confirm} transparent animationType="fade" onRequestClose={() => setConfirm(false)}>
        <Pressable style={styles.backdrop} onPress={() => (busy ? null : setConfirm(false))}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => {}}>
            <ThemedText type="smallBold" style={styles.center}>
              {member.name} 님을 삭제할까요?
            </ThemedText>
            <ThemedText type="caption" themeColor="textMuted" style={[styles.center, styles.mt4]}>
              이 성도의 계정이 삭제됩니다. 되돌릴 수 없습니다.
            </ThemedText>
            {error ? (
              <ThemedText type="caption" themeColor="danger" style={[styles.center, styles.mt4]}>
                {error}
              </ThemedText>
            ) : null}
            <View style={styles.btnRow}>
              <Button label="취소" variant="ghost" style={styles.flex} onPress={() => setConfirm(false)} />
              <Button label="삭제" variant="danger" style={styles.flex} loading={busy} onPress={() => void remove()} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
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

  rightRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  memberInfo: { flex: 1, gap: 2 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  selfHint: { paddingHorizontal: Spacing.two },
  delBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  sheet: { width: '86%', maxWidth: 340, borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.four },
  btnRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.four },
});
