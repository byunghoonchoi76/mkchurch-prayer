import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * 개인정보 수집·이용 동의 체크박스.
 * withTerms=true 이면 이용약관 동의도 함께 포함합니다(회원가입용).
 */
export function ConsentCheck({
  checked,
  onChange,
  withTerms = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  withTerms?: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => onChange(!checked)}
      style={[styles.row, { borderColor: checked ? theme.primary : theme.border, backgroundColor: theme.backgroundElement }]}>
      <Ionicons
        name={checked ? 'checkbox' : 'square-outline'}
        size={22}
        color={checked ? theme.primary : theme.textMuted}
      />
      <View style={styles.textWrap}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
          {withTerms ? (
            <>
              <LinkText label="이용약관" onPress={() => router.push('/terms')} />
              {' 및 '}
              <LinkText label="개인정보처리방침" onPress={() => router.push('/privacy')} />
              에 동의합니다. (필수)
            </>
          ) : (
            <>
              <LinkText label="개인정보 수집·이용" onPress={() => router.push('/privacy')} />
              에 동의합니다. (필수)
            </>
          )}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <ThemedText type="smallBold" style={{ color: theme.primary, textDecorationLine: 'underline' }} onPress={onPress}>
      {label}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  textWrap: { flex: 1 },
  text: { lineHeight: 20 },
});
