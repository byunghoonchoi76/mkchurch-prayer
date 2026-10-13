import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { YouTubeRef } from '@/lib/youtube';

/** 웹에서는 유튜브 iframe 을 그대로 끼워 넣습니다. */
export function SermonPlayer({ video }: { video: YouTubeRef }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.frame,
        { aspectRatio: video.portrait ? 9 / 16 : 16 / 9, backgroundColor: theme.backgroundSelected },
      ]}>
      {createElement('iframe', {
        src: video.embedUrl,
        title: '설교 영상',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen',
        allowFullScreen: true,
        style: { border: 0, width: '100%', height: '100%', borderRadius: Radius.medium },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: Radius.medium, overflow: 'hidden' },
});
