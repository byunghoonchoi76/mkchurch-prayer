import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'subtitle' | 'heading' | 'body' | 'small' | 'smallBold' | 'caption' | 'link' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'], fontFamily: Fonts.sans },
        styles[type],
        type === 'link' && { color: theme.primary },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: { fontSize: 16, lineHeight: 24 },
  title: { fontSize: 28, lineHeight: 35, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 22, lineHeight: 29, fontWeight: '700', letterSpacing: -0.4 },
  heading: { fontSize: 18, lineHeight: 25, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 26 },
  small: { fontSize: 14, lineHeight: 21 },
  smallBold: { fontSize: 14, lineHeight: 21, fontWeight: '700', letterSpacing: -0.1 },
  caption: { fontSize: 12, lineHeight: 18 },
  link: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: '700' }) ?? '500',
    fontSize: 12,
  },
});
