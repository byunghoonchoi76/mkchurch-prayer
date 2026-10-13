import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, Field } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';

const CALENDARS = ['양력', '음력'] as const;

/** 내 정보 수정 — 이름·생년월일(양력/음력)·직분·소속. */
export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, updateProfile } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [birthDate, setBirthDate] = useState(user?.birthDate ?? '');
  const [birthCalendar, setBirthCalendar] = useState<'양력' | '음력'>(user?.birthCalendar ?? '양력');
  const [position, setPosition] = useState(user?.position ?? '');
  const [affiliation, setAffiliation] = useState(user?.affiliation ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  if (!user) {
    return (
      <Screen>
        <Card>
          <EmptyState icon="person-outline" message="로그인한 성도만 내 정보를 수정할 수 있습니다." />
          <Button label="로그인" icon="log-in-outline" onPress={() => router.replace('/sign-in')} />
        </Card>
      </Screen>
    );
  }

  const save = async () => {
    if (!name.trim()) {
      setError('이름을 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await updateProfile({
        name: name.trim(),
        birthDate: birthDate.trim(),
        birthCalendar,
        position: position.trim(),
        affiliation: affiliation.trim(),
      });
      setDone(true);
      setTimeout(() => router.back(), 700);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
        생년월일·직분·소속은 선택 항목입니다. 입력하신 정보는 교회 안내 목적으로만 사용됩니다.
      </ThemedText>

      <View style={styles.form}>
        <Field label="이름" value={name} onChangeText={setName} placeholder="성함" />

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              생년월일 (선택)
            </ThemedText>
            <View style={styles.chipRow}>
              {CALENDARS.map((option) => {
                const active = option === birthCalendar;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setBirthCalendar(option)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? theme.primary : theme.backgroundElement,
                        borderColor: active ? theme.primary : theme.border,
                      },
                    ]}>
                    <ThemedText type="caption" style={{ color: active ? theme.onPrimary : theme.textSecondary, fontWeight: '700' }}>
                      {option}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <TextInput
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="예) 1976-03-15"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { backgroundColor: theme.backgroundElement, borderColor: theme.border, color: theme.text }]}
          />
        </View>

        <Field label="직분 (선택)" value={position} onChangeText={setPosition} placeholder="예) 집사, 권사, 장로, 성도" />
        <Field label="소속 (선택)" value={affiliation} onChangeText={setAffiliation} placeholder="예) 1교구 · OO목장" />

        {error ? (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        ) : null}
        {done ? (
          <ThemedText type="small" themeColor="success">
            저장되었습니다.
          </ThemedText>
        ) : null}

        <Button label="저장" icon="checkmark-circle-outline" loading={saving} onPress={() => void save()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { lineHeight: 20 },
  form: { gap: Spacing.three },
  field: { gap: Spacing.one },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chipRow: { flexDirection: 'row', gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    minHeight: 48,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
});
