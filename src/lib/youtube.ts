import { Platform } from 'react-native';

/**
 * 유튜브 주소를 앱 안에서 재생할 수 있는 형태로 해석합니다.
 * 일반 영상 · 쇼츠 · 라이브 · 짧은 주소(youtu.be)를 모두 지원합니다.
 */

export type YouTubeKind = 'video' | 'shorts' | 'live';

export interface YouTubeRef {
  videoId: string;
  kind: YouTubeKind;
  /** 앱/웹에 그대로 끼워 넣을 수 있는 재생 주소 */
  embedUrl: string;
  /** 쇼츠처럼 세로 영상이면 true */
  portrait: boolean;
  /** 유튜브 앱·웹에서 열 때 쓰는 원래 주소 */
  watchUrl: string;
}

const ID = '[A-Za-z0-9_-]{6,}';

const PATTERNS: { re: RegExp; kind: YouTubeKind }[] = [
  { re: new RegExp(`youtube\\.com/watch\\?(?:.*&)?v=(${ID})`), kind: 'video' },
  { re: new RegExp(`youtu\\.be/(${ID})`), kind: 'video' },
  { re: new RegExp(`youtube\\.com/embed/(${ID})`), kind: 'video' },
  { re: new RegExp(`youtube\\.com/v/(${ID})`), kind: 'video' },
  { re: new RegExp(`youtube\\.com/shorts/(${ID})`), kind: 'shorts' },
  { re: new RegExp(`youtube\\.com/live/(${ID})`), kind: 'live' },
];

/** 유튜브 영상 주소면 재생 정보를, 아니면(채널 주소·오디오 파일 등) null 을 돌려줍니다. */
export function parseYouTubeUrl(url: string | undefined | null): YouTubeRef | null {
  if (!url) return null;
  const trimmed = url.trim();

  for (const { re, kind } of PATTERNS) {
    const match = trimmed.match(re);
    if (match?.[1]) {
      const videoId = match[1];
      return {
        videoId,
        kind,
        // playsinline: 휴대폰에서 전체화면으로 튀지 않고 화면 안에서 재생
        // rel=0: 재생이 끝나도 같은 채널 영상만 제안
        embedUrl: `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1`,
        portrait: kind === 'shorts',
        watchUrl:
          kind === 'shorts'
            ? `https://www.youtube.com/shorts/${videoId}`
            : `https://www.youtube.com/watch?v=${videoId}`,
      };
    }
  }
  return null;
}

/** 유튜브 채널 주소인지 (개별 영상이 아니라 채널로 연결되는 경우) */
export function isYouTubeChannelUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return /youtube\.com\/(@|c\/|channel\/|user\/)/.test(url) && !parseYouTubeUrl(url);
}

/** 유튜브가 공개로 제공하는 썸네일 주소 (별도 설정 없이 바로 쓸 수 있습니다) */
export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** 설교 카테고리 — 화면 필터·배지에 쓰는 표준 분류 */
export type SermonCategory =
  | '주일예배'
  | '실시간'
  | '주일 저녁예배'
  | '새벽예배'
  | '수요예배'
  | '금요집회'
  | '청년예배'
  | '찬양'
  | '쇼츠';

/** 카테고리 표시 순서 (필터 칩 정렬용) */
export const SERMON_CATEGORY_ORDER: SermonCategory[] = [
  '주일예배',
  '실시간',
  '주일 저녁예배',
  '새벽예배',
  '수요예배',
  '금요집회',
  '청년예배',
  '찬양',
  '쇼츠',
];

/**
 * 유튜브 영상 제목(+쇼츠 여부)으로 예배 카테고리를 자동 분류합니다.
 * 교회 채널 제목 규칙(주일예배·새벽예배·수요부흥예배·금요성령집회·찬양대 등)에 맞춰 판별합니다.
 */
export function classifyChurchVideo(title: string, isShorts = false): SermonCategory {
  const t = (title ?? '').replace(/\s/g, '');
  if (isShorts || /#?shorts|쇼츠/i.test(title ?? '')) return '쇼츠';
  // 구체적인 예배 종류를 먼저 판별합니다.
  // (실시간 중계본이라 제목에 '실시간'이 함께 있어도, 수요·새벽·주일 등 실제 예배로 봅니다.
  //  그래야 홈 '이번 주 말씀'에서 실시간으로 올라온 수요예배 등이 정상적으로 노출됩니다.)
  if (/새벽/.test(t)) return '새벽예배';
  if (/수요/.test(t)) return '수요예배';
  if (/금요/.test(t)) return '금요집회';
  // 찬양대·성가대·특송 등 '찬양 순서'만 찬양으로 분류합니다. ('찬양예배'는 예배이므로 제외)
  if (/(찬양대|성가대|특송|성가곡|워십팀)/.test(t)) return '찬양';
  // 주일 저녁(오후) 예배 · 찬양예배는 '주일 저녁예배'로 묶습니다.
  if (/(저녁예배|찬양예배|오후예배)/.test(t)) return '주일 저녁예배';
  // 4부예배·청년 관련은 청년예배로 (주일 판별보다 먼저).
  if (/(4부|사부|청년|only ?one|온리원)/i.test(t)) return '청년예배';
  if (/주일|주보|1부|2부|3부|오전예배/.test(t)) return '주일예배';
  // 위 어떤 예배명도 없는 '순수 실시간 중계'만 별도 '실시간'으로 분리합니다.
  if (/실시간/.test(t)) return '실시간';
  return '청년예배';
}

// 같은 영상을 여러 화면에서 열어도 한 번만 불러오도록 기억해 둡니다.
const titleCache = new Map<string, string>();

/**
 * 유튜브 영상 제목을 가져옵니다. API 키가 필요 없는 oEmbed 를 먼저 쓰고,
 * 브라우저에서 막히는 경우를 대비해 noembed 로 한 번 더 시도합니다.
 * 실패하면 null 을 돌려주고, 화면은 저장된 제목을 그대로 씁니다.
 */
export async function fetchYouTubeTitle(url: string): Promise<string | null> {
  const ref = parseYouTubeUrl(url);
  if (!ref) return null;

  const cached = titleCache.get(ref.videoId);
  if (cached) return cached;

  const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(ref.watchUrl)}&format=json`;
  const noembed = `https://noembed.com/embed?url=${encodeURIComponent(ref.watchUrl)}`;

  // 웹 브라우저에서는 유튜브 oEmbed 가 CORS 로 막히므로 noembed 를 먼저 씁니다.
  // 앱(iOS·안드로이드)에서는 그런 제약이 없어 유튜브를 먼저 부릅니다.
  const endpoints = Platform.OS === 'web' ? [noembed, oembed] : [oembed, noembed];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) continue;
      const json = (await response.json()) as { title?: string };
      const title = json.title?.trim();
      if (title) {
        titleCache.set(ref.videoId, title);
        return title;
      }
    } catch {
      // 다음 방법으로 넘어갑니다.
    }
  }
  return null;
}
