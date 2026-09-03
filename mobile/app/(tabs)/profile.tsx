import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import {
  User as UserIcon,
  Award,
  Star,
  LogOut,
  Shield,
  CheckCircle,
  Sparkles,
} from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, signOut, signInAsDemo } = useAuth();

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const dummyAchievements = [
    {
      id: 'a1',
      title: 'Foundation Master',
      pts: 50,
      desc: 'Completed all Phase 1 Foundation deliverables on schedule',
      date: 'Aug 24, 2024',
    },
    {
      id: 'a2',
      title: 'ERP Integration Lead',
      pts: 75,
      desc: 'Successfully connected core Admissions module',
      date: 'Aug 29, 2024',
    },
    {
      id: 'a3',
      title: 'Critical Risk Resolver',
      pts: 100,
      desc: 'Mitigated at-risk SMS/Email notification delays',
      date: 'Sep 02, 2024',
    },
  ];

  const totalPoints = dummyAchievements.reduce((acc, a) => acc + a.pts, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header Card */}
      <Card style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.displayName
              ? user.displayName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
              : 'VF'}
          </Text>
        </View>
        <Text style={styles.name}>{user?.displayName || 'Mohammed Mahmud'}</Text>
        <Text style={styles.email}>{user?.email || 'mohammed@vantageflow.app'}</Text>
        <View style={styles.roleBadge}>
          <Shield size={13} color={colors.primary} />
          <Text style={styles.roleText}>{user?.role || UserRole.Admin}</Text>
        </View>
      </Card>

      {/* Gamification Points & Star Rating */}
      <Card style={styles.pointsCard}>
        <View style={styles.pointsHeader}>
          <Sparkles size={20} color={colors.warning} />
          <Text style={styles.pointsTitle}>Performance Points & Rating</Text>
        </View>
        <View style={styles.pointsRow}>
          <View>
            <Text style={styles.ptsValue}>{totalPoints}</Text>
            <Text style={styles.ptsSub}>Total Points Earned</Text>
          </View>
          {/* 5-Star Rating */}
          <View style={styles.starsWrap}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={18}
                color={star <= 4 ? colors.warning : colors.border}
                fill={star <= 4 ? colors.warning : 'transparent'}
              />
            ))}
            <Text style={styles.starText}>Level 4 Lead</Text>
          </View>
        </View>
      </Card>

      {/* Achievements List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Achievements</Text>
        <View style={{ gap: spacing.sm }}>
          {dummyAchievements.map((ach) => (
            <Card key={ach.id} style={styles.achievementCard}>
              <View style={styles.achIcon}>
                <Award size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.achTitleRow}>
                  <Text style={styles.achTitle}>{ach.title}</Text>
                  <Text style={styles.achPts}>+{ach.pts} pts</Text>
                </View>
                <Text style={styles.achDesc}>{ach.desc}</Text>
                <Text style={styles.achDate}>{ach.date}</Text>
              </View>
            </Card>
          ))}
        </View>
      </View>

      {/* Switch Role Quick Tester */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preview As Role (Tester)</Text>
        <View style={styles.roleBtnRow}>
          <TouchableOpacity
            style={styles.roleOptionBtn}
            onPress={() => signInAsDemo(UserRole.Admin)}
          >
            <Text style={styles.roleOptionText}>Admin</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.roleOptionBtn}
            onPress={() => signInAsDemo(UserRole.Manager)}
          >
            <Text style={styles.roleOptionText}>Manager</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.roleOptionBtn}
            onPress={() => signInAsDemo(UserRole.Member)}
          >
            <Text style={styles.roleOptionText}>Member</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={handleSignOut}
        activeOpacity={0.8}
      >
        <LogOut size={18} color={colors.danger} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    color: colors.primary,
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
  },
  name: {
    color: colors.text,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  email: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  roleText: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  pointsCard: {
    marginBottom: spacing.lg,
  },
  pointsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  pointsTitle: {
    color: colors.text,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ptsValue: {
    color: colors.warning,
    fontSize: typography.sizes.title,
    fontWeight: typography.weights.heavy,
  },
  ptsSub: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  starsWrap: {
    alignItems: 'flex-end',
    gap: 4,
  },
  starText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  achIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  achTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  achTitle: {
    color: colors.text,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  achPts: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  achDesc: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  achDate: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  roleBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleOptionBtn: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleOptionText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginTop: spacing.sm,
  },
  signOutText: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
});
