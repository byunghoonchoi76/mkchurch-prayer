import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { ChurchInfo } from '@/constants/church';
import { parseYouTubeUrl } from '@/lib/youtube';

/**
 * 기도 타이머 배경음(BGM).
 *
 * ChurchInfo.prayerBgmUrls(여러 개) 값에 따라 재생 방식이 정해집니다.
 * - 유튜브 링크가 하나 이상: 공식 IFrame 플레이어로 재생목록을 만들어 번갈아·반복 재생(소리만).
 * - mp3 등 오디오 파일 링크(유튜브 아님): <audio> 로 직접 재생(광고 없음, 여러 곡이면 번갈아·반복).
 * - 비어 있으면: 앱이 직접 합성하는 잔잔한 패드음(저작권/파일 불필요, 오프라인 동작).
 *
 * 웹(PWA) 전용입니다. 네이티브에서는 조용히 아무 동작도 하지 않습니다.
 * 재생은 반드시 사용자 동작(기도 시작·켜기 버튼) 안에서 호출해야 브라우저 자동재생 정책을 통과합니다.
 */

const PREF_KEY = 'church-app/prayer-bgm';

type BgmEngine = { start: () => void; stop: () => void };

// ── 오디오 파일(mp3 등) 재생 ──────────────────────────────────────
const AUDIO_INDEX_KEY = 'church-app/prayer-bgm-audio-idx';

/** 곡 안에서 무작위 시작 지점(비율)을 고릅니다 — 앞 5%~뒤 15%는 남겨 둬 도입/마무리를 피합니다. */
function randomStartFraction(): number {
  return 0.05 + Math.random() * 0.8; // 5% ~ 85%
}

/**
 * mp3 등 오디오 파일을 재생합니다. (광고 없음)
 * - 여러 곡이면: 한 곡이 끝나면 다음 곡으로 이어지고 목록 끝에서 처음으로 반복.
 * - 세션마다: 시작 곡을 무작위로(직전 곡과 다르게) 골라 매번 다른 곡으로 시작합니다.
 * - 시작 지점도 곡 길이의 5~85% 중 무작위로 골라, 늘 같은 구간에서 시작하지 않게 합니다.
 */
function createAudioPlaylistEngine(urls: string[]): BgmEngine {
  let audio: HTMLAudioElement | null = null;
  let idx = 0;
  let wantPlay = false;

  AsyncStorage.getItem(AUDIO_INDEX_KEY)
    .then((v) => {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) idx = n % urls.length;
    })
    .catch(() => {});

  const ensure = () => {
    if (audio) return;
    audio = new (globalThis as { Audio: typeof Audio }).Audio();
    audio.volume = 0.4;
    // 한 곡이 끝나면 다음 곡으로 이어서 재생(목록 반복). 이어지는 곡은 처음부터 재생합니다.
    audio.addEventListener('ended', () => {
      if (!audio) return;
      idx = (idx + 1) % urls.length;
      audio.src = urls[idx];
      if (wantPlay) void audio.play().catch(() => {});
    });
  };

  // 지정한 곡을, 곡 길이의 fraction 지점부터 재생합니다.
  const playFrom = (i: number, fraction: number) => {
    const a = audio;
    if (!a) return;
    const seekAndPlay = () => {
      try {
        if (Number.isFinite(a.duration) && a.duration > 0) a.currentTime = a.duration * fraction;
      } catch {
        /* noop */
      }
      if (wantPlay) void a.play().catch(() => {});
    };
    if (a.src !== urls[i]) {
      a.src = urls[i];
      a.addEventListener('loadedmetadata', seekAndPlay, { once: true });
    } else if (a.readyState >= 1) {
      // 이미 같은 곡의 길이를 알고 있으면 바로 이동해 재생합니다.
      seekAndPlay();
    } else {
      a.addEventListener('loadedmetadata', seekAndPlay, { once: true });
    }
  };

  return {
    start() {
      try {
        wantPlay = true;
        ensure();
        if (!audio) return;
        // 시작 곡을 무작위로 고르고(곡이 여러 개면 직전 곡과 다르게), 곡 안의 시작 지점도 무작위로 정합니다.
        if (urls.length > 1) {
          let next = Math.floor(Math.random() * urls.length);
          if (next === idx) next = (next + 1) % urls.length;
          idx = next;
        }
        playFrom(idx % urls.length, randomStartFraction());
      } catch {
        /* 재생 실패는 조용히 무시합니다. */
      }
    },
    stop() {
      wantPlay = false;
      try {
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
      } catch {
        /* noop */
      }
      // 다음 기도는 다른 곡으로 시작하도록 인덱스를 넘깁니다.
      idx = (idx + 1) % urls.length;
      void AsyncStorage.setItem(AUDIO_INDEX_KEY, String(idx)).catch(() => {});
    },
  };
}

// ── 유튜브 음원 재생(공식 IFrame 플레이어) ────────────────────────
type YTGlobal = {
  YT?: { Player: new (el: Element | string, opts: unknown) => unknown };
  onYouTubeIframeAPIReady?: () => void;
  __prayerYtApi?: Promise<{ Player: new (el: Element | string, opts: unknown) => unknown }>;
};

function loadYouTubeApi(): Promise<{ Player: new (el: Element | string, opts: unknown) => unknown }> {
  const w = globalThis as unknown as YTGlobal;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (!w.__prayerYtApi) {
    w.__prayerYtApi = new Promise((resolve) => {
      const prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        prev?.();
        if (w.YT?.Player) resolve(w.YT);
      };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
      // 콜백이 안 오는 경우를 대비한 폴링.
      const timer = setInterval(() => {
        if (w.YT?.Player) {
          clearInterval(timer);
          resolve(w.YT);
        }
      }, 300);
    });
  }
  return w.__prayerYtApi;
}

const YT_INDEX_KEY = 'church-app/prayer-bgm-idx';

/**
 * 여러 유튜브 음원을 재생목록으로 재생합니다.
 * - 한 세션 안에서: 한 곡이 끝나면 다음 곡으로 이어지고, 목록 끝에서 처음으로 반복(setLoop).
 * - 세션마다: 시작 곡을 번갈아(다음 인덱스로) 지정해, 짧은 기도라도 매번 다른 곡으로 시작합니다.
 */
function createYouTubePlaylistEngine(videoIds: string[]): BgmEngine {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let player: any = null;
  let ready = false;
  let wantPlay = false;
  let startIndex = 0;

  // 이전에 저장된 시작 인덱스를 불러와, 앱을 다시 열어도 번갈아 시작되도록 합니다.
  AsyncStorage.getItem(YT_INDEX_KEY)
    .then((v) => {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) startIndex = n % videoIds.length;
    })
    .catch(() => {});

  const playFromStartIndex = () => {
    if (!player) return;
    try {
      player.setLoop(true);
      player.setVolume(35);
      // 배열을 그대로 재생목록으로 로드하고 startIndex 곡부터 재생합니다.
      player.loadPlaylist({ playlist: videoIds, index: startIndex % videoIds.length, startSeconds: 0 });
    } catch {
      /* noop */
    }
  };

  const ensure = () => {
    if (player) return;
    let host = document.getElementById('prayer-bgm-yt');
    if (!host) {
      host = document.createElement('div');
      host.id = 'prayer-bgm-yt';
      // 화면 밖에 두되 크기는 0 이 아니게 해 재생이 막히지 않도록 합니다.
      host.style.cssText = 'position:fixed;left:-9999px;bottom:0;width:200px;height:120px;pointer-events:none;opacity:0;';
      document.body.appendChild(host);
    }
    void loadYouTubeApi().then((YT) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      player = new (YT as any).Player(host, {
        videoId: videoIds[0],
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onReady: () => {
            ready = true;
            if (wantPlay) playFromStartIndex();
          },
        },
      });
    });
  };

  return {
    start() {
      wantPlay = true;
      ensure();
      if (ready && player) playFromStartIndex();
    },
    stop() {
      wantPlay = false;
      if (player) {
        try {
          player.pauseVideo();
        } catch {
          /* noop */
        }
      }
      // 다음 기도는 다른 곡으로 시작하도록 인덱스를 넘깁니다.
      startIndex = (startIndex + 1) % videoIds.length;
      void AsyncStorage.setItem(YT_INDEX_KEY, String(startIndex)).catch(() => {});
    },
  };
}

// ── 내장 잔잔한 배경음(Web Audio 합성) ─────────────────────────────
function createAmbientEngine(): BgmEngine {
  // 느슨한 타입: RN 환경에서도 tsc 를 통과하도록 any 로 둡니다.
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let nodes: OscillatorNode[] = [];

  const build = () => {
    const AC: typeof AudioContext | undefined =
      (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ||
      (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;

    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.3;
    filter.connect(master);

    // C3 · G3 · C4 — 편안한 완전5도/옥타브 화음
    const freqs = [130.81, 196.0, 261.63];
    for (const f of freqs) {
      const g = ctx.createGain();
      g.gain.value = 0.16;
      g.connect(filter);
      // 살짝 디튜닝한 두 사인파를 겹쳐 따뜻한 패드음을 만듭니다.
      for (const mult of [1, 1.006]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * mult;
        o.connect(g);
        o.start();
        nodes.push(o);
      }
    }

    // 아주 느린 LFO 로 필터를 흔들어 음색에 미세한 움직임을 줍니다.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    nodes.push(lfo);
  };

  return {
    start() {
      try {
        if (!ctx) build();
        if (!ctx || !master) return;
        if (ctx.state === 'suspended') void ctx.resume();
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
        master.gain.exponentialRampToValueAtTime(0.1, now + 2.5); // 은은하게 페이드인
      } catch {
        /* noop */
      }
    },
    stop() {
      if (!ctx || !master) return;
      const c = ctx;
      const m = master;
      const ns = nodes;
      ctx = null;
      master = null;
      nodes = [];
      try {
        const now = c.currentTime;
        m.gain.cancelScheduledValues(now);
        m.gain.setValueAtTime(m.gain.value, now);
        m.gain.exponentialRampToValueAtTime(0.0001, now + 1.0); // 페이드아웃
        setTimeout(() => {
          ns.forEach((n) => {
            try {
              n.stop();
            } catch {
              /* noop */
            }
          });
          void c.close().catch(() => {});
        }, 1100);
      } catch {
        /* noop */
      }
    },
  };
}

let engine: BgmEngine | null = null;
function getEngine(): BgmEngine | null {
  if (Platform.OS !== 'web') return null;
  if (!engine) {
    const urls = (ChurchInfo.prayerBgmUrls ?? []).filter(Boolean);
    // 유튜브가 아닌 링크(mp3 등 오디오 파일)를 우선합니다 — 광고가 없습니다.
    const audioUrls = urls.filter((u) => !parseYouTubeUrl(u));
    const ytIds = urls
      .map((u) => parseYouTubeUrl(u)?.videoId)
      .filter((id): id is string => !!id);
    if (audioUrls.length) engine = createAudioPlaylistEngine(audioUrls);
    else if (ytIds.length) engine = createYouTubePlaylistEngine(ytIds);
    else engine = createAmbientEngine();
  }
  return engine;
}

/** 기도 배경음 상태·조작 훅. */
export function usePrayerBgm() {
  const available = Platform.OS === 'web';
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(PREF_KEY)
      .then((v) => {
        if (v === 'off') setEnabledState(false);
      })
      .catch(() => {});
  }, []);

  const start = useCallback(() => {
    if (available) getEngine()?.start();
  }, [available]);

  const stop = useCallback(() => {
    getEngine()?.stop();
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    void AsyncStorage.setItem(PREF_KEY, next ? 'on' : 'off').catch(() => {});
  }, []);

  return { available, enabled, setEnabled, start, stop };
}
