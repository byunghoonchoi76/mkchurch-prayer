import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** .env 에 Supabase 값이 채워져 있으면 true. 없으면 앱은 샘플 데이터로 동작합니다. */
export const hasSupabaseConfig = Boolean(url && anonKey);

/** 서버가 응답하지 않을 때 화면이 계속 '불러오는 중' 으로 남지 않도록 하는 제한 시간 */
const REQUEST_TIMEOUT_MS = 15000;

const fetchWithTimeout: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export const supabase: SupabaseClient | null = hasSupabaseConfig
  ? createClient(url as string, anonKey as string, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // 웹에서만 URL 의 인증 파라미터를 읽습니다.
        detectSessionInUrl: Platform.OS === 'web',
      },
      global: { fetch: fetchWithTimeout },
    })
  : null;

/** Supabase 모드에서만 호출되는 코드에서 사용. 설정이 없으면 즉시 오류를 던집니다. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase 설정이 없습니다. .env 파일의 EXPO_PUBLIC_SUPABASE_* 값을 확인해 주세요.');
  }
  return supabase;
}
