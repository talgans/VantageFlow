import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Card } from '../components/ui/Card';
import {
  Bell,
  CheckCircle,
  FolderKanban,
  Award,
  ChevronRight,
  Sparkles,
} from 'lucide-react-native';

interface InAppNotification {
  id: string;
  title: string;
  message: string;
  projectId?: string;
  type: 'assignment' | 'achievement' | 'project';
  time: string;
  read: boolean;
}

export default function NotificationModal() {
  const [notifications, setNotifications] = useState<InAppNotification[]>([
    {
      id: 'n1',
      title: 'New Responsibility Assigned',
      message: 'You were assigned to "Configure Student Registration Engine"',
      projectId: 'proj-1',
      type: 'assignment',
      time: '10m ago',
      read: false,
    },
    {
      id: 'n2',
      title: 'Achievement Unlocked!',
      message: 'You earned 50 points for Phase 1 Foundation sign-off',
      type: 'achievement',
      time: '2h ago',
      read: false,
    },
    {
      id: 'n3',
      title: 'Project Update',
      message: 'Phase 2 ERP Integration status moved to 50%',
      projectId: 'proj-1',
      type: 'project',
      time: '1d ago',
      read: true,
    },
  ]);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotificationPress = (item: InAppNotification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
    if (item.projectId) {
      router.dismiss();
      router.push(`/project/${item.projectId}`);
    }
  };

  const getIcon = (type: InAppNotification['type']) => {
    switch (type) {
      case 'assignment':
        return <CheckCircle size={18} color={colors.primary} />;
      case 'achievement':
        return <Award size={18} color={colors.warning} />;
      case 'project':
      default:
        return <FolderKanban size={18} color={colors.secondary} />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={markAllAsRead}>
          <Text style={styles.markAllText}>Mark all as read</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {notifications.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => handleNotificationPress(item)}
            activeOpacity={0.7}
          >
            <Card
              style={[
                styles.notificationCard,
                !item.read && styles.notificationUnread,
              ]}
            >
              <View style={styles.iconWrap}>{getIcon(item.type)}</View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemTime}>{item.time}</Text>
                </View>
                <Text style={styles.itemMsg}>{item.message}</Text>
              </View>
              {item.projectId && (
                <ChevronRight size={16} color={colors.textMuted} style={{ marginLeft: 6 }} />
              )}
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.text,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  markAllText: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  list: {
    gap: spacing.md,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
  },
  notificationUnread: {
    borderColor: 'rgba(56, 189, 248, 0.4)',
    backgroundColor: 'rgba(56, 189, 248, 0.05)',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    color: colors.text,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  itemTime: {
    color: colors.textMuted,
    fontSize: 10,
  },
  itemMsg: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginTop: 2,
    lineHeight: 16,
  },
});
