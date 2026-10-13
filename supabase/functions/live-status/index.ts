// 실시간 예배 감지 — 유튜브 채널이 "지금" 라이브 방송 중인지 확인해 돌려줍니다.
//
// 앱(웹/모바일)이 이 함수를 호출하면, 함수가 서버(Supabase) 쪽에서 유튜브를 확인하고
// { live, videoId, watchUrl, title } 을 돌려줍니다. 유튜브 API 키는 이 함수 안(서버)에만
// 두므로 앱 코드에는 노출되지 않습니다.
//
// 두 가지 방식이 있으며, 시크릿 설정에 따라 자동으로 골라 씁니다.
//   1) YOUTUBE_API_KEY 시크릿이 있으면 → 공식 YouTube Data API 로 정확히 확인 (하루 할당량 있음)
//   2) 없으면(기본) → 채널의 /live 페이지를 읽어 방송 여부를 판별 (키·할당량 불필요)
//
// 배포:  supabase functions deploy live-status --no-verify-jwt
// (선택) 채널 손잡이:  supabase secrets set YT_HANDLE=@mychmedia
// (선택) 공식 API:     supabase secrets set YOUTUBE_API_KEY=... (+ 필요시 YT_CHANNEL_ID=UC...)

const HANDLE = (Deno.env.get('YT_HANDLE') ?? '@mychmedia').replace(/^@?/, '@');
const API_KEY = Deno.env.get('YOUTUBE_API_KEY') ?? '';
const CHANNEL_ID = Deno.env.get('YT_CHANNEL_ID') ?? '';

// 여러 사람이 동시에 열어도 유튜브를 자주 두드리지 않도록 결과를 재사용합니다.
// 상태에 따라 재확인 주기를 다르게 둡니다(반응성 ↔ 할당량 균형).
const TTL_LIVE_MS = 120_000; // 방송 중: 2분마다 재확인(종료를 빨리 감지)
const TTL_WINDOW_MS = 300_000; // 예배 시간대(방송 아님): 5분마다 재확인(시작을 빨리 감지)
const TTL_IDLE_MS = 900_000; // 그 외 시간대(방송 아님): 15분마다 재확인

// ── 예배 시간대(Asia/Seoul) ──────────────────────────────────────
// 이 시간대에는 더 자주 확인합니다(예정된 예배 시작을 빨리 감지). 시간대와 무관하게
// 스크랩으로는 항상 확인하므로, 예정에 없던 스트리밍·특별집회도 배지가 켜집니다.
// day: 0=일 1=월 2=화 3=수 4=목 5=금 6=토
const SERVICES: { day: number; h: number; m: number }[] = [
  // 주일 예배
  { day: 0, h: 7, m: 30 }, { day: 0, h: 9, m: 30 }, { day: 0, h: 11, m: 30 }, { day: 0, h: 14, m: 0 }, { day: 0, h: 17, m: 0 },
  // 새벽예배 (월~금) 오전 5:30
  { day: 1, h: 5, m: 30 }, { day: 2, h: 5, m: 30 }, { day: 3, h: 5, m: 30 }, { day: 4, h: 5, m: 30 }, { day: 5, h: 5, m: 30 },
  // 수요예배 / 금요집회
  { day: 3, h: 19, m: 0 }, { day: 5, h: 20, m: 0 },
];
const PRE_MIN = 10; // 예배 시작 10분 전부터 자주 확인
const POST_MIN = 180; // 시작 후 3시간까지 예배 시간대로 보고 자주 확인

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function nowSeoul(): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  let h = parseInt(get('hour'), 10);
  if (h === 24) h = 0;
  return { weekday: WD[get('weekday')] ?? 0, minutes: h * 60 + parseInt(get('minute'), 10) };
}
function inServiceWindow(): boolean {
  const { weekday, minutes } = nowSeoul();
  return SERVICES.some((s) => {
    const start = s.h * 60 + s.m;
    return s.day === weekday && minutes >= start - PRE_MIN && minutes <= start + POST_MIN;
  });
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface LiveStatus {
  live: boolean;
  videoId: string | null;
  watchUrl: string | null;
  title: string | null;
  source: 'api' | 'scrape';
  checkedAt: string;
  // 진단용 정보 (앱은 무시합니다) — 문제 파악을 위해 함께 돌려줍니다.
  keyed?: boolean;
  httpStatus?: number;
  note?: string;
  // 스크랩·API 각각의 판별 결과 (원인 파악용)
  diag?: {
    scrapeHttp?: number;
    scrapeLive?: boolean;
    apiChecked?: boolean;
    apiLive?: boolean;
    apiError?: string;
    inWindow?: boolean;
  };
}

let cache: { at: number; data: LiveStatus } | null = null;
let cachedUploads = '';

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function notLiveApi(): LiveStatus {
  return { live: false, videoId: null, watchUrl: null, title: null, source: 'api', checkedAt: new Date().toISOString() };
}

/** 할당량 초과·키 오류 등 API 오류면 진단에 드러나게 던집니다. */
function throwIfApiError(res: Response, json: { error?: { errors?: { reason?: string }[]; status?: string; message?: string } }) {
  if (json?.error) {
    const reason = json.error?.errors?.[0]?.reason ?? json.error?.status ?? '';
    throw new Error(`YouTube API 오류(${res.status} ${reason}): ${json.error?.message ?? ''}`.trim());
  }
}

/**
 * 공식 YouTube Data API 로 확인 (YOUTUBE_API_KEY 가 있을 때).
 * 채널의 '최신 업로드' 중 liveBroadcastContent 가 'live' 인 영상을 직접 찾습니다.
 * (search?eventType=live 는 인덱싱 지연으로 라이브를 놓칠 수 있어, 더 즉각적인 이 방식을 씁니다.)
 */
async function checkViaApi(): Promise<LiveStatus> {
  // 채널 → 업로드 재생목록(UU...) 을 한 번만 해석해 둡니다.
  if (!cachedUploads) {
    const url = CHANNEL_ID
      ? `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${CHANNEL_ID}&key=${API_KEY}`
      : `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${HANDLE.replace(/^@/, '')}&key=${API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    throwIfApiError(res, json);
    cachedUploads = json?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? '';
  }
  if (!cachedUploads) return notLiveApi();

  // 최근 업로드 몇 개의 영상 ID (라이브 방송도 업로드 목록에 나타납니다)
  const plRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${cachedUploads}&maxResults=5&key=${API_KEY}`,
  );
  const plJson = await plRes.json();
  throwIfApiError(plRes, plJson);
  const ids: string[] = (plJson?.items ?? [])
    .map((it: { contentDetails?: { videoId?: string } }) => it?.contentDetails?.videoId)
    .filter(Boolean);
  if (ids.length === 0) return notLiveApi();

  // 각 영상의 실시간 상태를 확인 → 'live' 인 영상이 있으면 방송 중.
  const vRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids.join(',')}&key=${API_KEY}`,
  );
  const vJson = await vRes.json();
  throwIfApiError(vRes, vJson);
  const liveItem = (vJson?.items ?? []).find(
    (it: { snippet?: { liveBroadcastContent?: string } }) => it?.snippet?.liveBroadcastContent === 'live',
  ) as { id?: string; snippet?: { title?: string } } | undefined;

  if (liveItem?.id) {
    return {
      live: true,
      videoId: liveItem.id,
      watchUrl: `https://www.youtube.com/watch?v=${liveItem.id}`,
      title: liveItem.snippet?.title ?? null,
      source: 'api',
      checkedAt: new Date().toISOString(),
    };
  }
  return notLiveApi();
}

/** 채널 /live 페이지를 읽어 방송 여부 판별 (키 없이 동작) */
async function checkViaScrape(): Promise<LiveStatus> {
  const res = await fetch(`https://www.youtube.com/${HANDLE}/live?hl=ko&gl=KR`, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
      'accept-language': 'ko-KR,ko;q=0.9',
      // 유럽 동의(consent) 페이지로 넘어가지 않도록
      cookie: 'CONSENT=YES+cb',
    },
    redirect: 'follow',
  });
  const html = await res.text();

  // 라이브 방송 중이면 /live 가 실제 시청 페이지로 이어지며 아래 신호가 담깁니다.
  const isLiveNow =
    /"isLiveNow"\s*:\s*true/.test(html) ||
    (/"isLive"\s*:\s*true/.test(html) && /hlsManifestUrl/.test(html));

  // 라이브면 canonical 이 watch?v= 로, 아니면 채널 주소로 향합니다.
  const canon = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/);
  const videoId = canon?.[1] ?? null;
  const live = Boolean(isLiveNow && videoId);

  const titleMatch = html.match(/<meta property="og:title" content="([^"]*)"/);
  const title = titleMatch ? decodeEntities(titleMatch[1]) : null;

  // 유튜브가 서버 IP 를 막으면(403 등) 스크랩으로는 감지할 수 없습니다 → 진단에 남깁니다.
  const note =
    res.status !== 200
      ? `유튜브가 스크랩 요청을 차단했습니다(HTTP ${res.status}). 유튜브 API 키(YOUTUBE_API_KEY)를 설정하면 안정적으로 감지됩니다.`
      : live
        ? undefined
        : '라이브 신호를 찾지 못했습니다(방송 아님이거나 페이지 형식 변경).';

  return {
    live,
    videoId: live ? videoId : null,
    watchUrl: live ? `https://www.youtube.com/watch?v=${videoId}` : null,
    title: live ? title : null,
    source: 'scrape',
    checkedAt: new Date().toISOString(),
    httpStatus: res.status,
    note,
  };
}

async function safeScrape(): Promise<LiveStatus> {
  try {
    return await checkViaScrape();
  } catch (e) {
    return {
      live: false,
      videoId: null,
      watchUrl: null,
      title: null,
      source: 'scrape',
      checkedAt: new Date().toISOString(),
      httpStatus: 0,
      note: `스크랩 확인 오류: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

async function safeApi(): Promise<{ status: LiveStatus | null; error?: string }> {
  try {
    return { status: await checkViaApi() };
  } catch (e) {
    return { status: null, error: e instanceof Error ? e.message : String(e) };
  }
}

async function getStatus(): Promise<LiveStatus> {
  const prev = cache?.data ?? null;
  const wasLive = prev?.live === true;
  const inWindow = inServiceWindow();

  // 상태별로 재확인 주기를 다르게 둡니다.
  const ttl = wasLive ? TTL_LIVE_MS : inWindow ? TTL_WINDOW_MS : TTL_IDLE_MS;
  if (cache && Date.now() - cache.at < ttl) return cache.data;

  const diag: NonNullable<LiveStatus['diag']> = { inWindow };
  let data: LiveStatus | null = null;

  // 1) 공식 API 우선 — 채널 최신 업로드의 liveBroadcastContent 로 가장 정확하게 확인.
  if (API_KEY) {
    const { status: api, error } = await safeApi();
    diag.apiChecked = true;
    diag.apiError = error;
    diag.apiLive = api?.live;
    if (api) data = api; // 방송 중이든 아니든 API 결과를 채택
  }

  // 2) API가 없거나 라이브를 못 찾았으면 무료 스크랩으로 한 번 더 확인.
  if (!data || !data.live) {
    const scrape = await safeScrape();
    diag.scrapeHttp = scrape.httpStatus;
    diag.scrapeLive = scrape.live;
    if (scrape.live) data = scrape;
    else if (!data) data = scrape;
  }

  if (!data) data = notLiveApi();

  // 3) 확인이 불확실(API 오류 + 스크랩 차단)한데 직전이 방송 중이었다면 이전 상태 유지.
  //    → 일시적 실패로 방송 중 배지가 꺼지지 않게(방송이 끝날 때까지 유지).
  const scrapeBlocked = diag.scrapeHttp !== undefined && diag.scrapeHttp !== 200;
  const unresolved = !data.live && Boolean(diag.apiError) && scrapeBlocked;
  if (unresolved && wasLive && prev) {
    data = {
      ...prev,
      checkedAt: new Date().toISOString(),
      note: '일시적으로 확인하지 못해 이전 방송 상태를 유지합니다.',
    };
  }

  data.diag = diag;

  data.keyed = Boolean(API_KEY);
  cache = { at: Date.now(), data };
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const data = await getStatus();
  return new Response(JSON.stringify(data), {
    headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
});
