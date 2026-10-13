import { useCallback, useEffect, useRef, useState } from 'react';

import { sampleRepository } from '@/lib/data/sample-repository';
import { supabaseRepository } from '@/lib/data/supabase-repository';
import type { ChurchRepository } from '@/lib/data/types';
import { hasSupabaseConfig } from '@/lib/supabase';

/**
 * .env 에 Supabase 설정이 있으면 실제 DB 를, 없으면 샘플 데이터를 사용합니다.
 * 화면 코드는 어느 쪽인지 신경 쓰지 않아도 됩니다.
 */
export const repository: ChurchRepository = hasSupabaseConfig
  ? supabaseRepository
  : sampleRepository;

export const dataMode = repository.mode;

/** 인터넷·서버 문제로 실패했을 때 사람이 읽을 수 있는 말로 바꿔 줍니다. */
function toFriendlyMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/abort|network|failed to fetch|timeout|timed out/i.test(raw)) {
    return '서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
  }
  if (/relation .* does not exist|schema cache/i.test(raw)) {
    return '데이터베이스 준비가 아직 끝나지 않았습니다. supabase/schema.sql 을 실행했는지 확인해 주세요.';
  }
  return raw || '알 수 없는 오류가 발생했습니다.';
}

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | undefined;
  reload: () => void;
  /** 서버를 다시 부르지 않고 화면의 값만 즉시 바꾸고 싶을 때 사용 (낙관적 업데이트) */
  setData: (updater: T | ((current: T | undefined) => T | undefined)) => void;
}

/** 비동기 저장소 호출을 화면에서 편하게 쓰기 위한 훅. */
export function useAsyncData<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setDataState] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);

  // 최신 loader 를 참조하되, 재실행은 deps/nonce 로만 일어나게 합니다.
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setLoading(true);
    setError(undefined);

    // 응답이 너무 오래 걸리면(네트워크 지연 등) 무한 로딩 대신 오류로 알려 줍니다.
    const withTimeout = new Promise<T>((resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error('서버 응답이 늦어지고 있습니다. 잠시 후 다시 시도해 주세요.')),
        20000,
      );
      loaderRef.current().then(resolve, reject);
    });

    withTimeout
      .then((result) => {
        if (cancelled || !mounted.current) return;
        setDataState(result);
      })
      .catch((e: unknown) => {
        if (cancelled || !mounted.current) return;
        setError(toFriendlyMessage(e));
      })
      .finally(() => {
        if (timer) clearTimeout(timer);
        if (cancelled || !mounted.current) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const setData = useCallback((updater: T | ((current: T | undefined) => T | undefined)) => {
    setDataState((current) =>
      typeof updater === 'function' ? (updater as (c: T | undefined) => T)(current) : updater,
    );
  }, []);

  return { data, loading, error, reload, setData };
}

export * from '@/lib/data/types';
