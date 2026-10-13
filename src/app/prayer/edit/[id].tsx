import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, Field, LoadingState, Toggle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { dataMode, repository } from '@/lib/data';

/** 개인 기도제목 수정 — 본인이 올린 제목·내용·익명 여부를 바꿉니다. */
export default function EditPrayerRequestScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    repository
      .getPrayerRequest(String(id))
      .then((found) => {
        if (!active) return;
        if (!found) {
          setNotFound(true);
          return;
        }
        setTitle(found.title);
        setBody(found.body);
        setAnonymous(found.anonymous);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '불러오지 못했습니다.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  const save = async () => {
    if (!title.trim() || !body.trim()) {
      setError('제목과 내용을 모두 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await repository.updatePrayerRequest(String(id), {
        title: title.trim(),
        body: body.trim(),
        anonymous,
        author: user?.name ?? '성도',
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    const remove = async () => {
      try {
        await repository.deletePrayerRequest(String(id));
        router.back();
      } catch (e) {
        setError(e instanceof Error ? e.message : '삭제하지 못했습니다.');
      }
    };
    const message = '이 기도제목을 삭제할까요? 되돌릴 수 없습니다.';
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (window.confirm(message)) void remove();
      return;
    }
    Alert.alert('삭제', message, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => void remove() },
    ]);
  };

  if (dataMode === 'supabase' && !user) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '기도제목 수정' }} />
        <Card>
          <EmptyState icon="lock-closed-outline" message="로그인하면 기도제목을 수정할 수 있습니다." />
          <Button label="로그인하기" icon="log-in-outline" onPress={() => router.replace('/sign-in')} />
        </Card>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '기도제목 수정' }} />
        <LoadingState />
      </Screen>
    );
  }

  if (notFound) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '기도제목 수정' }} />
        <Card>
          <EmptyState icon="flower-outline" message="기도제목을 찾을 수 없습니다." />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: '기도제목 수정' }} />
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
        <Toggle label="익명으로 표시" value={anonymous} onChange={setAnonymous} />
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
        <Button label="수정 완료" icon="save-outline" loading={saving} onPress={() => void save()} />
        <Button label="삭제" icon="trash-outline" variant="danger" onPress={confirmDelete} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three },
});
