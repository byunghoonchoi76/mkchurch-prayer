import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card } from '@/components/ui';
import { ChurchInfo } from '@/constants/church';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';

/** 계정 삭제 — 앱 안에서 직접 계정과 데이터를 영구 삭제합니다. */
const DELETED_ITEMS = [
  '계정 정보 (이름, 이메일, 교구·직분 등)',
  '나의 기도 기록 및 기도 시간',
  '내가 작성한 개인·공동·중보 기도제목',
];

export default function AccountDeletionScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user, deleteAccount } = useAuth();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  const onConfirm = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await deleteAccount();
      setConfirmOpen(false);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '계정을 삭제하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  // 삭제 완료 화면
  if (done) {
    return (
      <Screen>
        <Card>
          <View style={styles.center}>
            <Ionicons name="checkmark-circle" size={52} color={theme.success} />
            <ThemedText type="heading" style={styles.centerText}>계정이 삭제되었습니다</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              계정과 관련된 모든 데이터가 영구히 삭제되었습니다.{'\n'}그동안 함께해 주셔서 감사합니다.
            </ThemedText>
            <Button label="처음 화면으로" onPress={() => router.replace('/welcome')} />
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <ThemedText type="heading">계정 삭제</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          계정을 삭제하면 아래 정보가 영구히 삭제되며 복구할 수 없습니다.
        </ThemedText>
        <View style={styles.list}>
          {DELETED_ITEMS.map((t) => (
            <View key={t} style={styles.listItem}>
              <Ionicons name="close-circle" size={18} color={theme.danger} />
              <ThemedText type="small" style={styles.flex}>
                {t}
              </ThemedText>
            </View>
          ))}
        </View>
      </Card>

      {user ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            이 작업은 되돌릴 수 없습니다. 신중히 결정해 주세요.
          </ThemedText>
          <Button
            label="계정 삭제"
            variant="danger"
            icon="trash-outline"
            onPress={() => {
              setError(undefined);
              setConfirmOpen(true);
            }}
          />
        </Card>
      ) : (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            계정을 삭제하려면 먼저 로그인해 주세요. (손님으로 둘러보기 중에는 삭제할 계정이 없습니다.)
          </ThemedText>
          <Button label="로그인" icon="log-in-outline" onPress={() => router.push('/sign-in')} />
        </Card>
      )}

      <Card>
        <ThemedText type="smallBold">직접 삭제가 어려우신가요?</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {ChurchInfo.email} 로 “계정 삭제 요청”과 가입하신 이메일 주소를 보내 주시면, 본인 확인 후 처리해 드립니다. (영업일 기준 7일 이내)
        </ThemedText>
      </Card>

      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => !busy && setConfirmOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => !busy && setConfirmOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => {}}>
            <ThemedText type="heading" style={styles.centerText}>정말 삭제하시겠어요?</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              계정과 모든 기도 기록이 영구히 삭제됩니다.{'\n'}이 작업은 되돌릴 수 없습니다.
            </ThemedText>
            {error ? (
              <ThemedText type="small" themeColor="danger" style={styles.centerText}>
                {error}
              </ThemedText>
            ) : null}
            <View style={styles.btnRow}>
              <Button label="취소" variant="ghost" style={styles.flex} onPress={() => setConfirmOpen(false)} />
              <Button label="삭제" variant="danger" style={styles.flex} loading={busy} onPress={() => void onConfirm()} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  centerText: { textAlign: 'center' },
  list: { gap: Spacing.one, marginTop: Spacing.two },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  sheet: {
    width: '86%',
    maxWidth: 340,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  btnRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
});
