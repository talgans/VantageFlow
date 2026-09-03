import React from 'react';
import { Tabs, router } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, FolderKanban, BarChart3, User, Bell } from 'lucide-react-native';
import { colors } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';

export default function TabLayout() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Ensure at least 8px padding on Android even if insets report 0
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 56 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 6,
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '700',
        },
        headerRight: () => (
          <TouchableOpacity
            style={{ marginRight: 16, padding: 4 }}
            onPress={() => router.push('/modal')}
          >
            <Bell size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          headerTitle: 'VantageFlow',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'Projects',
          headerTitle: 'All Projects',
          tabBarIcon: ({ color, size }) => <FolderKanban size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          headerTitle: 'Team Activity & Workload',
          tabBarIcon: ({ color, size }) => <BarChart3 size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerTitle: 'My Profile & Points',
          tabBarIcon: ({ color, size }) => <User size={size - 2} color={color} />,
        }}
      />
    </Tabs>
  );
}
