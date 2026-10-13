import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, LoadingState, Toggle } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MAX_REMINDERS, type ReminderItem, useReminders } from '@/lib/reminders';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function RemindersScreen() {
  const theme = useTheme();
  const { state, loading, busy, error, addItem, removeItem, setItemDays, setItemTime, save, disable, testNotify } =
    useReminders();

  if (loading) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '기도 알림' }} />
        <LoadingState />
      </Screen>
    );
  }

  if (!state.supported) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '기도 알림' }} />
        <Card style={styles.center}>
          <Ionicons name="notifications-off-outline" size={28} color={theme.textMuted} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            {state.reason ?? '이 기기에서는 알림을 사용할 수 없습니다.'}
          </ThemedText>
          {Platform.OS === 'web' ? (
            <ThemedText type="caption" themeColor="textMuted" style={styles.centerText}>
              아이폰은 사파리에서 <ThemedText type="caption" themeColor="primary">공유 → 홈 화면에 추가</ThemedText> 로 앱을 설치한 뒤 열면 알림을 받을 수 있어요.
            </ThemedText>
          ) : null}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: '기도 알림' }} />

      <Card>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <ThemedText type="smallBold">기도 알림 받기</ThemedText>
            <ThemedText type="caption" themeColor="textMuted">
              정한 요일·시간에 기도하라는 알림을 보내 드려요.
            </ThemedText>
          </View>
          <Toggle label="" value={state.enabled} onChange={(v) => (v ? void save() : void disable())} />
        </View>
        {state.permission === 'denied' ? (
          <ThemedText type="caption" themeColor="danger" style={styles.mt}>
            브라우저에서 알림이 차단되어 있습니다. 사이트 설정에서 알림을 허용해 주세요.
          </ThemedText>
        ) : null}
      </Card>

      <View style={styles.rowBetween}>
        <ThemedText type="smallBold">
          내 알림 <ThemedText type="smallBold" themeColor="primary">{state.items.length}</ThemedText>
          <ThemedText type="caption" themeColor="textMuted"> / {MAX_REMINDERS}개</ThemedText>
        </ThemedText>
        <ThemedText type="caption" themeColor="textMuted">최대 3개까지 설정할 수 있어요</ThemedText>
      </View>

      {state.items.map((item, index) => (
        <ReminderCard
          key={item.slot}
          item={item}
          index={index}
          canRemove={state.items.length > 1}
          onRemove={() => void removeItem(item.slot)}
          onDays={(days) => setItemDays(item.slot, days)}
          onTime={(h, m) => setItemTime(item.slot, h, m)}
        />
      ))}

      {state.items.length < MAX_REMINDERS ? (
        <Button label="알림 추가" icon="add-circle-outline" variant="secondary" onPress={addItem} />
      ) : null}

      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}

      <Button label="이 설정으로 저장" icon="save-outline" loading={busy} onPress={() => void save()} />

      <Button
        label="테스트 알림 보내기"
        icon="paper-plane-outline"
        variant="secondary"
        loading={busy}
        onPress={() => void testNotify()}
      />
      <ThemedText type="caption" themeColor="textMuted" style={styles.centerText}>
        이 버튼을 눌러 알림이 바로 뜨면, 정한 시간에도 알림이 옵니다.
      </ThemedText>

      <Card style={styles.tip}>
        <ThemedText type="caption" themeColor="textSecondary">
          · 알림을 여러 개 만들어 새벽·저녁 등 원하는 시간마다 받을 수 있어요.{'\n'}· 안드로이드/PC는 브라우저에서 바로 받을 수 있어요.{'\n'}· 아이폰은 사파리에서 <ThemedText type="caption" themeColor="primary">공유 → 홈 화면에 추가</ThemedText> 로 설치한 앱에서 열어야 알림이 옵니다.{'\n'}· 기기마다 따로 설정합니다(각 기기에서 한 번씩 켜 주세요).
        </ThemedText>
      </Card>
    </Screen>
  );
}

/** 알림 한 개 카드 — 요일·시간을 정하고, 필요하면 삭제합니다. */
function ReminderCard({
  item,
  index,
  canRemove,
  onRemove,
  onDays,
  onTime,
}: {
  item: ReminderItem;
  index: number;
  canRemove: boolean;
  onRemove: () => void;
  onDays: (days: number[]) => void;
  onTime: (hour: number, minute: number) => void;
}) {
  const theme = useTheme();

  const toggleDay = (d: number) =>
    onDays(item.days.includes(d) ? item.days.filter((x) => x !== d) : [...item.days, d].sort((a, b) => a - b));

  const meridiem: 'am' | 'pm' = item.hour < 12 ? 'am' : 'pm';
  const hour12 = ((item.hour + 11) % 12) + 1; // 1~12
  const setFromParts = (mer: 'am' | 'pm', h12: number, min: number) =>
    onTime((h12 % 12) + (mer === 'pm' ? 12 : 0), min);

  return (
    <Card>
      <View style={styles.cardHead}>
        <View style={styles.cardTitleRow}>
          <View style={[styles.numDot, { backgroundColor: theme.primary }]}>
            <ThemedText type="caption" style={{ color: theme.onPrimary, fontWeight: '800' }}>
              {index + 1}
            </ThemedText>
          </View>
          <ThemedText type="smallBold">
            {meridiem === 'am' ? '오전' : '오후'} {hour12}:{String(item.minute).padStart(2, '0')}
          </ThemedText>
        </View>
        {canRemove ? (
          <Pressable onPress={onRemove} hitSlop={8} style={styles.removeBtn}>
            <Ionicons name="trash-outline" size={18} color={theme.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <ThemedText type="caption" themeColor="textMuted" style={styles.label}>
        요일
      </ThemedText>
      <View style={styles.dayRow}>
        {WEEKDAYS.map((w, d) => {
          const on = item.days.includes(d);
          return (
            <Pressable
              key={w}
              onPress={() => toggleDay(d)}
              style={[
                styles.dayChip,
                { backgroundColor: on ? theme.primary : theme.backgroundElement, borderColor: on ? theme.primary : theme.border },
              ]}>
              <ThemedText type="smallBold" style={{ color: on ? theme.onPrimary : theme.textSecondary }}>
                {w}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText type="caption" themeColor="textMuted" style={styles.label}>
        시간
      </ThemedText>
      <View style={[styles.ampmRow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        {(['am', 'pm'] as const).map((m) => {
          const on = meridiem === m;
          return (
            <Pressable
              key={m}
              onPress={() => setFromParts(m, hour12, item.minute)}
              style={[styles.ampmBtn, on && { backgroundColor: theme.primary }]}>
              <ThemedText type="smallBold" style={{ color: on ? theme.onPrimary : theme.textSecondary }}>
                {m === 'am' ? '오전' : '오후'}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.pickerRow}>
        <NumberPicker
          suffix="시"
          value={hour12}
          options={HOURS}
          format={(v) => `${v}`}
          onSelect={(v) => setFromParts(meridiem, v, item.minute)}
        />
        <NumberPicker
          suffix="분"
          value={item.minute}
          options={MINUTES}
          format={(v) => String(v).padStart(2, '0')}
          onSelect={(v) => onTime(item.hour, v)}
        />
      </View>
    </Card>
  );
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1~12
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0~59

/** 숫자 선택 — 누르면 목록에서 고릅니다. (시 1~12 / 분 00~59) */
function NumberPicker({
  value,
  options,
  format,
  suffix,
  onSelect,
}: {
  value: number;
  options: number[];
  format: (v: number) => string;
  suffix: string;
  onSelect: (v: number) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.pickerField, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <ThemedText type="heading">{format(value)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {suffix}
        </ThemedText>
        <Ionicons name="chevron-down" size={16} color={theme.textMuted} style={styles.pickerCaret} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ScrollView>
              {options.map((o) => {
                const on = o === value;
                return (
                  <Pressable
                    key={o}
                    onPress={() => {
                      onSelect(o);
                      setOpen(false);
                    }}
                    style={[styles.optionRow, on && { backgroundColor: theme.backgroundSelected }]}>
                    <ThemedText type={on ? 'smallBold' : 'small'} themeColor={on ? 'primary' : undefined}>
                      {format(o)}
                      {suffix}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', gap: Spacing.two },
  centerText: { textAlign: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  mt: { marginTop: Spacing.two },
  label: { marginTop: Spacing.two, marginBottom: Spacing.two },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  numDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  removeBtn: { padding: Spacing.one },
  dayRow: { flexDirection: 'row', gap: Spacing.one, justifyContent: 'space-between' },
  dayChip: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ampmRow: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
    marginBottom: Spacing.three,
  },
  ampmBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Radius.pill },
  pickerRow: { flexDirection: 'row', gap: Spacing.three },
  pickerField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pickerCaret: { marginLeft: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  sheet: {
    width: '70%',
    maxHeight: '60%',
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  optionRow: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.four, alignItems: 'center' },
  tip: { marginTop: Spacing.two },
});
