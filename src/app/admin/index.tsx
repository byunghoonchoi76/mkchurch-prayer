import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { MemberListDivider, MemberRow } from '@/components/member-row';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card, EmptyState, ErrorState, ListRow, LoadingState, SectionHeader } from '@/components/ui';
import { PARISH_OPTIONS } from '@/constants/church-roles';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { repository, useAsyncData } from '@/lib/data';
import type { AdminMemberPrayerStat, AppMember } from '@/lib/data/types';

/** 초 → '1,284시간 37분' 같은 짧은 표기 (대시보드 타일·목록용) */
function hmLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m ? `${h.toLocaleString('ko-KR')}시간 ${m}분` : `${h.toLocaleString('ko-KR')}시간`;
  if (m > 0) return `${m}분`;
  return `${s}초`;
}

function todayKey(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

// 성도 명단을 한글 초성(ㄱ·ㄴ·ㄷ…)으로 묶기 위한 값들.
const HANGUL_INITIALS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const TENSE_TO_BASE: Record<string, string> = { ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ' };
const MEMBER_GROUP_ORDER = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

/** 이름 첫 글자의 한글 초성(ㄱ·ㄴ·ㄷ…). 영문은 대문자, 그 외(숫자 등)는 '#'. 된소리는 기본 자음으로 묶습니다. */
function memberInitial(name: string): string {
  const ch = (name ?? '').trim().charAt(0);
  if (!ch) return '#';
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const cho = HANGUL_INITIALS[Math.floor((code - 0xac00) / 588)];
    return TENSE_TO_BASE[cho] ?? cho;
  }
  if (/[A-Za-z]/.test(ch)) return ch.toUpperCase();
  return '#';
}

/**
 * 관리자 대시보드 — 교회 관리자가 '기도 참여 현황'과 성도·공동 기도제목을 한곳에서 봅니다.
 * (설정 › 관리자 › 관리자 대시보드)
 */
export default function AdminDashboardScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user, isAdmin } = useAuth();
  const [query, setQuery] = useState('');

  // 요약 수치 + 성도 명단 + 성도별 기도 집계를 함께 불러옵니다.
  const summary = useAsyncData(async () => {
    const [memberCount, communal, members, prayerStats] = await Promise.all([
      repository.countMembers().catch(() => 0),
      repository.listCommunalPrayers().catch(() => []),
      repository.listMembers().catch(() => [] as AppMember[]),
      repository.getAdminPrayerStats().catch(() => [] as AdminMemberPrayerStat[]),
    ]);
    return { memberCount, communalCount: communal.length, members, prayerStats };
  }, []);

  if (!isAdmin) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '관리자 대시보드' }} />
        <EmptyState icon="lock-closed-outline" message="관리자만 볼 수 있는 화면입니다." />
      </Screen>
    );
  }

  const data = summary.data;
  const stats = data?.prayerStats ?? [];

  // ── 집계 ────────────────────────────────────────────────
  const today = todayKey();
  const todayCount = stats.filter((s) => s.todaySec > 0).length;
  const todayTotal = stats.reduce((a, s) => a + s.todaySec, 0);
  const weekCount = stats.filter((s) => s.weekSec > 0).length;
  const weekTotal = stats.reduce((a, s) => a + s.weekSec, 0);
  const allTotal = stats.reduce((a, s) => a + s.totalSec, 0);
  const rate = data && data.memberCount > 0 ? Math.round((todayCount / data.memberCount) * 100) : 0;

  const top = [...stats].filter((s) => s.totalSec > 0).sort((a, b) => b.totalSec - a.totalSec).slice(0, 5);

  const rankDays = (last: string | null) => (last ? Math.round((Date.parse(today) - Date.parse(last)) / 86400000) : 99999);
  const care = stats
    .map((s) => ({ s, days: s.lastPrayed ? Math.round((Date.parse(today) - Date.parse(s.lastPrayed)) / 86400000) : null }))
    .filter((x) => x.days === null || x.days >= 7)
    .sort((a, b) => rankDays(b.s.lastPrayed) - rankDays(a.s.lastPrayed));

  return (
    <Screen onRefresh={summary.reload}>
      <Stack.Screen options={{ title: '관리자 대시보드' }} />

      {/* ── 핵심 요약 ── */}
      <View style={styles.statRow}>
        <StatTile icon="people-outline" label="가입 성도" value={data ? `${data.memberCount}명` : '…'} />
        <StatTile icon="flame-outline" label="오늘 기도" value={data ? `${todayCount}명` : '…'} sub={data ? `참여율 ${rate}%` : undefined} />
      </View>
      <View style={styles.statRow}>
        <StatTile icon="time-outline" label="오늘 기도시간" value={data ? hmLabel(todayTotal) : '…'} />
        <StatTile icon="infinite-outline" label="누적 기도시간" value={data ? hmLabel(allTotal) : '…'} />
      </View>

      {/* ── 최근 7일 참여 현황 ── */}
      <View>
        <SectionHeader title="최근 7일 참여 현황" />
        <Card>
          <View style={styles.weekRow}>
            <View style={styles.weekItem}>
              <ThemedText type="title">{data ? `${weekCount}명` : '…'}</ThemedText>
              <ThemedText type="caption" themeColor="textMuted" fixed>
                기도한 성도
              </ThemedText>
            </View>
            <View style={styles.weekDivider} />
            <View style={styles.weekItem}>
              <ThemedText type="title">{data ? hmLabel(weekTotal) : '…'}</ThemedText>
              <ThemedText type="caption" themeColor="textMuted" fixed>
                총 기도시간
              </ThemedText>
            </View>
          </View>
        </Card>
      </View>

      {/* ── 돌봄이 필요한 성도 (최근 7일 기도 없음) ── */}
      <View>
        <SectionHeader title="돌봄이 필요한 성도" />
        {summary.loading && !data ? (
          <LoadingState />
        ) : care.length === 0 ? (
          <Card>
            <EmptyState icon="heart-outline" message="최근 7일간 모든 성도가 기도에 참여했어요." />
          </Card>
        ) : (
          <CareList items={care} />
        )}
      </View>

      {/* ── 활발한 성도 TOP ── */}
      <View>
        <SectionHeader title="활발한 성도 TOP" />
        {summary.loading && !data ? (
          <LoadingState />
        ) : top.length === 0 ? (
          <Card>
            <EmptyState icon="trophy-outline" message="아직 기도 기록이 없습니다." />
          </Card>
        ) : (
          <TopList items={top} />
        )}
      </View>

      {/* ── 교구별 성도 통계 ── */}
      <View>
        <SectionHeader title="교구별 성도 통계" />
        {summary.loading && !data ? (
          <LoadingState />
        ) : !data || data.members.length === 0 ? (
          <Card>
            <EmptyState icon="pie-chart-outline" message="집계할 성도가 없습니다." />
          </Card>
        ) : (
          <DistributionStats
            members={data.members}
            pick={(m) => m.parish}
            order={PARISH_OPTIONS}
            onSelect={(value) => router.push({ pathname: '/admin/members', params: { field: 'parish', value } })}
          />
        )}
      </View>

      {/* ── 콘텐츠 관리 ── */}
      <View>
        <SectionHeader title="콘텐츠 관리" />
        <Card>
          <ListRow
            icon="megaphone-outline"
            title="공동 기도제목 관리"
            subtitle="말씀선포 기도문을 추가·수정·삭제"
            right={
              <View style={styles.rightRow}>
                {data ? (
                  <ThemedText type="caption" themeColor="textMuted" fixed>
                    {data.communalCount}개
                  </ThemedText>
                ) : null}
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </View>
            }
            onPress={() => router.push('/prayer/communal')}
          />
        </Card>
      </View>

      {/* ── 성도 관리 ── */}
      <View>
        <SectionHeader title="성도 관리" />
        {summary.loading && !data ? (
          <LoadingState />
        ) : summary.error ? (
          <ErrorState message={summary.error} onRetry={summary.reload} />
        ) : !data || data.members.length === 0 ? (
          <EmptyState icon="person-outline" message="아직 가입한 성도가 없습니다." />
        ) : (
          <MemberManager members={data.members} meId={user?.id} query={query} onQuery={setQuery} onChanged={summary.reload} />
        )}
      </View>

      <ThemedText type="caption" themeColor="textMuted" style={styles.note}>
        성도 계정을 삭제하면 되돌릴 수 없습니다. 삭제 전에 한 번 더 확인해 주세요.
      </ThemedText>
    </Screen>
  );
}

/** 돌봄이 필요한 성도 목록 — 마지막 기도일이 오래된(또는 기록 없는) 순. */
function CareList({ items }: { items: { s: AdminMemberPrayerStat; days: number | null }[] }) {
  const theme = useTheme();
  const shown = items.slice(0, 12);
  return (
    <Card>
      <ThemedText type="caption" themeColor="textMuted" style={styles.careHint}>
        최근 7일간 기도 기록이 없는 성도 {items.length}명 · 심방·연락에 참고하세요
      </ThemedText>
      {shown.map((x, i) => (
        <View key={x.s.userId}>
          {i > 0 ? <MemberListDivider /> : null}
          <View style={styles.careRow}>
            <Ionicons name="person-circle-outline" size={22} color={theme.textMuted} />
            <ThemedText type="small" style={styles.flex} numberOfLines={1}>
              {x.s.name}
            </ThemedText>
            <ThemedText type="caption" themeColor={x.days === null ? 'danger' : 'textMuted'} fixed>
              {x.days === null ? '기록 없음' : `${x.days}일 전`}
            </ThemedText>
          </View>
        </View>
      ))}
      {items.length > shown.length ? (
        <ThemedText type="caption" themeColor="textMuted" style={styles.moreHint}>
          외 {items.length - shown.length}명
        </ThemedText>
      ) : null}
    </Card>
  );
}

/** 활발한 성도 TOP — 누적 기도시간 순 막대. */
function TopList({ items }: { items: AdminMemberPrayerStat[] }) {
  const theme = useTheme();
  const max = Math.max(1, items[0]?.totalSec ?? 1);
  return (
    <Card>
      {items.map((s, i) => (
        <View key={s.userId} style={[styles.topRow, i > 0 && styles.topRowGap]}>
          <View style={[styles.rankBadge, { backgroundColor: i === 0 ? theme.primary : theme.backgroundSelected }]}>
            <ThemedText type="caption" fixed style={{ color: i === 0 ? theme.onPrimary : theme.textMuted, fontWeight: '800' }}>
              {i + 1}
            </ThemedText>
          </View>
          <ThemedText type="small" style={styles.topName} numberOfLines={1}>
            {s.name}
          </ThemedText>
          <View style={[styles.parishTrack, { backgroundColor: theme.backgroundSelected }]}>
            <View style={[styles.parishFill, { width: `${Math.max(6, (s.totalSec / max) * 100)}%`, backgroundColor: theme.primary }]} />
          </View>
          <ThemedText type="caption" themeColor="textMuted" fixed style={styles.topTime}>
            {hmLabel(s.totalSec)}
          </ThemedText>
        </View>
      ))}
    </Card>
  );
}

/** 성도 관리 — 이름·교구·직분으로 검색하고, 명단에서 삭제합니다. */
function MemberManager({
  members,
  meId,
  query,
  onQuery,
  onChanged,
}: {
  members: AppMember[];
  meId?: string;
  query: string;
  onQuery: (q: string) => void;
  onChanged: () => void;
}) {
  const theme = useTheme();
  const q = query.trim().toLowerCase();
  const filtered = q
    ? members.filter((m) => [m.name, m.parish, m.position].some((v) => (v ?? '').toLowerCase().includes(q)))
    : members;

  // 이름을 가나다순으로 정렬하고 초성(ㄱ·ㄴ·ㄷ…)별로 묶습니다.
  const sorted = [...filtered].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ko'));
  const groups = new Map<string, AppMember[]>();
  for (const m of sorted) {
    const k = memberInitial(m.name);
    const arr = groups.get(k);
    if (arr) arr.push(m);
    else groups.set(k, [m]);
  }
  const groupKeys = [
    ...MEMBER_GROUP_ORDER.filter((k) => groups.has(k)),
    ...[...groups.keys()].filter((k) => /^[A-Z]$/.test(k)).sort(),
    ...(groups.has('#') ? ['#'] : []),
  ];

  // 초성 헤더를 누르면 그 그룹만 펼칩니다. 검색 중에는 전부 펼쳐 보여 줍니다.
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const searching = q.length > 0;

  return (
    <View style={styles.managerGap}>
      <View style={[styles.search, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Ionicons name="search" size={18} color={theme.textMuted} />
        <TextInput
          value={query}
          onChangeText={onQuery}
          placeholder="이름·교구·직분으로 검색"
          placeholderTextColor={theme.textMuted}
          style={[styles.searchInput, { color: theme.text }]}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => onQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={theme.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {q ? (
        <ThemedText type="caption" themeColor="textMuted">
          검색 결과 {filtered.length}명
        </ThemedText>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState icon="search-outline" message={`'${query.trim()}'에 해당하는 성도가 없습니다.`} />
      ) : (
        <View style={styles.memberGroups}>
          {groupKeys.map((k) => {
            const isOpen = searching || open.has(k);
            return (
              <View key={k}>
                <Pressable
                  onPress={() => toggle(k)}
                  disabled={searching}
                  style={({ pressed }) => [
                    styles.groupHeadRow,
                    { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                    pressed && { opacity: 0.6 },
                  ]}>
                  <ThemedText type="smallBold">{k}</ThemedText>
                  <ThemedText type="caption" themeColor="textMuted" fixed>
                    {groups.get(k)!.length}명
                  </ThemedText>
                  <View style={styles.flex} />
                  {!searching ? <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textMuted} /> : null}
                </Pressable>
                {isOpen ? (
                  <Card style={styles.groupCard}>
                    {groups.get(k)!.map((m, i) => (
                      <View key={m.id}>
                        {i > 0 ? <MemberListDivider /> : null}
                        <MemberRow member={m} isMe={m.id === meId} onDeleted={onChanged} />
                      </View>
                    ))}
                  </Card>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** 상단 요약 타일. */
function StatTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  sub?: string;
}) {
  const theme = useTheme();
  return (
    <Card style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: theme.backgroundSelected }]}>
        <Ionicons name={icon} size={18} color={theme.primary} />
      </View>
      <ThemedText type="title" numberOfLines={1} style={styles.center}>
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textMuted" fixed>
        {label}
      </ThemedText>
      {sub ? (
        <ThemedText type="caption" themeColor="primary" fixed>
          {sub}
        </ThemedText>
      ) : null}
    </Card>
  );
}

/** 성도 분포 막대 통계 (교구별). pick: 분류 값을 꺼내는 함수. order: 보여 줄 순서. */
function DistributionStats({
  members,
  pick,
  order,
  onSelect,
}: {
  members: AppMember[];
  pick: (m: AppMember) => string | undefined;
  order: readonly string[];
  onSelect?: (label: string) => void;
}) {
  const theme = useTheme();

  const counts = new Map<string, number>();
  for (const m of members) {
    const v = pick(m);
    const key = v && v.trim() ? v.trim() : '미지정';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const ordered: string[] = [];
  for (const o of order) if (o !== '미정' && counts.has(o)) ordered.push(o);
  for (const k of counts.keys()) if (!order.includes(k) && k !== '미지정' && k !== '미정') ordered.push(k);
  if (counts.has('미정')) ordered.push('미정');
  if (counts.has('미지정')) ordered.push('미지정');

  const total = members.length;
  const max = Math.max(1, ...ordered.map((k) => counts.get(k) ?? 0));

  return (
    <Card>
      {ordered.map((label, i) => {
        const n = counts.get(label) ?? 0;
        const pct = total > 0 ? Math.round((n / total) * 100) : 0;
        const muted = label === '미지정' || label === '미정';
        const tappable = !!onSelect;
        return (
          <Pressable
            key={label}
            onPress={tappable ? () => onSelect(label) : undefined}
            disabled={!tappable}
            style={({ pressed }) => [styles.parishRow, i > 0 && styles.parishRowGap, tappable && pressed && { opacity: 0.6 }]}>
            <ThemedText type="small" style={styles.parishLabel} numberOfLines={1}>
              {label}
            </ThemedText>
            <View style={[styles.parishTrack, { backgroundColor: theme.backgroundSelected }]}>
              <View style={[styles.parishFill, { width: `${Math.max(6, (n / max) * 100)}%`, backgroundColor: muted ? theme.textMuted : theme.primary }]} />
            </View>
            <ThemedText type="smallBold" style={styles.parishCount} fixed>
              {n}명
            </ThemedText>
            <ThemedText type="caption" themeColor="textMuted" style={styles.parishPct} fixed>
              {pct}%
            </ThemedText>
            {tappable ? <Ionicons name="chevron-forward" size={14} color={theme.textMuted} /> : null}
          </Pressable>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', textAlign: 'center' },
  note: { textAlign: 'center', marginTop: Spacing.one },

  statRow: { flexDirection: 'row', gap: Spacing.three },
  statTile: { flex: 1, alignItems: 'center', gap: Spacing.one },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },

  // 최근 7일 참여
  weekRow: { flexDirection: 'row', alignItems: 'center' },
  weekItem: { flex: 1, alignItems: 'center', gap: 2 },
  weekDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(128,128,128,0.3)' },

  // 돌봄이 필요한 성도
  careHint: { marginBottom: Spacing.two },
  careRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  moreHint: { marginTop: Spacing.two, textAlign: 'center' },

  // 활발한 성도 TOP
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  topRowGap: { marginTop: Spacing.three },
  rankBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  topName: { width: 72 },
  topTime: { width: 86, textAlign: 'right' },

  // 교구별 통계
  parishRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  parishRowGap: { marginTop: Spacing.three },
  parishLabel: { width: 52 },
  parishTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  parishFill: { height: 10, borderRadius: 5 },
  parishCount: { width: 40, textAlign: 'right' },
  parishPct: { width: 36, textAlign: 'right' },

  rightRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },

  // 성도 검색·초성 그룹
  managerGap: { gap: Spacing.two },
  memberGroups: { gap: Spacing.two },
  groupHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  groupCard: { marginTop: Spacing.one },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 2 },
});
