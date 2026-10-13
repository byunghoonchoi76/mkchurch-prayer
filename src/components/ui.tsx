/** 앱 전반에서 반복해서 쓰는 작은 UI 조각 모음. */
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadow, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function Card({
  children,
  style,
  onPress,
  elevated = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  /** 부드러운 그림자로 배경에서 살짝 띄웁니다. (기본 켜짐. 중첩 카드 등에서는 false) */
  elevated?: boolean;
}) {
  const theme = useTheme();
  // Pressable 도 View 로 렌더되므로 카드 스타일을 그대로 적용해
  // 바깥에서 준 flex 값이 그대로 살아 있게 합니다.
  const cardStyle = [
    styles.card,
    { backgroundColor: theme.card, borderColor: theme.border },
    elevated && Shadow.card,
    style,
  ];

  if (!onPress) return <View style={cardStyle}>{children}</View>;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [cardStyle, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  accent = true,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  /** 제목 앞에 작은 강조 막대를 붙여 리듬을 줍니다. (기본 켜짐) */
  accent?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        {accent ? <View style={[styles.sectionAccent, { backgroundColor: theme.primary }]} /> : null}
        <ThemedText type="heading">{title}</ThemedText>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <ThemedText type="link">{actionLabel}</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Badge({
  label,
  tone = 'primary',
}: {
  label: string;
  tone?: Extract<ThemeColor, 'primary' | 'accent' | 'success' | 'danger' | 'textSecondary'>;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: theme[tone] + '22', borderColor: theme[tone] + '55' }]}>
      <ThemedText type="caption" style={{ color: theme[tone], fontWeight: '700' }}>
        {label}
      </ThemedText>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const isFilled = variant === 'primary' || variant === 'danger';
  const background =
    variant === 'primary'
      ? theme.primary
      : variant === 'danger'
        ? theme.danger
        : variant === 'secondary'
          ? theme.backgroundSelected
          : 'transparent';
  const foreground = isFilled ? theme.onPrimary : theme.primary;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          borderColor: variant === 'ghost' ? theme.border : 'transparent',
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={16} color={foreground} /> : null}
          <ThemedText type="smallBold" style={{ color: foreground }}>
            {label}
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  style,
  multiline,
  ...rest
}: TextInputProps & { label: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        placeholderTextColor={theme.textMuted}
        multiline={multiline}
        style={[
          styles.input,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
            color: theme.text,
          },
          multiline && styles.inputMultiline,
          style,
        ]}
        {...rest}
      />
      {hint ? (
        <ThemedText type="caption" themeColor="textMuted">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={styles.toggle}>
      <Ionicons
        name={value ? 'checkbox' : 'square-outline'}
        size={22}
        color={value ? theme.primary : theme.textMuted}
      />
      <ThemedText type="small">{label}</ThemedText>
    </Pressable>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.listRow, pressed && onPress ? styles.pressed : null]}>
      {icon ? (
        <View style={[styles.listIcon, { backgroundColor: theme.backgroundSelected }]}>
          <Ionicons name={icon} size={18} color={theme.primary} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <ThemedText type="smallBold">{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="caption" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={theme.textMuted} /> : null)}
    </Pressable>
  );
}

export function EmptyState({ icon = 'leaf-outline', message }: { icon?: IconName; message: string }) {
  const theme = useTheme();
  return (
    <View style={styles.centered}>
      <Ionicons name={icon} size={32} color={theme.textMuted} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
        {message}
      </ThemedText>
    </View>
  );
}

export function LoadingState({ message = '불러오는 중…' }: { message?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={theme.primary} />
      <ThemedText type="small" themeColor="textSecondary">
        {message}
      </ThemedText>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.centered}>
      <Ionicons name="alert-circle-outline" size={32} color={theme.danger} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
        {message}
      </ThemedText>
      {onRetry ? <Button label="다시 시도" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  card: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sectionAccent: { width: 4, height: 18, borderRadius: Radius.pill },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two + 3,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  field: { gap: Spacing.one },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
    minHeight: 44,
  },
  inputMultiline: { minHeight: 120, textAlignVertical: 'top' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  listIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  centerText: { textAlign: 'center' },
});
