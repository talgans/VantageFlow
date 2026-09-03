import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Project, TaskStatus, UserRole } from '../../types';
import { subscribeToUserProjects } from '../../services/firestoreService';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { Users, Activity, Flame, CheckCircle, Clock } from 'lucide-react-native';

export default function ActivityScreen() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToUserProjects(
      user.uid,
      user.role === UserRole.Admin,
      (updated) => setProjects(updated)
    );
    return () => unsubscribe();
  }, [user]);

  // Aggregate assignee workloads
  const memberWorkloadMap = new Map<string, { name: string; email: string; assigned: number; done: number; atRisk: number }>();

  projects.forEach((proj) => {
    proj.phases.forEach((phase) => {
      phase.tasks.forEach((task) => {
        const assignees = task.assignees || [];
        assignees.forEach((mem) => {
          const key = mem.uid || mem.email;
          if (!memberWorkloadMap.has(key)) {
            memberWorkloadMap.set(key, {
              name: mem.displayName || mem.email,
              email: mem.email,
              assigned: 0,
              done: 0,
              atRisk: 0,
            });
          }
          const item = memberWorkloadMap.get(key)!;
          item.assigned++;
          if (task.status === TaskStatus.Hundred) item.done++;
          if (task.status === TaskStatus.AtRisk) item.atRisk++;
        });
      });
    });
  });

  const memberList = Array.from(memberWorkloadMap.values());

  // Overdue or At Risk tasks
  const atRiskTasks: { taskName: string; projName: string; status: TaskStatus; priority?: any }[] = [];
  projects.forEach((proj) => {
    proj.phases.forEach((phase) => {
      phase.tasks.forEach((task) => {
        if (task.status === TaskStatus.AtRisk) {
          atRiskTasks.push({
            taskName: task.name,
            projName: proj.name,
            status: task.status,
            priority: task.priority,
          });
        }
      });
    });
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Velocity / Activity Summary Banner */}
      <Card style={styles.bannerCard}>
        <View style={styles.bannerHeader}>
          <Flame size={20} color={colors.warning} />
          <Text style={styles.bannerTitle}>Team Execution Velocity</Text>
        </View>
        <View style={styles.velocityGrid}>
          <View style={styles.vItem}>
            <Text style={styles.vNum}>{memberList.length}</Text>
            <Text style={styles.vLabel}>Active Leads</Text>
          </View>
          <View style={styles.vDivider} />
          <View style={styles.vItem}>
            <Text style={[styles.vNum, { color: colors.success }]}>
              {memberList.reduce((acc, m) => acc + m.done, 0)}
            </Text>
            <Text style={styles.vLabel}>Tasks Shipped</Text>
          </View>
          <View style={styles.vDivider} />
          <View style={styles.vItem}>
            <Text style={[styles.vNum, { color: colors.danger }]}>
              {atRiskTasks.length}
            </Text>
            <Text style={styles.vLabel}>Attention Needed</Text>
          </View>
        </View>
      </Card>

      {/* Member Workload Distribution */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Member Workload Distribution</Text>
        <View style={{ gap: spacing.md }}>
          {memberList.map((mem) => {
            const pct = mem.assigned > 0 ? Math.round((mem.done / mem.assigned) * 100) : 0;
            return (
              <Card key={mem.email} style={styles.memberCard}>
                <View style={styles.memberTop}>
                  <View style={styles.avatarPill}>
                    <Text style={styles.avatarText}>
                      {mem.name.substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.memberName}>{mem.name}</Text>
                    <Text style={styles.memberEmail}>{mem.email}</Text>
                  </View>
                  <Text style={styles.memberStatsText}>
                    {mem.done}/{mem.assigned} tasks
                  </Text>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressBar,
                      { width: `${pct}%`, backgroundColor: pct === 100 ? colors.success : colors.primary },
                    ]}
                  />
                </View>
              </Card>
            );
          })}
        </View>
      </View>

      {/* Immediate Bottlenecks & At Risk Tasks */}
      {atRiskTasks.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.danger }]}>
            Critical Bottlenecks ({atRiskTasks.length})
          </Text>
          <View style={{ gap: spacing.sm }}>
            {atRiskTasks.map((t, idx) => (
              <Card key={idx} style={styles.riskCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.riskTaskName}>{t.taskName}</Text>
                  <Text style={styles.riskProjName}>{t.projName}</Text>
                </View>
                <StatusBadge status={t.status} size="sm" />
              </Card>
            ))}
          </View>
        </View>
      )}

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
  bannerCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.card,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  bannerTitle: {
    color: colors.text,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  velocityGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.xs,
  },
  vItem: {
    alignItems: 'center',
  },
  vNum: {
    color: colors.text,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.heavy,
  },
  vLabel: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  vDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  memberCard: {
    padding: spacing.md,
  },
  memberTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  memberName: {
    color: colors.text,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  memberEmail: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
  },
  memberStatsText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.inputBg,
    overflow: 'hidden',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
  },
  riskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
  },
  riskTaskName: {
    color: colors.text,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: 2,
  },
  riskProjName: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
  },
});
