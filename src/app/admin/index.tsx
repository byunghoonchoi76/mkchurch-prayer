import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { MemberListDivider, MemberRow } from '@/components/member-row';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, ErrorState, ListRow, LoadingState, SectionHeader } from '@/components/ui';
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

/** 본당 디스플레이의 공개 주소. 배포된 base(…/mkchurch-prayer/)를 그대로 써서 정확한 링크를 만듭니다. */
function displayUrl(): string {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof window === 'undefined') return '';
  const manifest = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  if (manifest?.href) return manifest.href.replace(/manifest\.json(\?.*)?$/, 'display');
  return window.location.origin + '/display';
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
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dispUrl = displayUrl();
  const canShare = Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof (navigator as { share?: unknown }).share === 'function';

  const copyDisplayUrl = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(dispUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      /* 무시 */
    }
  };
  const shareDisplayUrl = async () => {
    try {
      await (navigator as unknown as { share: (d: object) => Promise<void> }).share({ title: '목양교회 본당 기도시간 디스플레이', url: dispUrl });
    } catch {
      /* 취소/실패 시 무시 */
    }
  };

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
          <CareSection items={care} members={data?.members ?? []} />
        )}
      </View>

      {/* ── 활발한 성도 TOP ── */}
      <View>
        <SectionHeader title="활발한 성도 TOP 5" />
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

      {/* ── 교구별 기도시간 현황 ── */}
      <View>
        <SectionHeader title="교구별 기도시간 현황" />
        {summary.loading && !data ? (
          <LoadingState />
        ) : !data || stats.length === 0 ? (
          <Card>
            <EmptyState icon="time-outline" message="아직 기도 기록이 없습니다." />
          </Card>
        ) : (
          <ParishPrayerStats members={data.members} stats={stats} />
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
          <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
          <ListRow
            icon="tv-outline"
            title="본당 기도시간 디스플레이"
            subtitle="링크를 복사해 본당 TV·태블릿 브라우저에서 열어 주세요"
            right={
              <View style={styles.rightRow}>
                <ThemedText type="caption" themeColor="primary" fixed>
                  링크 공유
                </ThemedText>
                <Ionicons name="share-outline" size={16} color={theme.primary} />
              </View>
            }
            onPress={() => {
              setCopied(false);
              setShareOpen(true);
            }}
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

      {/* 본당 디스플레이 링크 공유 */}
      <Modal visible={shareOpen} transparent animationType="fade" onRequestClose={() => setShareOpen(false)}>
        <Pressable style={styles.shareBackdrop} onPress={() => setShareOpen(false)}>
          <Pressable style={[styles.shareSheet, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => {}}>
            <View style={[styles.shareIcon, { backgroundColor: theme.backgroundSelected }]}>
              <Ionicons name="tv-outline" size={22} color={theme.primary} />
            </View>
            <ThemedText type="subtitle" style={styles.center}>
              본당 디스플레이 링크
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              이 링크를 본당 TV·태블릿 브라우저에서 열면,{'\n'}전체 기도시간이 큰 화면으로 표시됩니다. (로그인 불필요)
            </ThemedText>
            <View style={[styles.urlBox, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small" selectable themeColor="primary" style={styles.urlText}>
                {dispUrl || '/display'}
              </ThemedText>
            </View>
            {copied ? (
              <ThemedText type="caption" themeColor="primary" style={styles.center}>
                링크를 복사했어요! TV·태블릿 브라우저에 붙여넣어 여세요.
              </ThemedText>
            ) : null}
            <View style={styles.shareBtnRow}>
              <Button label="미리 보기" variant="ghost" style={styles.flex} onPress={() => { setShareOpen(false); router.push('/display'); }} />
              <Button
                label={canShare ? '공유' : '복사'}
                icon={canShare ? 'share-outline' : 'copy-outline'}
                style={styles.flex}
                onPress={() => void (canShare ? shareDisplayUrl() : copyDisplayUrl())}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

/**
 * 돌봄이 필요한 성도 — 평소엔 '명수'만 보여 주고, 누르면 교구별로 묶인 세부 명단이 펼쳐집니다.
 * (최근 7일 기도 기록이 없는 성도. 심방·연락 참고용)
 */
function CareSection({ items, members }: { items: { s: AdminMemberPrayerStat; days: number | null }[]; members: AppMember[] }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  // 성도 id → 교구. 없으면 '미지정'.
  const parishOf = new Map(members.map((m) => [m.id, m.parish && m.parish.trim() ? m.parish.trim() : '미지정']));
  const groups = new Map<string, { s: AdminMemberPrayerStat; days: number | null }[]>();
  for (const it of items) {
    const p = parishOf.get(it.s.userId) ?? '미지정';
    const arr = groups.get(p);
    if (arr) arr.push(it);
    else groups.set(p, [it]);
  }
  // 교구 순서: 설정된 교구 순 → 그 외 → 미정/미지정 뒤로
  const parishKeys = [
    ...PARISH_OPTIONS.filter((p) => p !== '미정' && groups.has(p)),
    ...[...groups.keys()].filter((k) => !(PARISH_OPTIONS as readonly string[]).includes(k) && k !== '미지정' && k !== '미정'),
    ...(groups.has('미정') ? ['미정'] : []),
    ...(groups.has('미지정') ? ['미지정'] : []),
  ];

  return (
    <Card>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.careSummary, pressed && { opacity: 0.6 }]}>
        <Ionicons name="heart-outline" size={20} color={theme.accent} />
        <ThemedText type="small" style={styles.flex}>
          최근 7일 기도 기록이 없는 성도{' '}
          <ThemedText type="smallBold" themeColor="primary">
            {items.length}명
          </ThemedText>
        </ThemedText>
        <ThemedText type="caption" themeColor="textMuted" fixed>
          {open ? '접기' : '교구별 명단'}
        </ThemedText>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textMuted} />
      </Pressable>

      {open ? (
        <View style={styles.careBody}>
          <ThemedText type="caption" themeColor="textMuted" style={styles.careHint}>
            심방·연락에 참고하세요.
          </ThemedText>
          {parishKeys.map((p) => (
            <View key={p} style={styles.careGroup}>
              <View style={[styles.careGroupHead, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">{p}</ThemedText>
                <ThemedText type="caption" themeColor="textMuted" fixed>
                  {groups.get(p)!.length}명
                </ThemedText>
              </View>
              {groups.get(p)!.map((x, i) => (
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
            </View>
          ))}
        </View>
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

/** 교구별 기도시간 현황 — 성도별 집계를 교구로 모아 누적 기도시간 순으로 보여 줍니다. */
function ParishPrayerStats({ members, stats }: { members: AppMember[]; stats: AdminMemberPrayerStat[] }) {
  const theme = useTheme();

  // 성도 id → 교구. 교구가 없으면 '미지정'.
  const parishOf = new Map(members.map((m) => [m.id, m.parish && m.parish.trim() ? m.parish.trim() : '미지정']));
  const agg = new Map<string, { total: number; week: number; prayed: number }>();
  for (const s of stats) {
    const p = parishOf.get(s.userId) ?? '미지정';
    const cur = agg.get(p) ?? { total: 0, week: 0, prayed: 0 };
    cur.total += s.totalSec;
    cur.week += s.weekSec;
    if (s.totalSec > 0) cur.prayed += 1;
    agg.set(p, cur);
  }

  const rows = [...agg.entries()].map(([parish, v]) => ({ parish, ...v }));
  // 누적 기도시간이 많은 교구부터. '미지정'·'미정'은 맨 뒤로.
  rows.sort((a, b) => {
    const au = a.parish === '미지정' || a.parish === '미정';
    const bu = b.parish === '미지정' || b.parish === '미정';
    if (au !== bu) return au ? 1 : -1;
    return b.total - a.total;
  });

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState icon="time-outline" message="아직 기도 기록이 없습니다." />
      </Card>
    );
  }

  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <Card>
      {rows.map((r, i) => {
        const muted = r.parish === '미지정' || r.parish === '미정';
        return (
          <View key={r.parish} style={i > 0 ? styles.parishRowGap : undefined}>
            <View style={styles.parishRow}>
              <ThemedText type="small" style={styles.parishLabel} numberOfLines={1}>
                {r.parish}
              </ThemedText>
              <View style={[styles.parishTrack, { backgroundColor: theme.backgroundSelected }]}>
                <View style={[styles.parishFill, { width: `${Math.max(6, (r.total / max) * 100)}%`, backgroundColor: muted ? theme.textMuted : theme.primary }]} />
              </View>
              <ThemedText type="caption" themeColor="textMuted" fixed style={styles.topTime}>
                {hmLabel(r.total)}
              </ThemedText>
            </View>
            <ThemedText type="caption" themeColor="textMuted" style={styles.parishPraySub} fixed>
              최근 7일 {hmLabel(r.week)} · {r.prayed}명 기도
            </ThemedText>
          </View>
        );
      })}
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
      <ThemedText numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.5} style={[styles.statValue, styles.center]}>
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
  statValue: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.4 },
  rowDivider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.one, marginLeft: 44 },

  // 본당 디스플레이 링크 공유 모달
  shareBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  shareSheet: { width: '90%', maxWidth: 380, borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.four, gap: Spacing.two, alignItems: 'center' },
  shareIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
  urlBox: { alignSelf: 'stretch', borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2, marginTop: Spacing.one },
  urlText: { fontWeight: '700', textAlign: 'center' },
  shareBtnRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three, alignSelf: 'stretch' },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },

  // 최근 7일 참여
  weekRow: { flexDirection: 'row', alignItems: 'center' },
  weekItem: { flex: 1, alignItems: 'center', gap: 2 },
  weekDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(128,128,128,0.3)' },

  // 돌봄이 필요한 성도
  careHint: { marginBottom: Spacing.two },
  careRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  careSummary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  careBody: { marginTop: Spacing.two, gap: Spacing.two },
  careGroup: { gap: Spacing.one },
  careGroupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },

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
  parishPraySub: { marginTop: 3, marginLeft: 52 + Spacing.two },

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
