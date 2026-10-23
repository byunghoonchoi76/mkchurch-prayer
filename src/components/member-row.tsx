import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge, Button } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { repository } from '@/lib/data';
import type { AppMember } from '@/lib/data/types';
import { formatDate } from '@/lib/format';

/** 성도 한 명 행 — 이름·역할 + 교구·직분·가입일 + 삭제. (관리자 대시보드·명단 공통) */
export function MemberRow({ member, isMe, onDeleted }: { member: AppMember; isMe: boolean; onDeleted: () => void }) {
  const theme = useTheme();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // 교구 · 직분 · 가입일 을 한 줄로 (빈 값은 건너뜀)
  const meta = [member.parish, member.position].filter(Boolean).join(' · ');

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
          {meta ? `${meta} · ` : ''}
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

/** 성도 목록 구분선. */
export function MemberListDivider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  center: { alignItems: 'center', textAlign: 'center' },
  mt4: { marginTop: 4 },
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
