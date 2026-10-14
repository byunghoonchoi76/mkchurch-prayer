import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, type ColorValue } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** 한글 받침까지 온전히 보이도록 탭 라벨을 직접 그립니다. */
function tabLabel(label: string) {
  return ({ color }: { color: ColorValue }) => <Text style={[styles.tabLabel, { color }]}>{label}</Text>;
}

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: [
          { backgroundColor: theme.backgroundElement, borderTopColor: theme.border },
          Platform.OS === 'web' ? { height: 70, paddingTop: 8, paddingBottom: 12 } : null,
        ],
        tabBarLabelStyle: { fontSize: 11, lineHeight: 18 },
        headerStyle: { backgroundColor: theme.backgroundElement },
        headerTitleStyle: { color: theme.text, fontSize: 17, fontWeight: '700' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '기도하기',
          tabBarLabel: tabLabel('기도하기'),
          tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="intercession"
        options={{
          title: '기도제목',
          tabBarLabel: tabLabel('기도제목'),
          tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: '기도 기록',
          tabBarLabel: tabLabel('기도 기록'),
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '설정',
          tabBarLabel: tabLabel('설정'),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabLabel: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
