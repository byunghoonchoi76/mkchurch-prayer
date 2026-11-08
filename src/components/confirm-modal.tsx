import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * 앱 자체 디자인의 확인창.
 * 웹의 window.confirm 은 브라우저가 사이트 주소("...github.io 내용:")를 강제로 붙여서,
 * 대신 이 모달을 써서 깔끔하게 보여 줍니다. (iOS·Android·웹 공통)
 */
export function ConfirmModal({
  visible,
  title,
  message,
  cancelLabel = '취소',
  confirmLabel = '확인',
  confirmDanger = false,
  hideCancel = false,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmDanger?: boolean;
  hideCancel?: boolean; // 단순 안내(확인 하나)일 때 true
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => {}}>
          <ThemedText type="subtitle" style={styles.center}>
            {title}
          </ThemedText>
          {message ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {message}
            </ThemedText>
          ) : null}
          <View style={styles.btnRow}>
            {hideCancel ? null : <Button label={cancelLabel} variant="ghost" style={styles.flex} onPress={onCancel} />}
            <Button label={confirmLabel} variant={confirmDanger ? 'danger' : 'primary'} style={styles.flex} onPress={onConfirm} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  sheet: {
    width: '88%',
    maxWidth: 360,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  center: { alignItems: 'center', textAlign: 'center' },
  btnRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
  flex: { flex: 1 },
});
