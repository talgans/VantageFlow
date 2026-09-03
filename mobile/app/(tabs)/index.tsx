import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Project, TaskStatus, UserRole } from '../../types';
import { subscribeToUserProjects } from '../../services/firestoreService';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { CircularProgress } from '../../components/ui/CircularProgress';
import { ProjectStatusChart } from '../../components/charts/ProjectStatusChart';
import {
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  Users,
  ChevronRight,
  TrendingUp,
} from 'lucide-react-native';

export default function DashboardScreen() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToUserProjects(
      user.uid,
      user.role === UserRole.Admin,
      (updatedProjects) => {
        setProjects(updatedProjects);
      }
    );
    return () => unsubscribe();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  // Aggregated Stats
  let totalTasks = 0;
  let completedTasks = 0;
  let atRiskTasks = 0;

  projects.forEach((p) => {
    p.phases.forEach((ph) => {
      ph.tasks.forEach((t) => {
        totalTasks++;
        if (t.status === TaskStatus.Hundred) completedTasks++;
        if (t.status === TaskStatus.AtRisk) atRiskTasks++;
      });
    });
  });

  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* User Greeting & Role Banner */}
      <View style={styles.greetingBanner}>
        <View>
          <Text style={styles.greetingSub}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.displayName || 'Team Member'}</Text>
        </View>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.role || 'Member'}</Text>
        </View>
      </View>

      {/* KPI Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
            <FolderKanban size={18} color={colors.primary} />
          </View>
          <Text style={styles.statValue}>{projects.length}</Text>
          <Text style={styles.statLabel}>Projects</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <CheckCircle2 size={18} color={colors.success} />
          </View>
          <Text style={styles.statValue}>{overallProgress}%</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <AlertTriangle size={18} color={colors.danger} />
          </View>
          <Text style={styles.statValue}>{atRiskTasks}</Text>
          <Text style={styles.statLabel}>At Risk</Text>
        </View>
      </View>

      {/* Interactive Donut Chart */}
      <ProjectStatusChart projects={projects} />

      {/* Active Projects Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Active Projects</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/projects')}>
          <Text style={styles.seeAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      {/* Projects List */}
      <View style={styles.projectsWrap}>
        {projects.map((proj) => {
          // Calculate project progress
          let pTotal = 0;
          let pDone = 0;
          proj.phases.forEach((ph) => {
            ph.tasks.forEach((t) => {
              pTotal++;
              if (t.status === TaskStatus.Hundred) pDone++;
            });
          });
          const pPercent = pTotal > 0 ? Math.round((pDone / pTotal) * 100) : 0;

          return (
            <Card
              key={proj.id}
              style={styles.projectCard}
              onPress={() => router.push(`/project/${proj.id}`)}
            >
              <View style={styles.projectCardHeader}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.projectName} numberOfLines={1}>
                    {proj.name}
                  </Text>
                  <Text style={styles.projectCore} numberOfLines={1}>
                    {proj.coreSystem}
                  </Text>
                </View>
                <CircularProgress percentage={pPercent} size={44} strokeWidth={3.5} />
              </View>

              <View style={styles.projectFooter}>
                <View style={styles.teamInfo}>
                  <Users size={14} color={colors.textSecondary} />
                  <Text style={styles.teamCount}>
                    {proj.team.members.length} members
                  </Text>
                </View>
                <View style={styles.actionPrompt}>
                  <Text style={styles.actionPromptText}>Details</Text>
                  <ChevronRight size={14} color={colors.primary} />
                </View>
              </View>
            </Card>
          );
        })}
      </View>

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
  greetingBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greetingSub: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
  },
  userName: {
    color: colors.text,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  roleBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  roleText: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statValue: {
    color: colors.text,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  seeAllText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  projectsWrap: {
    gap: spacing.md,
  },
  projectCard: {
    padding: spacing.md,
  },
  projectCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  projectName: {
    color: colors.text,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    marginBottom: 2,
  },
  projectCore: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
  },
  projectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamCount: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
  },
  actionPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionPromptText: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
});
