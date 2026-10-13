import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LegalDoc } from '@/constants/legal';

/** 개인정보처리방침·이용약관 등 법적 고지 문서를 공통 형식으로 그립니다. */
export function LegalDocument({ doc }: { doc: LegalDoc }) {
  const theme = useTheme();
  return (
    <Screen>
      <ThemedText type="title">{doc.title}</ThemedText>
      {doc.intro ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
          {doc.intro}
        </ThemedText>
      ) : null}

      {doc.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <ThemedText type="smallBold" themeColor="primary">
            {section.heading}
          </ThemedText>
          {section.blocks.map((block, bi) => {
            if (block.type === 'text') {
              return (
                <ThemedText key={bi} type="small" themeColor="textSecondary" style={styles.body}>
                  {block.text}
                </ThemedText>
              );
            }
            if (block.type === 'list') {
              return (
                <View key={bi} style={styles.list}>
                  {block.items.map((item, ii) => (
                    <View key={ii} style={styles.listRow}>
                      <ThemedText type="small" themeColor="textMuted">
                        ·
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                        {item}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              );
            }
            // defs
            return (
              <Card key={bi} style={styles.defs}>
                {block.items.map((d, di) => (
                  <View key={di} style={styles.defRow}>
                    <ThemedText type="caption" themeColor="textMuted" style={styles.defTerm}>
                      {d.term}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                      {d.desc}
                    </ThemedText>
                  </View>
                ))}
              </Card>
            );
          })}
        </View>
      ))}

      {doc.footer?.length ? (
        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          {doc.footer.map((line, i) => (
            <ThemedText key={i} type="caption" themeColor="textMuted">
              {line}
            </ThemedText>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: { lineHeight: 20 },
  section: { gap: Spacing.two },
  body: { lineHeight: 20 },
  list: { gap: Spacing.one },
  listRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  defs: { gap: Spacing.two },
  defRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  defTerm: { width: 108, fontWeight: '700' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.three, gap: 2, marginTop: Spacing.two },
});
