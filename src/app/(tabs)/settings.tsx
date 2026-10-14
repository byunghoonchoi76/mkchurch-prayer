import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, ListRow, SectionHeader, Toggle } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dataMode, repository, useAsyncData } from '@/lib/data';
import { resetSampleData } from '@/lib/data/sample-repository';
import { usePrayerBgm } from '@/lib/prayer-bgm';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, isAdmin, signOut } = useAuth();
  const profile = useAsyncData(() => repository.getChurchProfile());

  return (
    <Screen>
      <Card>
        {user ? (
          <>
            <ThemedText type="heading">{user.name}님</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {user.email ?? (isAdmin ? '관리자 계정' : '성도 계정')}
            </ThemedText>
            {isAdmin ? <Badge label="관리자" tone="accent" /> : null}
            <Button label="내 정보 수정" variant="secondary" icon="create-outline" onPress={() => router.push('/profile')} />
            <Button label="로그아웃" variant="ghost" icon="log-out-outline" onPress={() => void signOut()} />
          </>
        ) : (
          <>
            <ThemedText type="heading">로그인이 필요합니다</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              로그인하면 이름으로 기도제목을 나누고, 기도 기록이 계정에 안전하게 저장됩니다.
            </ThemedText>
            <Button label="로그인" icon="log-in-outline" onPress={() => router.push('/sign-in')} />
          </>
        )}
      </Card>

      <View>
        <SectionHeader title="알림" />
        <Card>
          <ListRow
            icon="notifications-outline"
            title="기도 알림"
            subtitle="정한 요일·시간에 기도 알림을 받아요"
            onPress={() => router.push('/reminders')}
          />
        </Card>
      </View>

      <MusicSettings />

      {isAdmin ? (
        <Card>
          <ThemedText type="heading">관리자</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            온 성도가 함께 기도할 공동 기도제목을 등록·수정할 수 있습니다.
          </ThemedText>
          <Button label="공동 기도제목 관리" icon="people-outline" onPress={() => router.push('/prayer/communal')} />
        </Card>
      ) : null}

      <View>
        <SectionHeader title="약관 · 정책" />
        <Card>
          <ListRow
            icon="shield-checkmark-outline"
            title="개인정보처리방침"
            onPress={() => router.push('/privacy')}
          />
          <ListRow icon="document-text-outline" title="이용약관" onPress={() => router.push('/terms')} />
        </Card>
      </View>

      <View>
        <SectionHeader title="앱 정보" />
        <Card>
          <ListRow
            icon="server-outline"
            title="데이터 모드"
            subtitle={
              dataMode === 'supabase'
                ? 'Supabase 에 연결되어 있습니다.'
                : '샘플 데이터로 동작 중입니다. 추가한 내용은 이 기기에만 저장됩니다.'
            }
            right={<Badge label={dataMode === 'supabase' ? 'Supabase' : '샘플'} tone={dataMode === 'supabase' ? 'success' : 'textSecondary'} />}
          />
          <ListRow icon="information-circle-outline" title="버전" subtitle="1.0.0" />
          {dataMode === 'sample' ? (
            <Button
              label="샘플 데이터 초기화"
              variant="ghost"
              icon="refresh-outline"
              onPress={() => {
                void resetSampleData().then(() => profile.reload());
              }}
            />
          ) : null}
        </Card>
      </View>
    </Screen>
  );
}

/** 기도 배경음악 — 켜기/끄기 + 음악 선택 + 미리듣기 */
function MusicSettings() {
  const theme = useTheme();
  const bgm = usePrayerBgm();
  const [previewing, setPreviewing] = useState(false);

  // 설정 탭을 벗어나면 미리듣기를 멈춥니다.
  const stop = bgm.stop;
  useFocusEffect(
    useCallback(() => {
      return () => stop();
    }, [stop]),
  );

  const togglePreview = () => {
    if (previewing) {
      bgm.stop();
      setPreviewing(false);
    } else {
      bgm.start();
      setPreviewing(true);
    }
  };

  const select = (id: string) => {
    bgm.setChoice(id);
    // 미리듣는 중이면 새로 고른 음악으로 바로 바꿔 들려줍니다.
    if (previewing) setTimeout(() => bgm.start(), 80);
  };

  const onToggle = (v: boolean) => {
    bgm.setEnabled(v);
    if (!v) {
      bgm.stop();
      setPreviewing(false);
    }
  };

  return (
    <View>
      <SectionHeader title="기도 배경음악" />
      <Card>
        <Toggle label="기도할 때 배경음악" value={bgm.enabled} onChange={onToggle} />

        {bgm.enabled ? (
          <>
            <View style={[styles.sep, { backgroundColor: theme.border }]} />
            {bgm.options.map((opt) => {
              const selected = bgm.choice === opt.id;
              return (
                <Pressable key={opt.id} onPress={() => select(opt.id)} style={styles.musicRow}>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selected ? theme.primary : theme.textMuted}
                  />
                  <ThemedText type="small" style={{ color: selected ? theme.primary : theme.text, fontWeight: selected ? '700' : '500' }}>
                    {opt.name}
                  </ThemedText>
                </Pressable>
              );
            })}

            {bgm.available ? (
              <Button
                label={previewing ? '미리듣기 정지' : '미리듣기'}
                icon={previewing ? 'stop' : 'play'}
                variant="secondary"
                onPress={togglePreview}
              />
            ) : null}

            <ThemedText type="caption" themeColor="textMuted">
              고른 음악은 기도 타이머를 시작할 때 자동으로 재생돼요.
            </ThemedText>
          </>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  sep: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.one },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
  },
});
