import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useGlobalSearchParams, useRouter } from 'expo-router';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AppState, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeroBanner } from '@/components/hero-banner';
import { PrayerDial } from '@/components/prayer-dial';
import { CategoryChip } from '@/components/prayer-meta';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dataMode, repository, useAsyncData } from '@/lib/data';
import type { CommunalPrayer, PrayerCategory, PrayerRequest } from '@/lib/data/types';
import { durationLabel, stackedDuration } from '@/lib/format';
import { usePrayerBgm } from '@/lib/prayer-bgm';
import {
  isCategoryAll,
  TODAY_PRAYER_LABEL,
  TODAY_PRAYER_ORDER,
  toggleCategoryAll,
  toggleId,
  useTodaySelection,
  type TodayPrayerKind,
  type TodaySelection,
} from '@/lib/today-prayer';
import { useAutoAdvance, useDailyGoal, useWeeklyGoal } from '@/lib/prayer-goal';
import { useAllPrayerTime, usePrayerTime } from '@/lib/prayer-log';
import { clearActiveSession, loadActiveSession, saveActiveSession } from '@/lib/prayer-session';
import { cancelPrayerNudge, schedulePrayerNudge } from '@/lib/prayer-nudge';
import { ConfirmModal } from '@/components/confirm-modal';
import { allTimeSeconds, goalLabel, monthSeconds, weekSeconds } from '@/lib/prayer-stats';

/** 기도 시작 버튼에 쓰는 다이얼 이미지 */
const START_IMAGE = require('@/assets/images/prayer-start.png');
/** 기도하기 홈 상단 배너 이미지 (등대 — 빛·인도) */
const HOME_HERO = require('@/assets/images/prayer-home-hero.jpg');

/** 전체 화면 기도 모드에서 기도제목이 다음으로 넘어가는 간격(ms) */
const TOPIC_ROTATE_MS = 8000;

type PrayerTime = ReturnType<typeof usePrayerTime>;

/** '오늘의 기도'에서 돌려 가며 보여 주는 한 장(개인·공동·중보 공통 모양). */
type FocusTopic = { id: string; title: string; body: string; kind: TodayPrayerKind; category?: PrayerCategory; answered?: boolean };

/** 카테고리별 기도제목 묶음. */
type TopicsByKind = Record<TodayPrayerKind, FocusTopic[]>;
const EMPTY_BY_KIND: TopicsByKind = { personal: [], communal: [], intercession: [] };

const requestToTopic =
  (kind: TodayPrayerKind) =>
  (r: PrayerRequest): FocusTopic => ({
    id: r.id,
    title: r.title,
    body: r.body,
    kind,
    category: r.category,
    answered: r.answered,
  });
const communalToTopic = (c: CommunalPrayer): FocusTopic => ({ id: c.id, title: c.title, body: c.body, kind: 'communal' });

/** 개인·공동·중보 기도제목을 한꺼번에 불러옵니다. */
async function loadAllTopics(): Promise<TopicsByKind> {
  const [personal, communal, intercession] = await Promise.all([
    repository.listMyPrayerRequests(),
    repository.listCommunalPrayers(),
    repository.listSharedPrayerRequests(),
  ]);
  return {
    personal: personal.map(requestToTopic('personal')),
    communal: communal.map(communalToTopic),
    intercession: intercession.map(requestToTopic('intercession')),
  };
}

/**
 * '오늘의 기도' 글자를 읽기 쉽게 줄로 나눕니다.
 * - 문장이 끝나면(. ! ?) 줄을 바꾸고,
 * - 한 줄이 길고 쉼표가 있으면 가운데 쉼표에서 한 번 더 나눕니다.
 */
function formatTopicText(text: string): string {
  if (!text) return text;
  // 1) 문장이 끝나면(. ! ?) 줄바꿈
  const lines1 = text.replace(/([.!?])\s+/g, '$1\n').split('\n');
  // 2) 한 줄이 길고 쉼표가 있으면 첫 쉼표에서 나눔
  const lines2: string[] = [];
  for (const line of lines1) {
    if (line.length > 16 && line.includes(', ')) {
      const i = line.indexOf(', ');
      lines2.push(`${line.slice(0, i + 1)}`, line.slice(i + 2));
    } else {
      lines2.push(line);
    }
  }
  // 3) 그래도 긴 줄은 가운데에 가까운 띄어쓰기에서 한 번 더 나눠 두 줄로
  return lines2.map(balanceLine).join('\n');
}

/** 긴 한 줄을 가운데에 가장 가까운 띄어쓰기에서 두 줄로 나눕니다. */
function balanceLine(line: string): string {
  if (line.length <= 14) return line;
  const mid = line.length / 2;
  let best = -1;
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === ' ' && (best === -1 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  if (best === -1) return line;
  return `${line.slice(0, best)}\n${line.slice(best + 1)}`;
}

/** 선택(전체 카테고리 + 개별 ID)에 맞는 기도제목만 순서대로 모읍니다. */
function selectedTopics(byKind: TopicsByKind, sel: TodaySelection): FocusTopic[] {
  const out: FocusTopic[] = [];
  for (const kind of TODAY_PRAYER_ORDER) {
    const list = byKind[kind] ?? [];
    if (sel.allCategories.includes(kind)) out.push(...list);
    else out.push(...list.filter((t) => sel.selectedIds.includes(t.id)));
  }
  return out;
}

/** 기도하기 — 기도 타이머. 다이얼을 누르면 전체 화면 기도 모드로 들어갑니다. */
export default function MyPrayerScreen() {
  // 개인 + 공동 참여 시간을 하나로 합쳐 봅니다.
  const active = useAllPrayerTime();
  const { goal } = useWeeklyGoal('personal');
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useGlobalSearchParams<{ pray?: string | string[] }>();
  const prayAction = (Array.isArray(params.pray) ? params.pray[0] : params.pray) ?? '';
  const timerRef = useRef<TimerHandle>(null);
  const prayProcessingRef = useRef(false);

  // NFC·QR 스티커 링크(…?pray=start|amen|toggle)로 열리면, 어르신도 쉽게 쓰도록
  // 자동으로 기도를 시작(또는 진행 중이면 아멘)합니다. 화면은 기존의 큰 기도 모드가 뜹니다.
  useEffect(() => {
    const raw = params.pray;
    const action = (Array.isArray(raw) ? raw[0] : raw) ?? '';
    if (!action) {
      prayProcessingRef.current = false;
      return;
    }
    if (prayProcessingRef.current) return;
    prayProcessingRef.current = true;
    const id = setTimeout(() => {
      if (action === 'amen') timerRef.current?.amen();
      else if (action === 'toggle') timerRef.current?.toggle();
      else timerRef.current?.start();
      // 처리한 파라미터를 지워 새로고침·재방문 때 중복 실행되지 않게 합니다.
      try {
        router.setParams({ pray: undefined as unknown as string });
      } catch {
        // 무시
      }
    }, 350);
    return () => clearTimeout(id);
  }, [params.pray, router]);

  // 온 성도가 함께 드린 기도시간(초). 서버에서는 모든 성도의 개인·공동 기도를 집계합니다.
  const churchTotal = useAsyncData(() => repository.getChurchPrayerSeconds().catch(() => 0), []);

  // 이 탭을 보고 있는 동안 주기적으로(12초) 최신 합계를 가져옵니다.
  // 다른 성도가 기도를 마치면 그만큼 숫자가 올라가고, 바뀔 때마다 부드럽게 카운트업됩니다.
  // (값이 그대로면 애니메이션은 일어나지 않습니다. 탭을 떠나면 갱신을 멈춥니다.)
  useFocusEffect(
    useCallback(() => {
      churchTotal.reload();
      const id = setInterval(() => churchTotal.reload(), 12000);
      return () => clearInterval(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // 서버 집계(= 나를 뺀 다른 성도들)에 내 기도시간을 클라이언트에서 더해 보여 줍니다.
  // 내 저장분(active.totalMinutes)은 기도를 마치면 바로 늘어나므로, 서버 설치 여부와 상관없이
  // '기도 마침'이 즉시 반영됩니다. 기도 중 실시간 증가는 기도 모드 안에서 보여 줍니다(아래 TimerCard).
  const churchSeconds = (churchTotal.data ?? 0) + active.totalMinutes;

  return (
    <Screen scroll={false} contentStyle={styles.home}>
      {/* 상단 배너 — 등대의 빛(인도·소망) */}
      <HeroBanner imageSource={HOME_HERO} height={168}>
        <ThemedText style={styles.heroTitle}>주는 나의 빛, 나의 구원</ThemedText>
        <ThemedText style={styles.heroSubtitle}>오늘도 기도로 하루를 밝혀요 · 시편 27:1</ThemedText>
      </HeroBanner>

      {/* 큰 기도 타이머 — 공간이 넉넉하면 세로 중앙에, 작은 화면(플립·소형폰)에서는
          스크롤되어 아래 '온 성도가 함께' 블록이 탭에 가려 잘리지 않도록 합니다. */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.homeScrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.homeBody, { paddingBottom: insets.bottom + Spacing.two }]}>
          <TimerCard ref={timerRef} active={active} goal={goal} churchBaseSeconds={churchSeconds} onComplete={churchTotal.reload} prayAction={prayAction} />
          <ChurchTotalBlock seconds={churchSeconds} ready={churchTotal.data != null} />
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * 온 성도가 함께 드린 기도 — 타이머 버튼 아래의 조용한 보조 블록.
 * 한 개의 의미 있는 숫자를 크게, 화면에 들어올 때(또는 값이 바뀔 때) 부드럽게 카운트업합니다.
 */
function ChurchTotalBlock({ seconds, ready }: { seconds: number; ready: boolean }) {
  const theme = useTheme();
  const animated = useCountUp(ready ? seconds : 0);

  return (
    <View style={styles.churchTotal} accessibilityRole="summary">
      <View style={styles.churchLabelRow}>
        <Ionicons name="people" size={17} color={theme.textMuted} />
        <ThemedText themeColor="textMuted" fixed style={styles.churchLabelText}>
          온 성도가 함께
        </ThemedText>
      </View>
      <ThemedText fixed numberOfLines={1} style={[styles.churchValue, { color: theme.primary }]}>
        {ready ? formatChurchTotalPrecise(animated) : '—'}
      </ThemedText>
      <ThemedText themeColor="textMuted" fixed style={styles.churchLabelText}>
        기도하고 있습니다
      </ThemedText>
    </View>
  );
}

/** 누적 초를 '1,284시간 27분'처럼 — 시간 단위에 천 단위 콤마. (홈 화면용, 깔끔하게) */
function formatChurchTotal(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const totalMin = Math.floor(s / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return m ? `${h.toLocaleString('ko-KR')}시간 ${m}분` : `${h.toLocaleString('ko-KR')}시간`;
  if (totalMin > 0) return `${totalMin}분`;
  return `${s}초`;
}

/** 초까지 넣은 정밀 표기 — 기도 모드 안에서 '실시간으로 올라가는' 모습이 보이도록 매초 바뀝니다. */
function formatChurchTotalPrecise(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = String(sec).padStart(2, '0');
  if (h > 0) return `${h.toLocaleString('ko-KR')}시간 ${m}분 ${ss}초`;
  if (m > 0) return `${m}분 ${ss}초`;
  return `${sec}초`;
}

/** 목표값까지 부드럽게(easeOut) 카운트업. 이전 값에서 새 값으로 트윈하므로 값이 같으면 가만히 있습니다. */
function useCountUp(target: number, duration = 900): number {
  const [val, setVal] = useState(target);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) {
      setVal(target);
      return;
    }
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setVal(from + (target - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setVal(target);
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return val;
}

// ── 큰 기도 타이머 (맨 위) ───────────────────────────────────────
/** NFC·QR 링크로 외부에서 기도를 시작/마칠 수 있도록 노출하는 조작 핸들 */
export type TimerHandle = { start: () => void; amen: () => void; toggle: () => void; isRunning: () => boolean };

const TimerCard = forwardRef<
  TimerHandle,
  {
    active: PrayerTime;
    goal: number;
    churchBaseSeconds?: number;
    onComplete?: () => void;
    /** NFC·QR 링크로 열렸을 때의 동작(start|amen|toggle). 복구 처리에서 '아멘' 의도를 구분합니다. */
    prayAction?: string;
  }
>(function TimerCard({ active, goal, churchBaseSeconds, onComplete, prayAction }, cardRef) {
  const { user } = useAuth();
  const bgm = usePrayerBgm();
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const baseRef = useRef(0); // 일시정지까지 누적된 시간(ms)
  const segStartRef = useRef<number | null>(null); // 현재 진행 세그먼트 시작 시각
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [resultSeconds, setResultSeconds] = useState<number | null>(null);

  // 앱 자체 확인창. 웹의 window.confirm 은 브라우저가 사이트 주소를 붙여서, 대신 이 모달을 씁니다.
  const [dialog, setDialog] = useState<null | {
    title: string;
    message?: string;
    cancelLabel: string;
    confirmLabel: string;
    confirmDanger?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
  }>(null);

  // 일일 기도 목표(분) — 기도 중 오늘 누적이 이 시간을 넘기면 "기록하고 마칠까요?" 안내를 띄웁니다.
  const { goal: dailyGoal } = useDailyGoal();

  // 아멘을 깜빡해도 시간이 남도록: 진행 중 세션 저장/자동 저장/복구에 쓰는 보조 ref 들.
  const startedAtRef = useRef(0); // 이번 기도를 시작한 시각
  const lastPersistRef = useRef(0); // 마지막으로 기기에 저장한 시각(과도한 저장 방지)
  const goalAlertedRef = useRef(false); // 이번 세션에 목표 달성 안내를 이미 띄웠는지
  const goalBaseRef = useRef(0); // 이번 기도 시작 시점의 '오늘 누적 기도(초)' — 목표선 교차 판정 기준
  const runningRef = useRef(false); // 리스너(화면 이탈·백그라운드)에서 현재 진행 여부를 읽기 위한 ref
  const stopRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // 사용자가 고른 '오늘의 기도' 선택(전체 카테고리 + 개별 제목). 기기에 저장되어 유지됩니다.
  const { selection, setSelection } = useTodaySelection();

  const currentMs = () => baseRef.current + (segStartRef.current !== null ? Date.now() - segStartRef.current : 0);

  // 진행 중인 기도를 기기에 임시 저장 (복구용). elapsedSec 은 '지금까지의 누적'이라 꺼져 있던 시간은 안 들어갑니다.
  const persist = useCallback(() => {
    if (!runningRef.current) return;
    void saveActiveSession(Math.round(currentMs() / 1000), startedAtRef.current);
    lastPersistRef.current = Date.now();
  }, []);

  // 오늘 기도 목표를 채우면 뜨는 안내. "기록하고 마치기"를 누르면 바로 저장하고 끝냅니다.
  // (아멘을 깜빡하고 타이머를 오래 켜 두는 것을 막아 줍니다.)
  const confirmGoalReached = (goalMin: number) => {
    // 화면에서 직접 안내했으니, 예약해 둔 백그라운드 넛지는 중복으로 오지 않게 취소합니다.
    void cancelPrayerNudge();
    setDialog({
      title: '오늘 기도 목표 달성 🙏',
      message: `오늘 기도 목표 ${goalMin}분을 채웠어요.\n지금까지 기도를 기록하고 마칠까요?`,
      cancelLabel: '계속 기도',
      confirmLabel: '기록하고 마치기',
      onCancel: () => setDialog(null),
      onConfirm: () => {
        setDialog(null);
        void stopRef.current?.();
      },
    });
  };

  // 개인·공동·중보 기도제목을 모두 불러와, 고른 선택에 맞게 보여 줍니다. (로그인 필요한 경우 비움)
  const topics = useAsyncData<TopicsByKind>(
    () => (dataMode === 'supabase' && !user ? Promise.resolve(EMPTY_BY_KIND) : loadAllTopics()),
    [user],
  );

  const begin = () => {
    topics.reload();
    baseRef.current = 0;
    segStartRef.current = Date.now();
    startedAtRef.current = Date.now();
    goalAlertedRef.current = false;
    goalBaseRef.current = active.todayMinutes; // 시작 시점의 오늘 누적(초)을 기준으로 삼습니다.
    lastPersistRef.current = Date.now();
    runningRef.current = true;
    setElapsed(0);
    setPaused(false);
    setRunning(true);
    if (bgm.enabled) bgm.start();
    persist();
    // 백그라운드 넛지 예약: 아멘을 깜빡하고 앱을 닫아 둬도, 목표 시간쯤 휴대폰으로
    // "열어 둔 기도를 마무리하세요" 푸시가 오도록 서버에 예약합니다.
    // (알림을 켜 둔 기기에만 옵니다. 아멘·목표 달성 안내 시 취소됩니다.)
    // 시작 시점부터 '목표 시간'만큼 뒤에 알립니다(오늘 이미 목표를 넘겼어도 바로 울리지 않도록).
    const nudgeDelaySec = Math.max(60, dailyGoal * 60);
    void schedulePrayerNudge(
      nudgeDelaySec,
      `열어 둔 기도가 있어요. 앱을 열어 ‘아멘’으로 오늘 기도를 기록해 주세요. 🙏`,
    );
  };

  const pause = () => {
    if (segStartRef.current !== null) {
      baseRef.current += Date.now() - segStartRef.current;
      segStartRef.current = null;
    }
    setElapsed(baseRef.current);
    setPaused(true);
    bgm.stop();
    persist();
  };
  const resume = () => {
    segStartRef.current = Date.now();
    setPaused(false);
    if (bgm.enabled) bgm.start();
  };

  const toggleBgm = () => {
    const next = !bgm.enabled;
    bgm.setEnabled(next);
    if (next) bgm.start();
    else bgm.stop();
  };

  useEffect(() => {
    if (!running || paused) return;
    const dailyGoalSec = dailyGoal * 60;
    intervalRef.current = setInterval(() => {
      const ms = currentMs();
      setElapsed(ms);
      // 5초마다 진행 상황을 기기에 저장해 둡니다(아멘을 깜빡하거나 앱이 꺼져도 복구할 수 있도록).
      if (Date.now() - lastPersistRef.current > 5000) persist();
      // 이번 세션 '중에' 오늘 누적이 일일 목표를 넘어서는 순간에만 한 번 안내합니다.
      // (시작 시점에 이미 목표를 넘겨 둔 경우에는 울리지 않습니다 — 시작하자마자 뜨는 문제 방지.)
      if (!goalAlertedRef.current && dailyGoalSec > 0 && goalBaseRef.current < dailyGoalSec) {
        const todayTotalSec = goalBaseRef.current + Math.floor(ms / 1000);
        if (todayTotalSec >= dailyGoalSec) {
          goalAlertedRef.current = true;
          confirmGoalReached(dailyGoal);
        }
      }
    }, 500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, paused, dailyGoal]);

  const stopBgm = bgm.stop;
  useFocusEffect(
    useCallback(() => {
      return () => {
        // 화면을 벗어날 때(다른 탭으로 이동 등) 기도 중이면 자동으로 저장합니다.
        // → 아멘을 깜빡해도 지금까지의 기도 시간이 사라지지 않습니다.
        if (runningRef.current) void stopRef.current?.();
        stopBgm();
      };
    }, [stopBgm]),
  );

  const stop = async () => {
    if (!runningRef.current) return; // 자동 저장·아멘이 겹쳐도 한 번만 기록되도록
    const secs = Math.round(currentMs() / 1000);
    runningRef.current = false;
    setRunning(false);
    setPaused(false);
    baseRef.current = 0;
    segStartRef.current = null;
    setElapsed(0);
    bgm.stop();
    void clearActiveSession(); // 정상적으로 마쳤으니 임시 저장분을 지웁니다.
    void cancelPrayerNudge(); // 마쳤으니 예약해 둔 백그라운드 넛지도 취소합니다.
    if (secs > 0) {
      await active.addMinutes(secs);
      setResultSeconds(secs);
      onComplete?.(); // 온 성도 누적 기도시간도 최신값으로 갱신
    }
  };
  // 리스너·타이머에서 항상 최신 stop 을 쓰도록 ref 에 담아 둡니다(렌더 중 직접 대입 대신 effect 사용).
  useEffect(() => {
    stopRef.current = stop;
  });

  // NFC·QR 링크로 외부에서 기도를 시작/마칠 수 있게 조작 핸들을 노출합니다.
  useImperativeHandle(cardRef, () => ({
    start: () => {
      if (!runningRef.current) begin();
    },
    amen: () => {
      if (runningRef.current) void stop();
    },
    toggle: () => {
      if (runningRef.current) void stop();
      else begin();
    },
    isRunning: () => runningRef.current,
  }));

  // 앱이 백그라운드로 갈 때(화면 잠금·앱 전환) 진행 상황을 저장해 둡니다.
  // 앱이 강제 종료돼도, 저장해 둔 지점까지는 다음에 복구할 수 있습니다.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && runningRef.current) persist();
    });
    return () => sub.remove();
  }, [persist]);

  // 앱을 다시 켰을 때, 저장되지 않은 지난 기도가 남아 있으면 "이어서 기록할까요?"를 안내합니다.
  const recoveredRef = useRef(false);
  useEffect(() => {
    if (recoveredRef.current) return;
    if (active.loading) return; // 기록 데이터가 준비된 뒤에 복구를 처리합니다(기록 누락 방지).
    recoveredRef.current = true;
    void (async () => {
      const s = await loadActiveSession();
      if (!s || s.elapsedSec <= 0) {
        if (s) await clearActiveSession();
        return;
      }
      const doSave = async () => {
        await active.addMinutes(s.elapsedSec);
        onComplete?.();
      };
      // '아멘/기도 마침' NFC·QR 태그(또는 toggle)로 다시 연 경우: 마치려는 의도가 분명하므로
      // 짧은 기도라도 묻지 않고 바로 기록하고, 마침 화면을 보여 줍니다.
      // (어르신이 "대고 → 다시 대고" 두 번으로 끝낼 수 있게. 30초 미만이어도 기록합니다.)
      if (prayAction === 'amen' || prayAction === 'toggle') {
        await doSave();
        await clearActiveSession();
        active.reload(); // 결과 화면의 누적 수치가 방금 기록을 반영하도록 새로고침
        setResultSeconds(s.elapsedSec);
        return;
      }
      // 파라미터 없이 다시 연 경우(아멘을 깜빡함): 너무 짧으면 실수 탭으로 보고 조용히 버립니다.
      if (s.elapsedSec < 30) {
        await clearActiveSession();
        return;
      }
      const m = Math.floor(s.elapsedSec / 60);
      const sec = s.elapsedSec % 60;
      const label = m > 0 ? `${m}분 ${sec}초` : `${sec}초`;
      setDialog({
        title: '이어서 기록할까요?',
        message: `저장되지 않은 지난 기도 ${label}이 있어요.\n이 시간을 기도 기록에 더할까요?`,
        cancelLabel: '버리기',
        confirmLabel: '기록하기',
        onCancel: () => {
          setDialog(null);
          void clearActiveSession();
        },
        onConfirm: () => {
          setDialog(null);
          void (async () => {
            await doSave();
            await clearActiveSession();
          })();
        },
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.loading]);

  const seconds = Math.floor(elapsed / 1000);
  const display = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return (
    <Card elevated style={styles.timerCard}>
      {!running ? (
        <>
          <ThemedText type="caption" themeColor="textMuted" style={styles.center}>
            오늘 기도{' '}
            <ThemedText type="smallBold" themeColor="primary">
              {active.todayMinutes > 0 ? durationLabel(active.todayMinutes) : '0분'}
            </ThemedText>
          </ThemedText>
          <Pressable
            onPress={begin}
            accessibilityRole="button"
            accessibilityLabel="기도 시작"
            style={({ pressed }) => [styles.startImageBtn, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
            <Image source={START_IMAGE} style={styles.startImage} contentFit="cover" transition={200} />
          </Pressable>
          <ThemedText type="smallBold" themeColor="primary" style={styles.center}>
            눌러서 기도 시작
          </ThemedText>
        </>
      ) : (
        <ThemedText type="caption" themeColor="textMuted" style={styles.center}>
          기도 중…
        </ThemedText>
      )}

      <PrayerFocusModal
        visible={running}
        display={display}
        elapsedSeconds={seconds}
        paused={paused}
        onPauseToggle={paused ? resume : pause}
        todaySeconds={active.todayMinutes}
        churchBaseSeconds={churchBaseSeconds}
        byKind={topics.data ?? EMPTY_BY_KIND}
        selection={selection}
        onChangeSelection={setSelection}
        onStop={() => void stop()}
        bgmAvailable={bgm.available}
        bgmEnabled={bgm.enabled}
        onToggleBgm={toggleBgm}
      />

      <PrayerResultModal seconds={resultSeconds} onClose={() => setResultSeconds(null)} active={active} goal={goal} />

      <ConfirmModal
        visible={!!dialog}
        title={dialog?.title ?? ''}
        message={dialog?.message}
        cancelLabel={dialog?.cancelLabel}
        confirmLabel={dialog?.confirmLabel}
        confirmDanger={dialog?.confirmDanger}
        onCancel={() => (dialog ? dialog.onCancel() : setDialog(null))}
        onConfirm={() => (dialog ? dialog.onConfirm() : setDialog(null))}
      />
    </Card>
  );
});

/** 전체 화면 기도 모드 — 큰 타이머 + 나의 기도제목을 보며 집중해서 기도합니다. */
function PrayerFocusModal({
  visible,
  display,
  elapsedSeconds,
  paused,
  onPauseToggle,
  todaySeconds,
  churchBaseSeconds,
  byKind,
  selection,
  onChangeSelection,
  onStop,
  bgmAvailable,
  bgmEnabled,
  onToggleBgm,
}: {
  visible: boolean;
  display: string;
  elapsedSeconds: number;
  paused: boolean;
  onPauseToggle: () => void;
  todaySeconds: number;
  churchBaseSeconds?: number;
  byKind: TopicsByKind;
  selection: TodaySelection;
  onChangeSelection: (sel: TodaySelection) => void;
  onStop: () => void;
  bgmAvailable: boolean;
  bgmEnabled: boolean;
  onToggleBgm: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  // 기기 화면 크기에 맞춰 다이얼 크기를 조절합니다. 화면이 낮은 기기(갤럭시 플립 커버 등)·가로 모드에서도
  // 아래 버튼(일시정지·아멘)이 잘리지 않도록, 남는 높이에 비례해 다이얼을 줄입니다. (일반 폰에서는 기존 크기)
  const dialSize = Math.round(Math.max(150, Math.min(268, winW - 56, winH * 0.32)));
  const [pickerOpen, setPickerOpen] = useState(false);

  // 고른 선택에 맞는 기도제목만 모읍니다. (기도 중인 제목 먼저, 응답된 제목은 뒤)
  const chosen = selectedTopics(byKind, selection);
  const ordered = [...chosen.filter((t) => !t.answered), ...chosen.filter((t) => t.answered)];

  // 기도제목을 한 장씩 보여 줍니다. 좌우로 밀어 직접 넘길 수 있고(아래 ScrollView),
  // 넘기기 전까지는 일정 시간마다 자동으로 다음 제목으로 넘어갑니다.
  const [topicIdx, setTopicIdx] = useState(0);
  const count = ordered.length;
  const selectionKey = `${selection.allCategories.join(',')}|${selection.selectedIds.join(',')}`;
  const topicScrollRef = useRef<ScrollView>(null);
  const [cardW, setCardW] = useState(0);
  const posRef = useRef(0); // 현재 보이는 장(스크롤 위치 기준). 자동 넘김이 다음 장을 계산할 때 씁니다.
  const lastManualAt = useRef(0); // 마지막으로 직접 넘긴 시각. 자동 넘김 중에도 직접 넘기면 잠시(8초) 자동을 멈춰 읽을 틈을 줍니다.
  const { auto: autoAdvance, setAuto: setAutoAdvance } = useAutoAdvance(); // 자동 넘김 켜기/끄기(이 기기에 저장)

  // 기도 모드가 열릴 때, 또 선택을 바꿀 때 처음 제목부터 시작합니다.
  useEffect(() => {
    if (visible) {
      lastManualAt.current = 0;
      posRef.current = 0;
      setTopicIdx(0);
      topicScrollRef.current?.scrollTo({ x: 0, animated: false });
    }
  }, [visible, selectionKey]);

  // 일정 시간(TOPIC_ROTATE_MS)마다 다음 장으로 '스크롤'합니다. (스크롤이 현재 장을 결정 — dots/카운터도 따라옵니다.)
  // 일시정지 중이거나 사용자가 직접 넘긴 뒤에는 멈춥니다.
  useEffect(() => {
    if (!visible || paused || !autoAdvance || count <= 1 || cardW <= 0) return;
    const t = setInterval(() => {
      // 방금 직접 넘겼다면 이번 차례는 건너뛰어, 고른 제목을 충분히 읽을 수 있게 합니다.
      if (Date.now() - lastManualAt.current < TOPIC_ROTATE_MS) return;
      const next = (posRef.current + 1) % count;
      topicScrollRef.current?.scrollTo({ x: next * cardW, animated: true });
    }, TOPIC_ROTATE_MS);
    return () => clearInterval(t);
  }, [visible, paused, autoAdvance, count, cardW]);

  // 스크롤 위치로 현재 장을 계산해 dots·카운터(n/m)를 실시간으로 맞춥니다. (웹·앱 모두 onScroll 은 안정적으로 동작)
  const onTopicScroll = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    if (cardW <= 0) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / cardW);
    if (idx >= 0 && idx < count && idx !== posRef.current) {
      posRef.current = idx;
      setTopicIdx(idx);
    }
  };

  const pos = count ? Math.min(topicIdx, count - 1) : 0;

  // 화살표(‹ ›)로 직접 넘깁니다. 한 번 누르면 자동 넘김은 멈춥니다. (좌우 밀기와 동일)
  const goTo = (dir: -1 | 1) => {
    if (count <= 1 || cardW <= 0) return;
    lastManualAt.current = Date.now();
    const next = (posRef.current + dir + count) % count;
    posRef.current = next;
    setTopicIdx(next);
    topicScrollRef.current?.scrollTo({ x: next * cardW, animated: true });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onStop}>
      <View
        style={[
          styles.focusRoot,
          {
            backgroundColor: theme.background,
            paddingTop: insets.top + Spacing.three,
            paddingBottom: insets.bottom + Spacing.three,
          },
        ]}>
        <PrayerDial seconds={elapsedSeconds} display={display} paused={paused} size={dialSize} />
        {churchBaseSeconds != null ? (
          <View style={styles.focusChurch}>
            <Ionicons name="people" size={13} color={theme.textMuted} />
            <ThemedText type="caption" themeColor="textMuted" fixed>
              온 성도가 함께{'  '}
              <ThemedText type="smallBold" themeColor="primary" fixed style={styles.tabular}>
                {formatChurchTotalPrecise(churchBaseSeconds + elapsedSeconds)}
              </ThemedText>
              {'  '}기도중입니다.
            </ThemedText>
          </View>
        ) : null}
        <View style={styles.dialMetaRow}>
          <ThemedText type="caption" themeColor="textMuted" fixed>
            오늘 누적 {durationLabel(todaySeconds)}
          </ThemedText>
          {bgmAvailable ? (
            <Pressable
              onPress={onToggleBgm}
              hitSlop={8}
              accessibilityRole="switch"
              accessibilityState={{ checked: bgmEnabled }}
              accessibilityLabel="배경음악"
              style={styles.bgmRow}>
              <Ionicons
                name={bgmEnabled ? 'musical-notes' : 'musical-notes-outline'}
                size={16}
                color={bgmEnabled ? theme.primary : theme.textMuted}
              />
              <ThemedText type="caption" themeColor={bgmEnabled ? 'primary' : 'textMuted'} fixed>
                배경음악
              </ThemedText>
              <View style={[styles.bgmTrack, { backgroundColor: bgmEnabled ? theme.primary : theme.border }]}>
                <View style={[styles.bgmThumb, { alignSelf: bgmEnabled ? 'flex-end' : 'flex-start' }]} />
              </View>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.focusTopicsHead}>
          <Ionicons name="flower-outline" size={16} color={theme.primary} />
          <ThemedText type="smallBold" themeColor="primary" fixed>
            오늘의 기도
          </ThemedText>
          {count > 0 ? (
            <ThemedText type="caption" themeColor="textMuted" fixed>
              {count > 1 ? `${pos + 1} / ${count}` : `${count}`}
            </ThemedText>
          ) : null}
          <View style={styles.flex} />
          {/* 자동 넘김(8초마다) ↔ 수동 넘김(화살표·밀기) 선택. 이 기기에 저장됩니다. */}
          {count > 1 ? (
            <Pressable
              onPress={() => setAutoAdvance(!autoAdvance)}
              hitSlop={8}
              accessibilityRole="switch"
              accessibilityState={{ checked: autoAdvance }}
              accessibilityLabel={autoAdvance ? '자동 넘김 켜짐, 끄려면 누르세요' : '자동 넘김 꺼짐, 켜려면 누르세요'}
              style={({ pressed }) => [
                styles.pickBtn,
                {
                  borderColor: autoAdvance ? theme.primary + '55' : theme.border,
                  backgroundColor: autoAdvance ? theme.primary + '14' : 'transparent',
                  opacity: pressed ? 0.7 : 1,
                },
              ]}>
              <Ionicons name={autoAdvance ? 'sync' : 'hand-left-outline'} size={14} color={autoAdvance ? theme.primary : theme.textMuted} />
              <ThemedText type="caption" themeColor={autoAdvance ? 'primary' : 'textMuted'} fixed numberOfLines={1}>
                {autoAdvance ? '자동' : '수동'}
              </ThemedText>
            </Pressable>
          ) : null}
          {/* 개인·공동·중보 카테고리 전체, 또는 원하는 기도제목만 골라요. (선택은 저장돼 유지) */}
          <Pressable
            onPress={() => setPickerOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="기도제목 선택"
            style={({ pressed }) => [styles.pickBtn, { borderColor: theme.primary + '55', opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="options-outline" size={15} color={theme.primary} />
            <ThemedText type="caption" themeColor="primary" fixed numberOfLines={1}>
              선택
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.focusTopicArea}>
          {count > 0 ? (
            <>
              {/* 좌우로 밀어 기도제목을 넘겨 봅니다(한 장씩 딱 맞게 멈춤). */}
              <View style={styles.topicScrollWrap} onLayout={(e) => setCardW(Math.round(e.nativeEvent.layout.width))}>
                {cardW > 0 ? (
                  <ScrollView
                    ref={topicScrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.topicScrollContent}
                    scrollEventThrottle={16}
                    onScroll={onTopicScroll}
                    onScrollBeginDrag={() => {
                      lastManualAt.current = Date.now();
                    }}>
                    {ordered.map((t) => (
                      <View key={t.id} style={[styles.topicPage, { width: cardW }]}>
                        <View style={[styles.focusTopicCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                          <View style={styles.focusTopicMeta}>
                            <View style={[styles.kindBadge, { backgroundColor: theme.primary + '18', borderColor: theme.primary + '40' }]}>
                              <ThemedText type="caption" fixed style={{ color: theme.primary, fontWeight: '700' }}>
                                {TODAY_PRAYER_LABEL[t.kind].long}
                              </ThemedText>
                            </View>
                            {t.category ? <CategoryChip category={t.category} /> : null}
                            {t.answered ? <Ionicons name="checkmark-circle" size={16} color={theme.success} /> : null}
                          </View>
                          <ThemedText type="subtitle" style={[styles.center, t.answered && styles.focusAnswered]}>
                            {formatTopicText(t.title)}
                          </ThemedText>
                          {t.body ? (
                            <ThemedText type="small" themeColor="textSecondary" style={[styles.center, t.answered && styles.focusAnswered]}>
                              {formatTopicText(t.body)}
                            </ThemedText>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                ) : null}
              </View>

              {count > 1 ? (
                <View style={styles.navRow}>
                  <Pressable
                    onPress={() => goTo(-1)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="이전 기도제목"
                    style={({ pressed }) => [styles.navBtn, { borderColor: theme.primary + '55', opacity: pressed ? 0.6 : 1 }]}>
                    <Ionicons name="chevron-back" size={20} color={theme.primary} />
                  </Pressable>
                  <View style={styles.dotsRow}>
                    {ordered.map((t, i) => (
                      <View key={t.id} style={[styles.dot, { backgroundColor: i === pos ? theme.primary : theme.border }]} />
                    ))}
                  </View>
                  <Pressable
                    onPress={() => goTo(1)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="다음 기도제목"
                    style={({ pressed }) => [styles.navBtn, { borderColor: theme.primary + '55', opacity: pressed ? 0.6 : 1 }]}>
                    <Ionicons name="chevron-forward" size={20} color={theme.primary} />
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : (
            <View style={[styles.focusEmpty, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textMuted" style={styles.center}>
                표시할 기도제목이 없어요.{'\n'}‘선택’에서 기도제목을 골라 보세요.
              </ThemedText>
            </View>
          )}
        </View>

        <View style={styles.focusButtonRow}>
          <Pressable
            onPress={onPauseToggle}
            style={({ pressed }) => [styles.pauseBtn, { borderColor: theme.primary, backgroundColor: paused ? theme.primary : 'transparent', opacity: pressed ? 0.85 : 1 }]}>
            <Ionicons name={paused ? 'play' : 'pause'} size={22} color={paused ? theme.onPrimary : theme.primary} />
            <ThemedText type="subtitle" fixed numberOfLines={1} style={{ color: paused ? theme.onPrimary : theme.primary }}>
              {paused ? '이어서' : '일시정지'}
            </ThemedText>
          </Pressable>
          <Pressable onPress={onStop} style={({ pressed }) => [styles.stopBtn, { backgroundColor: theme.accent, opacity: pressed ? 0.9 : 1 }]}>
            <Ionicons name="checkmark" size={24} color="#fff" />
            <ThemedText type="subtitle" fixed numberOfLines={1} style={{ color: '#fff' }}>
              아멘
            </ThemedText>
          </Pressable>
        </View>

        <TodayPrayerPicker
          visible={pickerOpen}
          byKind={byKind}
          selection={selection}
          onChange={onChangeSelection}
          onClose={() => setPickerOpen(false)}
        />
      </View>
    </Modal>
  );
}

/** '오늘의 기도' 고르기 — 카테고리 전체, 또는 원하는 기도제목만 선택합니다. */
function TodayPrayerPicker({
  visible,
  byKind,
  selection,
  onChange,
  onClose,
}: {
  visible: boolean;
  byKind: TopicsByKind;
  selection: TodaySelection;
  onChange: (sel: TodaySelection) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const total = selectedTopics(byKind, selection).length;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.pickerBackdrop}>
        <View
          style={[
            styles.pickerSheet,
            { backgroundColor: theme.background, borderColor: theme.border, paddingBottom: insets.bottom + Spacing.three },
          ]}>
          <View style={styles.pickerHead}>
            <ThemedText type="heading">오늘의 기도 선택</ThemedText>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="닫기">
              <Ionicons name="close" size={24} color={theme.textMuted} />
            </Pressable>
          </View>
          <ThemedText type="caption" themeColor="textMuted" style={styles.pickerHint}>
            카테고리 ‘전체’를 켜거나, 원하는 기도제목만 골라 보세요. 기도하기에서 이 제목들이 번갈아 나옵니다.
          </ThemedText>

          <ScrollView style={styles.pickerScroll} contentContainerStyle={styles.pickerScrollBody}>
            {TODAY_PRAYER_ORDER.map((kind) => {
              const list = byKind[kind] ?? [];
              const all = isCategoryAll(selection, kind);
              // 공동 기도제목은 '전체'만 — 개별 선택 없이 모두 함께 표시합니다.
              const allowIndividual = kind !== 'communal';
              return (
                <View key={kind} style={styles.pickerGroup}>
                  {/* 카테고리 헤더 + 켜고 끄기 ('전체' 토글) */}
                  <Pressable
                    onPress={() => onChange(toggleCategoryAll(selection, kind))}
                    style={[styles.pickerGroupHead, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
                    <View style={styles.flexRow}>
                      <Ionicons
                        name={all ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={all ? theme.primary : theme.textMuted}
                      />
                      <ThemedText type="smallBold" numberOfLines={1} style={styles.flexShrink}>
                        {TODAY_PRAYER_LABEL[kind].long}
                      </ThemedText>
                      {allowIndividual ? (
                        <View style={[styles.pickerAllTag, { backgroundColor: all ? theme.primary : theme.border }]}>
                          <ThemedText type="caption" fixed style={{ color: all ? theme.onPrimary : theme.textMuted, fontWeight: '700' }}>
                            전체
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                    <ThemedText type="caption" themeColor="textMuted" fixed>
                      {list.length}개
                    </ThemedText>
                  </Pressable>

                  {/* 개인·중보: '전체'가 아니면 원하는 제목만 고릅니다. (공동은 개별 선택 없음) */}
                  {allowIndividual && !all
                    ? list.length === 0
                      ? (
                        <ThemedText type="caption" themeColor="textMuted" style={styles.pickerEmpty}>
                          기도제목이 없어요.
                        </ThemedText>
                      )
                      : list.map((t) => {
                          const on = selection.selectedIds.includes(t.id);
                          return (
                            <Pressable key={t.id} onPress={() => onChange(toggleId(selection, t.id))} style={styles.pickerItem}>
                              <Ionicons
                                name={on ? 'checkbox' : 'square-outline'}
                                size={20}
                                color={on ? theme.primary : theme.textMuted}
                              />
                              <ThemedText type="small" numberOfLines={2} style={styles.flex}>
                                {t.title}
                              </ThemedText>
                            </Pressable>
                          );
                        })
                    : null}
                </View>
              );
            })}
          </ScrollView>

          <Button label={total > 0 ? `완료 (${total}개)` : '완료'} icon="checkmark-circle-outline" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

/** 기도를 마치면 바로 뜨는 결과 — 이번 기도·오늘·주간·월간·목표 달성률 */
function PrayerResultModal({
  seconds,
  onClose,
  active,
  goal,
}: {
  seconds: number | null;
  onClose: () => void;
  active: PrayerTime;
  goal: number;
}) {
  const theme = useTheme();
  const { user } = useAuth();
  if (seconds === null) return null;

  const who = user?.name ? `${user.name}님의` : '성도의';
  const week = weekSeconds(active.entries);
  const month = monthSeconds(active.entries);
  const total = allTimeSeconds(active.entries);
  const pct = goal > 0 ? Math.min(100, Math.round((week / (goal * 60)) * 100)) : 0;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.resultBackdrop} onPress={onClose}>
        <Pressable style={[styles.resultSheet, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => {}}>
          <View style={[styles.resultCheck, { backgroundColor: theme.success }]}>
            <Ionicons name="checkmark" size={34} color="#fff" />
          </View>
          <ThemedText type="subtitle" style={styles.center}>
            {who} 기도는
          </ThemedText>
          <ThemedText type="subtitle" style={styles.center}>
            결코 헛되지 않습니다
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" style={[styles.center, styles.mt4]}>
            하나님께서 {who} 기도를 기억하십니다.
          </ThemedText>

          <View style={[styles.resultGoalBox, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="caption" themeColor="textMuted">
              이번 주 목표
            </ThemedText>
            <View style={styles.rowBetween}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                {goalLabel(goal)} 대비
              </ThemedText>
              <ThemedText type="subtitle" themeColor="primary">
                {pct}%
              </ThemedText>
            </View>
            <View style={[styles.resultTrack, { backgroundColor: theme.border }]}>
              <View style={[styles.resultFill, { width: `${pct}%`, backgroundColor: theme.accent }]} />
            </View>
          </View>

          <View style={styles.resultStats}>
            <ResultStat label="오늘" value={stackedDuration(active.todayMinutes)} theme={theme} />
            <ResultStat label="이번 주" value={stackedDuration(week)} theme={theme} />
            <ResultStat label="이번 달" value={stackedDuration(month)} theme={theme} />
            <ResultStat label="전체" value={stackedDuration(total)} theme={theme} />
          </View>

          <Button label="확인" icon="checkmark-circle-outline" onPress={onClose} />
          <ThemedText type="caption" themeColor="textMuted" style={[styles.center, styles.mt4]}>
            기도 기록에 저장되었습니다.
          </ThemedText>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ResultStat({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={[styles.resultStat, { borderColor: theme.border }]}>
      <ThemedText type="caption" themeColor="textMuted">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" themeColor="primary" style={[styles.mt4, styles.center]}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  center: { alignItems: 'center', textAlign: 'center' },
  mt4: { marginTop: 4 },

  // 기도하기 홈 — 상단 배너 + 남은 공간에 다이얼 중앙, 안내 문구는 왼쪽 맞춤
  home: { gap: Spacing.three },
  homeScrollContent: { flexGrow: 1 },
  homeBody: { flexGrow: 1, justifyContent: 'center', gap: Spacing.three },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    marginTop: 3,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  homeNote: { textAlign: 'center', marginTop: Spacing.two },

  // 온 성도가 함께 드린 기도 — 타이머 아래 보조 블록
  churchTotal: { alignItems: 'center', gap: 3 },
  churchLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  churchLabelText: { fontSize: 16, fontWeight: '600' },
  churchValue: { fontSize: 32, lineHeight: 42, fontWeight: '800', letterSpacing: -0.3, fontVariant: ['tabular-nums'], paddingVertical: 2 },
  // 기도 모드 안 — 실시간으로 올라가는 온 성도 누적
  focusChurch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.one, marginTop: Spacing.one },
  tabular: { fontVariant: ['tabular-nums'] },

  // 큰 기도 타이머
  timerCard: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.four },
  startImageBtn: { width: 264, height: 264, borderRadius: 132, alignSelf: 'center', overflow: 'hidden' },
  startImage: { width: '100%', height: '100%' },

  // 전체 화면 기도 모드
  focusRoot: { flex: 1, paddingHorizontal: Spacing.four, gap: Spacing.two },
  dialMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', rowGap: Spacing.one },
  bgmRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  bgmTrack: { width: 46, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  bgmThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  focusTopicsHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.one, rowGap: Spacing.one, marginTop: Spacing.two },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  kindBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  focusTopicArea: { flex: 1, justifyContent: 'center', gap: Spacing.three, overflow: 'hidden' },
  topicScrollWrap: { alignSelf: 'stretch' },
  topicScrollContent: { alignItems: 'center' },
  topicPage: { justifyContent: 'center', paddingHorizontal: Spacing.one },
  focusTopicCard: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.two,
    alignItems: 'center',
  },
  focusTopicMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: Spacing.two },

  // '오늘의 기도 고르기' 시트
  flexRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flex: 1 },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerSheet: {
    maxHeight: '86%',
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.two,
  },
  pickerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerHint: { marginBottom: Spacing.one },
  pickerScroll: { flexGrow: 0 },
  pickerScrollBody: { gap: Spacing.three, paddingBottom: Spacing.two },
  pickerGroup: { gap: Spacing.one },
  pickerGroupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pickerAllTag: { paddingHorizontal: Spacing.two, paddingVertical: 1, borderRadius: Radius.pill },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two, paddingLeft: Spacing.two },
  pickerEmpty: { paddingVertical: Spacing.two, paddingLeft: Spacing.three },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  focusEmpty: {
    padding: Spacing.five,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  focusAnswered: { textDecorationLine: 'line-through', opacity: 0.6 },
  focusButtonRow: { flexDirection: 'row', gap: Spacing.two },
  pauseBtn: {
    flex: 1,
    minHeight: 64,
    borderRadius: Radius.large,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  stopBtn: {
    flex: 1.4,
    minHeight: 64,
    borderRadius: Radius.large,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },

  // 결과 모달
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  resultSheet: {
    width: '90%',
    maxWidth: 360,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    alignItems: 'stretch',
    gap: Spacing.two,
  },
  resultCheck: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: Spacing.one },
  resultGoalBox: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.two, marginTop: Spacing.two },
  resultTrack: { height: 10, borderRadius: Radius.pill, overflow: 'hidden' },
  resultFill: { height: '100%', borderRadius: Radius.pill },
  resultStats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one, marginBottom: Spacing.two },
  resultStat: { flexGrow: 1, flexBasis: '46%', minWidth: 72, alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth },
});
