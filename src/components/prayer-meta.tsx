import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  PRAYER_CATEGORIES,
  PRAYER_CATEGORY_COLORS,
  PRAYER_STATUSES,
  type PrayerCategory,
  type PrayerStatus,
} from '@/lib/data/types';

/** 상태별 색상 키 (테마 색상 이름) */
const STATUS_TONE: Record<PrayerStatus, 'primary' | 'success' | 'textMuted'> = {
  기도중: 'primary',
  응답됨: 'success',
  종료: 'textMuted',
};

/** 분류(카테고리) 색상 칩 — 점 + 이름 */
export function CategoryChip({ category }: { category: PrayerCategory }) {
  const color = PRAYER_CATEGORY_COLORS[category];
  return (
    <View style={[styles.chip, { backgroundColor: color + '1A', borderColor: color + '55' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText type="caption" style={{ color, fontWeight: '700' }}>
        {category}
      </ThemedText>
    </View>
  );
}

/** 상태 배지 — 기도중(갈색)·응답됨(초록)·종료(회색) */
export function StatusBadge({ status }: { status: PrayerStatus }) {
  const theme = useTheme();
  const color = theme[STATUS_TONE[status]];
  return (
    <View style={[styles.chip, { backgroundColor: color + '1A', borderColor: color + '55' }]}>
      <ThemedText type="caption" style={{ color, fontWeight: '700' }}>
        {status}
      </ThemedText>
    </View>
  );
}

/** 분류 선택 — 가로로 늘어선 칩에서 하나를 고릅니다. (기도제목 작성·수정) */
export function CategoryPicker({
  value,
  onChange,
}: {
  value: PrayerCategory;
  onChange: (c: PrayerCategory) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.pickerWrap}>
      {PRAYER_CATEGORIES.map((c) => {
        const color = PRAYER_CATEGORY_COLORS[c];
        const selected = c === value;
        return (
          <Pressable
            key={c}
            onPress={() => onChange(c)}
            style={[
              styles.pickerChip,
              {
                backgroundColor: selected ? color + '22' : theme.backgroundElement,
                borderColor: selected ? color : theme.border,
              },
            ]}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <ThemedText type="small" style={{ color: selected ? color : theme.textSecondary, fontWeight: selected ? '700' : '500' }}>
              {c}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 상태 선택 — 3단계(기도중·응답됨·종료) 세그먼트. (기도제목 카드) */
export function StatusPicker({
  value,
  onChange,
}: {
  value: PrayerStatus;
  onChange: (s: PrayerStatus) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segment, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      {PRAYER_STATUSES.map((s) => {
        const selected = s === value;
        const color = theme[STATUS_TONE[s]];
        return (
          <Pressable
            key={s}
            onPress={() => onChange(s)}
            style={[styles.segmentItem, selected && { backgroundColor: color + '22', borderColor: color }]}>
            {s === '응답됨' && selected ? (
              <Ionicons name="checkmark-circle" size={13} color={color} style={{ marginRight: 3 }} />
            ) : null}
            <ThemedText type="caption" style={{ color: selected ? color : theme.textMuted, fontWeight: selected ? '800' : '600' }}>
              {s}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pickerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    gap: 3,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
