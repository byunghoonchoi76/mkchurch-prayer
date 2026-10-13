import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { YouTubeRef } from '@/lib/youtube';

/** iOS·안드로이드에서는 WebView 로 유튜브 재생기를 띄웁니다. */
export function SermonPlayer({ video }: { video: YouTubeRef }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.frame,
        { aspectRatio: video.portrait ? 9 / 16 : 16 / 9, backgroundColor: theme.backgroundSelected },
      ]}>
      <WebView
        source={{ uri: video.embedUrl }}
        style={styles.webview}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: Radius.medium, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: 'transparent' },
});
