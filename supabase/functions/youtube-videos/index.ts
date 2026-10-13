// 교회 유튜브 채널 최신 영상 목록 — 설교 자동 노출·가져오기에 사용합니다.
//
// 앱이 이 함수를 호출하면, 서버(Supabase)가 유튜브에서 채널의 최근 업로드 영상을 가져와
// { videos: [{ videoId, title, publishedAt, thumbnail, description, isShort }] } 형태로 돌려줍니다.
// 유튜브 API 키는 이 함수(서버) 안에만 두므로 앱 코드에는 노출되지 않습니다.
//
// 쇼츠 판별: 유튜브 Data API 로 영상 '길이'를 한 번에 받아 짧은 영상(≤ 3분)을 쇼츠로 봅니다.
//   - 교회 채널은 정식 예배가 길기 때문에(수십 분) 길이 기준이 빠르고 정확합니다.
//   - 영상마다 네트워크로 따로 확인하지 않으므로 목록이 빨리 뜹니다(홈 '이번 주 말씀' 포함).
//
// 필요 시크릿(Edge Functions → Secrets) — 실시간 배지(live-status)와 같은 키를 씁니다:
//   YOUTUBE_API_KEY   (필수)
//   (선택) YT_HANDLE=@mychmedia , YT_CHANNEL_ID=UC...
// 배포:  Verify JWT 끄고 배포.

const HANDLE = (Deno.env.get('YT_HANDLE') ?? '@mychmedia').replace(/^@?/, '@');
const API_KEY = Deno.env.get('YOUTUBE_API_KEY') ?? '';
const CHANNEL_ID_ENV = Deno.env.get('YT_CHANNEL_ID') ?? '';
// 가져올 최신 영상 수. 최근 며칠간 새벽·수요·주일 예배가 많이 올라오면 15개로는
// 조금 지난 쇼츠가 밀려나 빠집니다. 50개까지 받아 더 넓게 포함합니다.
// (playlistItems·videos 모두 한 번의 호출로 최대 50개까지 처리 → 속도·할당량 영향 없음)
const MAX = 50;

// 유튜브 할당량 절약: 결과를 30분간 재사용합니다. (업로드 후 최대 30분 내 노출)
const CACHE_TTL_MS = 1_800_000;
// 이 길이(초) 이하이면 쇼츠로 봅니다. 유튜브 쇼츠는 최대 3분(180초)입니다.
const SHORT_MAX_SECONDS = 185;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface Video {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  description: string;
  /** 유튜브 쇼츠(짧은 영상) 여부 — 앱에서 '쇼츠' 카테고리로만 분류하는 데 씁니다. */
  isShort: boolean;
}

/** 제목에 쇼츠 표기가 있으면 즉시 쇼츠로 봅니다. (길이 확인 전 보조 신호) */
function titleIsShort(title: string): boolean {
  return /#?shorts|쇼츠/i.test(title ?? '');
}

/** ISO8601 길이(PT1M30S 등)를 초로 변환합니다. 라이브/미상은 0. */
function iso8601ToSeconds(iso: string | undefined): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso ?? '');
  if (!m) return 0;
  const [, d, h, mi, s] = m;
  return (+(d ?? 0)) * 86400 + (+(h ?? 0)) * 3600 + (+(mi ?? 0)) * 60 + (+(s ?? 0));
}

let cache: { at: number; data: Video[] } | null = null;
let cachedUploads = '';

/** 채널 ID(UC...)에서 '업로드 재생목록 ID(UU...)'를 얻습니다. */
async function resolveUploadsPlaylist(): Promise<string> {
  if (cachedUploads) return cachedUploads;

  const channelId = CHANNEL_ID_ENV;
  const url = channelId
    ? `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`
    : `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${HANDLE.replace(/^@/, '')}&key=${API_KEY}`;
  const res = await fetch(url);
  const json = await res.json();
  cachedUploads = json?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? '';
  return cachedUploads;
}

/** 여러 영상의 길이(초)를 한 번의 API 호출로 받아옵니다. */
async function fetchDurations(ids: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (ids.length === 0) return map;
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids.join(',')}&key=${API_KEY}`,
  );
  const json = await res.json();
  for (const it of (json?.items ?? []) as { id?: string; contentDetails?: { duration?: string } }[]) {
    if (it.id) map.set(it.id, iso8601ToSeconds(it.contentDetails?.duration));
  }
  return map;
}

async function getVideos(): Promise<Video[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  if (!API_KEY) return [];

  const uploads = await resolveUploadsPlaylist();
  if (!uploads) return [];

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploads}` +
      `&maxResults=${MAX}&key=${API_KEY}`,
  );
  const json = await res.json();
  const items: unknown[] = json?.items ?? [];

  const videos: Video[] = items
    .map((raw) => {
      const sn = (raw as { snippet?: Record<string, unknown> }).snippet ?? {};
      const resourceId = (sn.resourceId as { videoId?: string }) ?? {};
      const thumbs = (sn.thumbnails as Record<string, { url?: string }>) ?? {};
      const thumb = thumbs.medium?.url ?? thumbs.high?.url ?? thumbs.default?.url ?? '';
      return {
        videoId: resourceId.videoId ?? '',
        title: String(sn.title ?? ''),
        publishedAt: String(sn.publishedAt ?? ''),
        thumbnail: thumb,
        description: String(sn.description ?? '').slice(0, 500),
        isShort: false,
      };
    })
    .filter((v) => v.videoId && v.title !== 'Private video' && v.title !== 'Deleted video');

  // 영상 길이를 한 번에 받아 짧은 영상(≤ 3분)을 쇼츠로 분류합니다. (빠르고 정확)
  const durations = await fetchDurations(videos.map((v) => v.videoId));
  videos.forEach((v) => {
    const secs = durations.get(v.videoId) ?? 0;
    v.isShort = titleIsShort(v.title) || (secs > 0 && secs <= SHORT_MAX_SECONDS);
  });

  cache = { at: Date.now(), data: videos };
  return videos;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const videos = await getVideos();
    return new Response(JSON.stringify({ ok: true, videos }), {
      headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e), videos: [] }), {
      status: 200,
      headers: { ...CORS, 'content-type': 'application/json' },
    });
  }
});
