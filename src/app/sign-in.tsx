import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChurchLogo } from '@/components/church-logo';
import { ConsentCheck } from '@/components/consent-check';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Field } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { dataMode } from '@/lib/data';
import type { Role } from '@/lib/data/types';

export default function SignInScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { signIn, signUp } = useAuth();
  const isSupabase = dataMode === 'supabase';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>(params.mode === 'signUp' ? 'signUp' : 'signIn');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  const submitLocal = async (role: Role) => {
    setBusy(true);
    setError(undefined);
    try {
      await signIn({ name, role });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그인하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const submitSupabase = async () => {
    if (mode === 'signUp' && !agreed) {
      setError('이용약관 및 개인정보처리방침에 동의해 주세요.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      if (mode === 'signUp') {
        const result = await signUp({ name, email, password });
        if (result.needsEmailConfirmation) {
          // 확인 메일을 켜 둔 경우: 화면을 닫지 않고 안내를 남깁니다.
          setNotice(`${email} 로 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.`);
          setMode('signIn');
          setPassword('');
          return;
        }
      } else {
        await signIn({ email, password });
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그인하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.logoRow}>
        <ChurchLogo size={40} />
      </View>
      {isSupabase ? (
        <Card>
          <ThemedText type="heading">{mode === 'signUp' ? '회원가입' : '로그인'}</ThemedText>
          {mode === 'signUp' ? <Field label="이름" value={name} onChangeText={setName} placeholder="홍길동" /> : null}
          <Field
            label="이메일"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Field label="비밀번호" value={password} onChangeText={setPassword} secureTextEntry />
          {mode === 'signUp' ? <ConsentCheck checked={agreed} onChange={setAgreed} withTerms /> : null}
          {notice ? (
            <ThemedText type="small" themeColor="success">
              {notice}
            </ThemedText>
          ) : null}
          {error ? (
            <ThemedText type="small" themeColor="danger">
              {error}
            </ThemedText>
          ) : null}
          <Button
            label={mode === 'signUp' ? '가입하고 시작하기' : '로그인'}
            loading={busy}
            onPress={() => void submitSupabase()}
          />
          <Button
            label={mode === 'signUp' ? '이미 계정이 있어요' : '계정이 없으신가요? 가입하기'}
            variant="ghost"
            onPress={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}
          />
        </Card>
      ) : (
        <Card>
          <ThemedText type="heading">이름만 입력하면 시작할 수 있어요</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            샘플 모드에서는 계정 없이 체험할 수 있습니다. 관리자 화면을 보려면 &lsquo;관리자로 시작&rsquo; 을 선택하세요.
          </ThemedText>
          <Field label="이름" value={name} onChangeText={setName} placeholder="홍길동" />
          {error ? (
            <ThemedText type="small" themeColor="danger">
              {error}
            </ThemedText>
          ) : null}
          <View style={styles.buttonRow}>
            <Button
              label="성도로 시작"
              style={styles.flex}
              loading={busy}
              onPress={() => void submitLocal('member')}
            />
            <Button
              label="관리자로 시작"
              variant="secondary"
              style={styles.flex}
              loading={busy}
              onPress={() => void submitLocal('admin')}
            />
          </View>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  logoRow: { alignItems: 'center', paddingVertical: Spacing.three },
  buttonRow: { flexDirection: 'row', gap: Spacing.two },
});
