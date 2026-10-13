import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { AppUser, Role } from '@/lib/data/types';
import { hasSupabaseConfig, supabase } from '@/lib/supabase';

const STORAGE_KEY = 'church-app/local-user';

/** Supabase 가 돌려주는 영어 오류를 알아보기 쉬운 말로 바꿔 줍니다. */
function translateAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return '이메일 또는 비밀번호가 맞지 않습니다.';
  if (/email not confirmed/i.test(message)) return '가입 확인 메일의 링크를 먼저 눌러 주세요.';
  if (/user already registered/i.test(message)) return '이미 가입된 이메일입니다. 로그인해 주세요.';
  if (/password should be at least/i.test(message)) return '비밀번호는 6자 이상이어야 합니다.';
  if (/unable to validate email/i.test(message)) return '이메일 주소를 다시 확인해 주세요.';
  if (/rate limit|too many/i.test(message)) return '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.';
  return message;
}

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  /** 이번 실행에서 '손님으로 둘러보기'를 선택했는지 (저장하지 않아 앱을 다시 열면 초기화됩니다). */
  guestAck: boolean;
  /** 손님으로 둘러보기를 선택합니다(이번 세션에만 유지). */
  chooseGuest: () => Promise<void>;
  /** 샘플 모드: 이름과 역할만으로 로그인. Supabase 모드: 이메일/비밀번호 로그인. */
  signIn: (params: { name?: string; role?: Role; email?: string; password?: string }) => Promise<void>;
  /** 가입 결과. 확인 메일을 눌러야 하는 경우 needsEmailConfirmation 이 true 입니다. */
  signUp: (params: {
    name: string;
    email: string;
    password: string;
  }) => Promise<{ needsEmailConfirmation: boolean }>;
  /** 내 프로필(이름·생년월일·직분·소속) 수정. */
  updateProfile: (patch: Partial<Pick<AppUser, 'name' | 'birthDate' | 'birthCalendar' | 'position' | 'affiliation'>>) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadSupabaseUser(): Promise<AppUser | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  const authUser = data.user;
  if (!authUser) return null;

  // 역할·프로필 항목은 profiles 테이블에서 읽습니다. 행이 없으면 일반 성도로 처리합니다.
  // 선택 항목(생년월일·직분·소속) 마이그레이션 전이라도 로그인이 깨지지 않도록,
  // 확장 컬럼 조회가 실패하면 기본 컬럼만 다시 읽습니다.
  const ext = await supabase
    .from('profiles')
    .select('name, role, birth_date, birth_calendar, position, affiliation')
    .eq('id', authUser.id)
    .maybeSingle();
  let profile = ext.data as Record<string, string | null> | null;
  if (ext.error) {
    const base = await supabase.from('profiles').select('name, role').eq('id', authUser.id).maybeSingle();
    profile = base.data as Record<string, string | null> | null;
  }

  return {
    id: authUser.id,
    email: authUser.email ?? undefined,
    name: profile?.name ?? authUser.email?.split('@')[0] ?? '성도',
    role: (profile?.role as Role) ?? 'member',
    birthDate: profile?.birth_date ?? undefined,
    birthCalendar: (profile?.birth_calendar as AppUser['birthCalendar']) ?? undefined,
    position: profile?.position ?? undefined,
    affiliation: profile?.affiliation ?? undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  // 저장하지 않는 세션 값 — 앱을 새로 열면 false 로 시작해 표어 시작 화면이 다시 뜹니다.
  const [guestAck, setGuestAck] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        if (hasSupabaseConfig && supabase) {
          const current = await loadSupabaseUser();
          if (active) setUser(current);
        } else {
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (active && stored) setUser(JSON.parse(stored) as AppUser);
        }
      } catch {
        // 로그인 정보를 못 읽어도 앱은 비로그인 상태로 계속 동작합니다.
      } finally {
        if (active) setLoading(false);
      }
    })();

    const subscription = supabase?.auth.onAuthStateChange(() => {
      loadSupabaseUser().then((next) => {
        if (active) setUser(next);
      });
    });

    return () => {
      active = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback<AuthContextValue['signIn']>(async ({ name, role, email, password }) => {
    if (hasSupabaseConfig && supabase) {
      if (!email || !password) throw new Error('이메일과 비밀번호를 입력해 주세요.');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(translateAuthError(error.message));
      setUser(await loadSupabaseUser());
      return;
    }

    const localUser: AppUser = {
      id: `local-${Date.now()}`,
      name: name?.trim() || '성도',
      role: role ?? 'member',
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(localUser));
    setUser(localUser);
  }, []);

  const signUp = useCallback<AuthContextValue['signUp']>(async ({ name, email, password }) => {
    if (!hasSupabaseConfig || !supabase) {
      throw new Error('샘플 모드에서는 가입 없이 바로 시작할 수 있습니다.');
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw new Error(translateAuthError(error.message));

    // 확인 메일을 켜 둔 경우에는 아직 로그인 상태가 아닙니다.
    if (!data.session) {
      return { needsEmailConfirmation: true };
    }

    await supabase.from('profiles').upsert({ id: data.user!.id, name, role: 'member' });
    setUser(await loadSupabaseUser());
    return { needsEmailConfirmation: false };
  }, []);

  const chooseGuest = useCallback(async () => {
    setGuestAck(true);
  }, []);

  const updateProfile = useCallback<AuthContextValue['updateProfile']>(async (patch) => {
    if (hasSupabaseConfig && supabase) {
      const { data: auth } = await supabase.auth.getUser();
      const id = auth.user?.id;
      if (!id) throw new Error('로그인이 필요합니다.');
      // camelCase → DB 컬럼(snake_case) 로 변환. undefined 항목은 보내지 않습니다.
      const row: Record<string, string> = { id };
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.birthDate !== undefined) row.birth_date = patch.birthDate;
      if (patch.birthCalendar !== undefined) row.birth_calendar = patch.birthCalendar;
      if (patch.position !== undefined) row.position = patch.position;
      if (patch.affiliation !== undefined) row.affiliation = patch.affiliation;
      const { error } = await supabase.from('profiles').upsert(row);
      if (error) throw new Error(error.message);
      setUser(await loadSupabaseUser());
      return;
    }
    // 샘플 모드: 로컬 저장 사용자에 병합합니다.
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const signOut = useCallback(async () => {
    if (hasSupabaseConfig && supabase) {
      await supabase.auth.signOut();
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
    // 로그아웃하면 손님 선택도 초기화해 시작 화면이 다시 뜨게 합니다.
    setGuestAck(false);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, isAdmin: user?.role === 'admin', guestAck, chooseGuest, signIn, signUp, updateProfile, signOut }),
    [user, loading, guestAck, chooseGuest, signIn, signUp, updateProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth 는 AuthProvider 안에서만 사용할 수 있습니다.');
  return context;
}
