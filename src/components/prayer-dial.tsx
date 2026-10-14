import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';

// 시작 버튼 이미지(+1H prayer)에서 뽑은 색 — 다이얼과 통일합니다.
export const DIAL_BLUE = '#1B498E';
export const DIAL_GOLD = '#EADB4E';

/**
 * 아날로그 기도 다이얼 — 파란 원판 위에 60개의 흰색 눈금이 시계처럼 둘려 있고,
 * 초가 지날수록 눈금이 노란색으로 채워지며 초침이 함께 돕니다. 가운데에는
 * 디지털 시간(MM:SS)을 크게 표시합니다.
 */
export function PrayerDial({
  seconds,
  display,
  paused,
  size = 268,
}: {
  seconds: number;
  display: string;
  paused?: boolean;
  size?: number;
}) {
  const c = size / 2;
  const rDisc = c - 6; // 파란 원판 반지름
  const rOuter = c - 16; // 눈금 바깥쪽
  const rInner = rOuter - 15; // 짧은 눈금 안쪽
  const rInnerLong = rOuter - 24; // 긴 눈금(5칸마다) 안쪽

  const secOfMin = seconds % 60; // 이번 분 안에서의 초 (0~59)

  const ticks = [];
  for (let i = 0; i < 60; i += 1) {
    const a = ((-90 + i * 6) * Math.PI) / 180; // 맨 위(12시)에서 시작
    const long = i % 5 === 0;
    const ri = long ? rInnerLong : rInner;
    const passed = i <= secOfMin; // 초침이 지나온 눈금은 노랗게 채웁니다
    ticks.push(
      <Line
        key={i}
        x1={c + ri * Math.cos(a)}
        y1={c + ri * Math.sin(a)}
        x2={c + rOuter * Math.cos(a)}
        y2={c + rOuter * Math.sin(a)}
        stroke={passed ? DIAL_GOLD : 'rgba(255,255,255,0.4)'}
        strokeWidth={long ? 3.5 : 2}
        strokeLinecap="round"
      />,
    );
  }

  // 초침 — 가운데에서 현재 초 위치까지
  const ha = ((-90 + secOfMin * 6) * Math.PI) / 180;
  const handLen = rInnerLong - 4;
  const timeSize = Math.round(size * 0.172);

  return (
    <View style={styles.dialWrap}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={rDisc} fill={DIAL_BLUE} />
        {ticks}
        <Line x1={c} y1={c} x2={c + handLen * Math.cos(ha)} y2={c + handLen * Math.sin(ha)} stroke={DIAL_GOLD} strokeWidth={3} strokeLinecap="round" />
        <Circle cx={c} cy={c} r={4.5} fill={DIAL_GOLD} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.dialCenter]} pointerEvents="none">
        <ThemedText style={[styles.dialTime, { fontSize: timeSize, lineHeight: Math.round(timeSize * 1.15) }]}>{display}</ThemedText>
        <ThemedText style={styles.dialLabel}>{paused ? '일시정지' : '기도중'}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dialWrap: { alignSelf: 'center' },
  dialCenter: { alignItems: 'center', justifyContent: 'center' },
  dialTime: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  dialLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    letterSpacing: 2,
    marginTop: 2,
  },
});
