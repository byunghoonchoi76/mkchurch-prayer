import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { repository, type DirectoryUser } from '@/lib/data';

/**
 * 앱에 등록된 성도를 이름으로 검색해 고르는 입력.
 * (리더 지정·멤버 초대에 함께 씁니다. 관리자·리더만 검색됩니다.)
 */
export function UserPicker({
  placeholder = '이름으로 검색',
  excludeIds = [],
  onPick,
}: {
  placeholder?: string;
  excludeIds?: string[];
  onPick: (user: DirectoryUser) => void;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) {
      setResults([]);
      setSearched(false);
      return;
    }
    let active = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const found = await repository.searchUsers(q);
        if (!active) return;
        setResults(found.filter((u) => !excludeIds.includes(u.id)));
        setError(undefined);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : '검색하지 못했습니다.');
      } finally {
        if (active) {
          setLoading(false);
          setSearched(true);
        }
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, excludeIds.join(',')]);

  return (
    <View style={styles.wrap}>
      <View style={[styles.inputRow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Ionicons name="search" size={16} color={theme.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { color: theme.text }]}
          autoCapitalize="none"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={theme.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <ThemedText type="caption" themeColor="danger" style={styles.msg}>
          {error}
        </ThemedText>
      ) : loading ? (
        <ThemedText type="caption" themeColor="textMuted" style={styles.msg}>
          검색 중…
        </ThemedText>
      ) : searched && results.length === 0 ? (
        <ThemedText type="caption" themeColor="textMuted" style={styles.msg}>
          검색 결과가 없습니다.
        </ThemedText>
      ) : results.length > 0 ? (
        <View style={[styles.results, { borderColor: theme.border, backgroundColor: theme.card }]}>
          {results.map((u, i) => (
            <Pressable
              key={u.id}
              onPress={() => {
                onPick(u);
                setQuery('');
                setResults([]);
                setSearched(false);
              }}
              style={({ pressed }) => [
                styles.resultRow,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                pressed && { backgroundColor: theme.backgroundSelected },
              ]}>
              <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
                <Ionicons name="person" size={14} color={theme.textSecondary} />
              </View>
              <ThemedText type="small">{u.name}</ThemedText>
              <Ionicons name="add-circle" size={18} color={theme.primary} style={styles.addIcon} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 2 },
  msg: { paddingHorizontal: Spacing.one },
  results: { borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2 },
  avatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  addIcon: { marginLeft: 'auto' },
});
