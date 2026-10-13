import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, Field, Toggle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { dataMode, repository } from '@/lib/data';

export default function NewPrayerRequestScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [shared, setShared] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      setError('제목과 내용을 모두 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await repository.createPrayerRequest({
        title: title.trim(),
        body: body.trim(),
        author: user?.name ?? '성도',
        authorId: user?.id,
        anonymous,
        shared,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // Supabase 를 쓰는 경우 로그인한 성도만 기도제목을 올릴 수 있습니다.
  if (dataMode === 'supabase' && !user) {
    return (
      <Screen>
        <Card>
          <EmptyState icon="lock-closed-outline" message="로그인하면 기도제목을 나눌 수 있습니다." />
          <Button label="로그인하기" icon="log-in-outline" onPress={() => router.replace('/sign-in')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.form}>
        <Field
          label="기도제목"
          placeholder="예) 어머니 수술을 앞두고 기도 부탁드립니다"
          value={title}
          onChangeText={setTitle}
          maxLength={60}
        />
        <Field
          label="내용"
          placeholder="함께 기도할 내용을 나눠 주세요."
          value={body}
          onChangeText={setBody}
          multiline
        />
        <Toggle label="함께 기도해주세요" value={shared} onChange={setShared} />
        <Toggle label="익명으로 올리기" value={anonymous} onChange={setAnonymous} />
        {anonymous ? (
          <ThemedText type="caption" themeColor="textMuted">
            기도 요청으로 공개할 때 이름 대신 &lsquo;익명&rsquo;으로 표시됩니다.
          </ThemedText>
        ) : null}
        {error ? (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        ) : null}
        <Button label="나누기" icon="send-outline" loading={saving} onPress={() => void submit()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three },
});
