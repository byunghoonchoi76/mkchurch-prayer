import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Field, LoadingState } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { repository } from '@/lib/data';

export default function CommunalPrayerEditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = String(id) === 'new';

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (isNew) return;
    let active = true;
    repository
      .getCommunalPrayer(String(id))
      .then((found) => {
        if (!active || !found) return;
        setTitle(found.title);
        setBody(found.body);
        setSortOrder(String(found.sortOrder));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '불러오지 못했습니다.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, isNew]);

  const save = async () => {
    if (!title.trim()) {
      setError('기도제목을 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const input = {
        title: title.trim(),
        body: body.trim(),
        sortOrder: Number.parseInt(sortOrder, 10) || 0,
      };
      if (isNew) {
        await repository.createCommunalPrayer(input);
      } else {
        await repository.updateCommunalPrayer(String(id), input);
      }
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
        await repository.deleteCommunalPrayer(String(id));
        router.back();
      } catch (e) {
        setError(e instanceof Error ? e.message : '삭제하지 못했습니다.');
      }
    };
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (window.confirm('삭제할까요? 지금까지 누적된 기도시간도 함께 사라집니다.')) void remove();
      return;
    }
    Alert.alert('삭제', '삭제할까요? 지금까지 누적된 기도시간도 함께 사라집니다.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => void remove() },
    ]);
  };

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? '공동 기도제목 등록' : '공동 기도제목 수정' }} />
      <View style={styles.form}>
        <Field
          label="기도제목"
          value={title}
          onChangeText={setTitle}
          placeholder="예) 민족 복음화와 나라를 위하여"
          maxLength={60}
        />
        <Field
          label="내용 (선택)"
          value={body}
          onChangeText={setBody}
          placeholder="함께 기도할 내용을 적어 주세요."
          multiline
        />
        <Field
          label="표시 순서 (선택)"
          value={sortOrder}
          onChangeText={setSortOrder}
          placeholder="작은 숫자가 위에 옵니다 (예: 1)"
          keyboardType="number-pad"
        />
        {error ? (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        ) : null}
        <Button
          label={isNew ? '등록하기' : '수정 완료'}
          icon="save-outline"
          loading={saving}
          onPress={() => void save()}
        />
        {!isNew ? (
          <Button label="삭제" icon="trash-outline" variant="danger" onPress={confirmDelete} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three },
});
