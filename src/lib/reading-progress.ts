import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { dataMode, repository } from '@/lib/data';

/**
 * 맥체인 성경읽기표 '읽기 완료' 진도.
 * - 로그인(계정) 상태면 서버에 저장해 여러 기기에서 공유됩니다.
 * - 로그인 전/샘플 모드면 이 기기(AsyncStorage)에만 저장합니다.
 * - 처음 로그인하면 기기에 있던 진도를 계정으로 한 번 합칩니다.
 * 완료한 날은 표의 인덱스(0~364)로 기억합니다.
 */
const KEY = 'church-app/mccheyne-done';

async function readLocal(): Promise<Set<number>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return new Set(JSON.parse(raw) as number[]);
  } catch {
    /* 무시 */
  }
  return new Set();
}

async function writeLocal(set: Set<number>): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* 무시 */
  }
}

export function useReadingProgress() {
  const { user } = useAuth();
  const server = dataMode === 'supabase' && !!user;
  const [done, setDone] = useState<Set<number>>(new Set());
  const [ready, setReady] = useState(false);
  const serverRef = useRef(server);
  serverRef.current = server;

  useEffect(() => {
    let active = true;
    (async () => {
      const local = await readLocal();
      if (!server) {
        if (active) {
          setDone(local);
          setReady(true);
        }
        return;
      }
      // 계정 진도 + 기기 진도를 합쳐(한 번) 계정에 저장하고, 계정 값을 기준으로 씁니다.
      try {
        const account = new Set(await repository.getMyReadingProgress());
        const merged = new Set<number>([...account, ...local]);
        if (merged.size !== account.size) await repository.setMyReadingProgress([...merged]);
        if (active) setDone(merged);
      } catch {
        if (active) setDone(local); // 서버 실패 시 로컬로 표시
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [server, user?.id]);

  const toggle = useCallback((idx: number) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      if (serverRef.current) repository.setMyReadingProgress([...next]).catch(() => {});
      else void writeLocal(next);
      return next;
    });
  }, []);

  return { done, ready, toggle, count: done.size, synced: server };
}

/**
 * 본문(챕터)별 읽기 표시 — 하루 4곳을 각각 체크합니다. (이 기기에만 저장)
 * 하루 4곳을 모두 읽으면 화면에서 그 날을 useReadingProgress 의 '완료'로 올려,
 * 진도/달력/여러 기기 공유는 기존 '일자 단위' 저장을 그대로 씁니다.
 * 키는 `${일차인덱스}:${본문번호 0~3}` 형태입니다.
 */
const CHAPTER_KEY = 'church-app/mccheyne-chapters';

export function useChapterReads() {
  const [set, setSet] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CHAPTER_KEY);
        if (raw && active) setSet(new Set(JSON.parse(raw) as string[]));
      } catch {
        /* 무시 */
      }
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const persist = (next: Set<string>) => {
    void AsyncStorage.setItem(CHAPTER_KEY, JSON.stringify([...next])).catch(() => {});
  };

  /** 그 날의 체크된 본문 번호들을 통째로 교체합니다. */
  const replaceDay = useCallback((dayIdx: number, chapters: Set<number>) => {
    setSet((prev) => {
      const next = new Set([...prev].filter((k) => !k.startsWith(`${dayIdx}:`)));
      chapters.forEach((p) => next.add(`${dayIdx}:${p}`));
      persist(next);
      return next;
    });
  }, []);

  /** 그 날의 본문 체크를 모두 지웁니다. */
  const clearDay = useCallback((dayIdx: number) => {
    setSet((prev) => {
      const next = new Set([...prev].filter((k) => !k.startsWith(`${dayIdx}:`)));
      persist(next);
      return next;
    });
  }, []);

  return { set, ready, replaceDay, clearDay };
}
