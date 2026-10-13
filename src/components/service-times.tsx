import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ServiceTime } from '@/lib/data';

/** '주일 오전 7:30' 처럼 앞에 붙는 요일 표현들 */
const DAY_PREFIXES = [
  '주일',
  '월~금',
  '월~토',
  '화~토',
  '화~금',
  '매일',
  '월요일',
  '화요일',
  '수요일',
  '목요일',
  '금요일',
  '토요일',
];

/** 예배 시간 문자열을 요일과 시각으로 나눕니다. 형식이 다르면 통째로 시각으로 둡니다. */
function splitSchedule(schedule: string): { day: string; time: string } {
  const trimmed = schedule.trim();
  for (const prefix of DAY_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      return {
        day: prefix.replace('요일', ''),
        time: trimmed.slice(prefix.length).trim(),
      };
    }
  }
  return { day: '그 외', time: trimmed };
}

/** '오전 9:30' · '오후 2:00' 을 자정부터의 분으로 바꿉니다. 형식이 다르면 null. */
function parseTimeToMinutes(time: string): number | null {
  const match = time.match(/(오전|오후)?\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const [, meridiem, rawHour, rawMinute] = match;
  let hour = Number(rawHour);
  if (meridiem === '오후' && hour < 12) hour += 12;
  if (meridiem === '오전' && hour === 12) hour = 0;

  return hour * 60 + Number(rawMinute);
}

interface DayGroup {
  day: string;
  items: { id: string; time: string; name: string; place: string; note?: string }[];
}

/** 같은 요일끼리 묶습니다. 순서는 원래 목록 순서를 따릅니다. */
function groupByDay(services: ServiceTime[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const service of services) {
    const { day, time } = splitSchedule(service.schedule);
    const found = groups.find((g) => g.day === day);
    const item = {
      id: service.id,
      time,
      name: service.name,
      place: service.place,
      note: service.note,
    };
    if (found) found.items.push(item);
    else groups.push({ day, items: [item] });
  }

  // 같은 요일 안에서는 이른 시간부터 보여 줍니다.
  // 시간을 읽지 못한 항목은 원래 순서를 지키며 뒤로 보냅니다.
  for (const group of groups) {
    group.items.sort((a, b) => {
      const left = parseTimeToMinutes(a.time);
      const right = parseTimeToMinutes(b.time);
      if (left === null && right === null) return 0;
      if (left === null) return 1;
      if (right === null) return -1;
      return left - right;
    });
  }

  return groups;
}

/**
 * 예배 시간을 요일별로 묶어 촘촘하게 보여 줍니다.
 * 한 줄에 시각과 예배 이름이 함께 들어가 목록이 길어지지 않습니다.
 * `showPlace` 를 켜면 장소와 참고 사항까지 함께 보여 줍니다.
 */
export function ServiceTimesCompact({
  services,
  showPlace = false,
}: {
  services: ServiceTime[];
  showPlace?: boolean;
}) {
  const theme = useTheme();
  const groups = groupByDay(services);

  return (
    <Card style={styles.card}>
      {groups.map((group, index) => (
        <View key={group.day}>
          {index > 0 ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
          <View style={styles.groupRow}>
            <View style={[styles.dayChip, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="caption" style={{ color: theme.primary, fontWeight: '700' }}>
                {group.day}
              </ThemedText>
            </View>

            <View style={styles.items}>
              {group.items.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <ThemedText type="smallBold" style={styles.time}>
                    {item.time}
                  </ThemedText>
                  <View style={styles.flex}>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {item.name}
                    </ThemedText>
                    {/* 장소·참고 사항은 이름 아래 작은 줄로 내려 줄바꿈이 지저분해지지 않게 합니다. */}
                    {showPlace && (item.place || item.note) ? (
                      <ThemedText type="caption" themeColor="textMuted" numberOfLines={1}>
                        {[item.place, item.note].filter(Boolean).join(' · ')}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: 0, paddingVertical: Spacing.two + 2 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.two },
  groupRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  dayChip: {
    minWidth: 52,
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    marginTop: 1,
  },
  items: { flex: 1, gap: 3 },
  itemSpaced: { marginBottom: Spacing.one },
  itemRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  time: { width: 78 },
});
