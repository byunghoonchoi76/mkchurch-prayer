import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, ListRow, SectionHeader, Toggle } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dataMode, repository, useAsyncData } from '@/lib/data';
import { resetSampleData } from '@/lib/data/sample-repository';
import { FONT_OPTIONS, MAX_PT, MIN_PT, preloadAllFonts, useFontScaleControl, type FontKey } from '@/lib/font-scale';
import { usePrayerBgm } from '@/lib/prayer-bgm';
import { GOAL_CONFIG, useWeeklyGoal } from '@/lib/prayer-goal';
import { goalLabel } from '@/lib/prayer-stats';

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

      <GoalSettings />

      <FontSizeSettings />

      <FontFamilySettings />

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

      <ThemedText type="caption" themeColor="textMuted" style={styles.copyright}>
        © 2026 구리 목양교회.
      </ThemedText>
    </Screen>
  );
}

/** 글자 크기 — 슬라이더로 앱 전체 글자 크기를 조절(어르신 가독성) */
/** 주간 기도 목표 시간 — '기도 기록'의 이번 주 달성률 기준이 됩니다. */
function GoalSettings() {
  const theme = useTheme();
  const { goal, setGoal } = useWeeklyGoal('personal');
  const cfg = GOAL_CONFIG.personal;
  const maxHours = Math.round(cfg.max / 60);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const start = () => {
    setText(String(Math.round((goal / 60) * 10) / 10));
    setError(undefined);
    setOpen(true);
  };
  const apply = async () => {
    const hours = parseFloat(text.replace(/,/g, '').trim());
    if (!Number.isFinite(hours) || hours <= 0) {
      setError('시간을 숫자로 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await setGoal(Math.round(hours * 60));
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <SectionHeader title="기도 목표" />
      <Card>
        <ThemedText type="smallBold">주간 기도 목표</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          일주일 동안 기도할 목표 시간이에요. ‘기도 기록’의 달성률에 쓰입니다.
        </ThemedText>
        <View style={styles.goalStepRow}>
          <Pressable onPress={() => void setGoal(goal - cfg.step)} hitSlop={8} style={[styles.goalStep, { borderColor: theme.border }]}>
            <Ionicons name="remove" size={18} color={theme.textSecondary} />
          </Pressable>
          <Pressable onPress={start} style={[styles.goalValueBtn, { borderColor: theme.primary, backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="caption" themeColor="textMuted" numberOfLines={1}>목표 </ThemedText>
            <ThemedText type="smallBold" themeColor="primary" numberOfLines={1} style={styles.flexShrink}>{goalLabel(goal)}</ThemedText>
            <Ionicons name="create-outline" size={14} color={theme.primary} style={{ marginLeft: 4 }} />
          </Pressable>
          <Pressable onPress={() => void setGoal(goal + cfg.step)} hitSlop={8} style={[styles.goalStep, { borderColor: theme.border }]}>
            <Ionicons name="add" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>
      </Card>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.goalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.goalSheet, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => {}}>
            <ThemedText type="smallBold" style={styles.goalCenter}>주간 기도 목표 시간</ThemedText>
            <ThemedText type="caption" themeColor="textMuted" style={styles.goalCenter}>일주일 동안 기도할 목표 시간이에요.</ThemedText>
            <View style={[styles.goalInputRow, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
              <TextInput
                value={text}
                onChangeText={setText}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                style={[styles.goalInput, { color: theme.text }]}
                autoFocus
              />
              <ThemedText type="small" themeColor="textSecondary">시간</ThemedText>
            </View>
            <ThemedText type="caption" themeColor="textMuted" style={styles.goalCenter}>
              1 ~ {maxHours.toLocaleString('ko-KR')}시간 사이로 입력하세요.
            </ThemedText>
            {error ? (
              <ThemedText type="caption" themeColor="danger" style={styles.goalCenter}>
                {error}
              </ThemedText>
            ) : null}
            <View style={styles.goalBtnRow}>
              <Button label="취소" variant="ghost" style={styles.flex} onPress={() => setOpen(false)} />
              <Button label="저장" style={styles.flex} loading={saving} onPress={() => void apply()} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function FontSizeSettings() {
  const theme = useTheme();
  const { pt, setPt } = useFontScaleControl();
  const [trackW, setTrackW] = useState(0);
  const frac = (pt - MIN_PT) / (MAX_PT - MIN_PT);

  const apply = (x: number) => {
    if (trackW <= 0) return;
    const f = Math.min(1, Math.max(0, x / trackW));
    setPt(MIN_PT + f * (MAX_PT - MIN_PT));
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => apply(e.nativeEvent.locationX),
      onPanResponderMove: (e) => apply(e.nativeEvent.locationX),
    }),
  ).current;

  return (
    <View>
      <SectionHeader title="글자 크기" />
      <Card>
        <View style={styles.rowBetween}>
          <View style={styles.fsHead}>
            <Ionicons name="text" size={18} color={theme.primary} />
            <ThemedText type="smallBold">글자 크기</ThemedText>
          </View>
          <View style={[styles.ptBadge, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="caption" themeColor="primary" style={styles.bold800}>
              {pt}pt
            </ThemedText>
          </View>
        </View>
        <ThemedText type="caption" themeColor="textMuted">
          슬라이더를 움직이거나 ‘가’를 눌러 조절하세요
        </ThemedText>

        <View style={styles.sliderRow}>
          <Pressable onPress={() => setPt(pt - 1)} hitSlop={12} style={styles.gaBtn}>
            <Text style={{ fontSize: 16, color: theme.textSecondary, fontWeight: '700' }}>가</Text>
          </Pressable>
          <View style={styles.trackWrap} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)} {...pan.panHandlers}>
            <View style={[styles.track, { backgroundColor: theme.border }]} />
            <View style={[styles.trackFill, { width: `${frac * 100}%`, backgroundColor: theme.primary }]} />
            <View style={[styles.thumb, { left: `${frac * 100}%`, backgroundColor: theme.primary, borderColor: theme.card }]} />
          </View>
          <Pressable onPress={() => setPt(pt + 1)} hitSlop={12} style={styles.gaBtn}>
            <Text style={{ fontSize: 30, color: theme.textSecondary, fontWeight: '800' }}>가</Text>
          </Pressable>
        </View>

        <View style={[styles.previewBox, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="caption" themeColor="textMuted">미리보기</ThemedText>
          <ThemedText type="body" style={styles.centerText}>
            주님의 은혜가 늘 함께하시길 기도합니다.
          </ThemedText>
        </View>
      </Card>
    </View>
  );
}

/** 글꼴 — 미리보기를 보며 원하는 글꼴을 고릅니다(앱 전체 적용) */
function FontFamilySettings() {
  const theme = useTheme();
  const { family, setFamily } = useFontScaleControl();

  // 미리보기가 각 글꼴로 보이도록 모든 글꼴을 불러옵니다.
  useEffect(() => {
    preloadAllFonts();
  }, []);

  return (
    <View>
      <SectionHeader title="글꼴" />
      <Card>
        <ThemedText type="caption" themeColor="textMuted">
          미리보기를 보고 원하는 글꼴을 고르세요
        </ThemedText>
        {FONT_OPTIONS.map((opt, i) => {
          const selected = family === opt.key;
          return (
            <View key={opt.key}>
              {i > 0 ? <View style={[styles.sep, { backgroundColor: theme.border }]} /> : null}
              <Pressable onPress={() => setFamily(opt.key as FontKey)} style={styles.fontRow}>
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={selected ? theme.primary : theme.textMuted}
                />
                <View style={styles.flex}>
                  <View style={styles.fontLabelRow}>
                    <ThemedText type="smallBold" style={{ color: selected ? theme.primary : theme.text }}>
                      {opt.label}
                    </ThemedText>
                    <ThemedText type="caption" themeColor="textMuted">
                      {opt.note}
                    </ThemedText>
                  </View>
                  {/* 미리보기 — 해당 글꼴로 렌더링 */}
                  <Text style={[styles.fontPreview, { color: theme.text, fontFamily: opt.stack }]}>주님, 오늘도 함께해 주세요</Text>
                </View>
              </Pressable>
            </View>
          );
        })}
      </Card>
    </View>
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
  copyright: { textAlign: 'center', marginTop: Spacing.two, marginBottom: Spacing.one },

  // 기도 목표
  flexShrink: { flexShrink: 1 },
  goalCenter: { alignItems: 'center', textAlign: 'center', marginTop: 4 },
  goalStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    columnGap: Spacing.three,
    rowGap: Spacing.two,
    marginTop: Spacing.two,
  },
  goalStep: { width: 36, height: 36, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  goalValueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    paddingVertical: 8,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  goalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  goalSheet: { width: '86%', maxWidth: 340, borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.four, gap: Spacing.one },
  goalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  goalInput: { fontSize: 22, fontWeight: '700', textAlign: 'right', minWidth: 120, paddingVertical: 0 },
  goalBtnRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.four },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
  },

  // 글자 크기
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fsHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  bold800: { fontWeight: '800' },
  ptBadge: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Radius.pill },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.two },
  gaBtn: { width: 34, alignItems: 'center', justifyContent: 'center' },
  trackWrap: { flex: 1, height: 36, justifyContent: 'center' },
  track: { height: 6, borderRadius: 3 },
  trackFill: { position: 'absolute', left: 0, height: 6, borderRadius: 3 },
  thumb: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    marginLeft: -13,
    borderWidth: 3,
  },
  previewBox: { marginTop: Spacing.three, padding: Spacing.three, borderRadius: Radius.medium, gap: Spacing.one, alignItems: 'center' },
  centerText: { textAlign: 'center' },

  // 글꼴 선택
  flex: { flex: 1 },
  fontRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  fontLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  fontPreview: { fontSize: 18, marginTop: 3 },
});
