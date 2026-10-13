import {
  Image,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ChurchInfo } from '@/constants/church';
import {
  LogoMarkRatio,
  LogoSource,
  LogoWhite,
  LogoWhiteRatio,
  LogoWordmark,
  LogoWordmarkRatio,
} from '@/constants/logo';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * 교회 CI 심볼.
 * `src/constants/logo.ts` 에 공식 로고 파일을 연결하면 그 이미지를 쓰고,
 * 아직 없으면 CI 색(남색·청록)으로 그린 임시 심볼을 보여 줍니다.
 */
export function ChurchMark({ size = 36, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const u = size / 36;

  if (LogoSource) {
    return (
      <Image
        source={LogoSource}
        // 원본 비율을 지켜 높이에 맞춥니다.
        style={[{ width: size * LogoMarkRatio, height: size }, style as StyleProp<ImageStyle>]}
        resizeMode="contain"
        accessibilityLabel={`${ChurchInfo.name} 로고`}
      />
    );
  }

  return (
    <View style={[styles.mark, { width: size, height: size }, style]}>
      {/* 왼쪽 기둥 (남색) */}
      <View
        style={{
          width: 7 * u,
          height: 17 * u,
          backgroundColor: Brand.navy,
          borderTopLeftRadius: 3 * u,
          borderTopRightRadius: 3 * u,
        }}
      />
      {/* 가운데 본당 : 지붕 + 몸통 (청록) */}
      <View style={styles.spire}>
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: 9 * u,
            borderRightWidth: 9 * u,
            borderBottomWidth: 10 * u,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: Brand.teal,
          }}
        />
        <View style={{ width: 13 * u, height: 16 * u, backgroundColor: Brand.teal }} />
      </View>
      {/* 오른쪽 기둥 (밝은 청록) */}
      <View
        style={{
          width: 7 * u,
          height: 13 * u,
          backgroundColor: Brand.tealLight,
          borderTopLeftRadius: 3 * u,
          borderTopRightRadius: 3 * u,
        }}
      />
    </View>
  );
}

/**
 * 어두운 배경(남색 카드 등)에 쓰는 가로형 로고.
 * 교회명이 흰색으로 들어 있는 공식 CI 원본을 그대로 씁니다.
 */
export function ChurchLogoWhite({ width = 150 }: { width?: number }) {
  return (
    <Image
      source={LogoWhite}
      style={{ width, height: width / LogoWhiteRatio }}
      resizeMode="contain"
      accessibilityLabel={`${ChurchInfo.name} 로고`}
    />
  );
}

/** 심볼 + 교회 이름을 함께 보여 주는 로고 잠금 형태 */
export function ChurchLogo({
  size = 32,
  color,
  subtitle,
  verse,
}: {
  size?: number;
  color?: string;
  /** 교회 표어 */
  subtitle?: string;
  /** 표어의 성구 출처 */
  verse?: string;
}) {
  const theme = useTheme();
  // 교회명은 공식 CI에서 잘라낸 '목양교회' 워드마크를 씁니다. 흰색 실루엣이라 글자 색을 입혀 줍니다.
  const wordmarkColor = color ?? theme.text;
  // 워드마크 높이는 심볼보다 살짝 작게 맞춰 균형을 잡습니다.
  const wordmarkHeight = Math.round(size * 0.62);

  return (
    <View style={styles.logoRow}>
      <ChurchMark size={size} />
      <View style={styles.flex}>
        <Image
          source={LogoWordmark}
          tintColor={wordmarkColor}
          resizeMode="contain"
          style={{ width: wordmarkHeight * LogoWordmarkRatio, height: wordmarkHeight }}
          accessibilityLabel={ChurchInfo.name}
        />
        {subtitle ? (
          <ThemedText type="small" style={color ? { color, opacity: 0.9 } : undefined} themeColor="primary">
            {subtitle}
          </ThemedText>
        ) : null}
        {verse ? (
          <ThemedText type="caption" style={color ? { color, opacity: 0.7 } : undefined} themeColor="textMuted">
            {verse}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 1 },
  spire: { alignItems: 'center' },
  flex: { flex: 1 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
