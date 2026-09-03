import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Project, Phase, Task, TaskStatus, TaskPriority } from '../../types';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { StatusBadge } from '../ui/StatusBadge';
import { PriorityBadge } from '../ui/PriorityBadge';
import { AlertCircle, CheckCircle2, ChevronRight, Clock } from 'lucide-react-native';

interface MilestoneTimelineProps {
  project: Project;
  onSelectTask: (task: Task) => void;
}

export const MilestoneTimeline: React.FC<MilestoneTimelineProps> = ({
  project,
  onSelectTask,
}) => {
  return (
    <View style={styles.container}>
      {project.phases.map((phase, pIndex) => {
        // Calculate phase progress
        const totalTasks = phase.tasks.length;
        const completedTasks = phase.tasks.filter(
          (t) => t.status === TaskStatus.Hundred
        ).length;
        const hasAtRisk = phase.tasks.some((t) => t.status === TaskStatus.AtRisk);
        const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        return (
          <View key={phase.id} style={styles.phaseBlock}>
            {/* Phase Milestone Marker */}
            <View style={styles.phaseHeaderRow}>
              <View style={styles.timelineTrack}>
                <View
                  style={[
                    styles.milestoneNode,
                    percent === 100
                      ? styles.milestoneComplete
                      : hasAtRisk
                      ? styles.milestoneRisk
                      : styles.milestoneActive,
                  ]}
                >
                  {percent === 100 ? (
                    <CheckCircle2 size={16} color={colors.background} />
                  ) : hasAtRisk ? (
                    <AlertCircle size={16} color={colors.background} />
                  ) : (
                    <Text style={styles.milestoneNumber}>{pIndex + 1}</Text>
                  )}
                </View>
                {pIndex < project.phases.length - 1 && <View style={styles.timelineStem} />}
              </View>

              <View style={styles.phaseInfo}>
                <View style={styles.phaseTitleRow}>
                  <Text style={styles.phaseName}>{phase.name}</Text>
                  <Text style={styles.phasePercent}>{percent}%</Text>
                </View>
                <View style={styles.weekBadge}>
                  <Clock size={12} color={colors.primary} />
                  <Text style={styles.weekText}>{phase.weekRange}</Text>
                </View>

                {/* Tasks inside this phase */}
                <View style={styles.taskList}>
                  {phase.tasks.map((task) => {
                    const isAtRisk = task.status === TaskStatus.AtRisk;
                    const isComplete = task.status === TaskStatus.Hundred;

                    return (
                      <TouchableOpacity
                        key={task.id}
                        style={[
                          styles.taskCard,
                          isAtRisk && styles.taskCardRisk,
                          isComplete && styles.taskCardComplete,
                        ]}
                        onPress={() => onSelectTask(task)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.taskTop}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text
                              style={[
                                styles.taskName,
                                isComplete && styles.taskNameComplete,
                              ]}
                              numberOfLines={2}
                            >
                              {task.name}
                            </Text>
                          </View>
                          <ChevronRight size={16} color={colors.textMuted} />
                        </View>

                        <View style={styles.taskMetaRow}>
                          <StatusBadge status={task.status} size="sm" />
                          {task.priority && (
                            <PriorityBadge priority={task.priority} showText={false} />
                          )}
                          <Text style={styles.taskDate}>
                            {new Date(task.startDate).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
  },
  phaseBlock: {
    marginBottom: spacing.xl,
  },
  phaseHeaderRow: {
    flexDirection: 'row',
  },
  timelineTrack: {
    alignItems: 'center',
    width: 32,
    marginRight: spacing.md,
  },
  milestoneNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  milestoneActive: {
    backgroundColor: colors.primary,
  },
  milestoneComplete: {
    backgroundColor: colors.success,
  },
  milestoneRisk: {
    backgroundColor: colors.danger,
  },
  milestoneNumber: {
    color: colors.background,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  timelineStem: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginTop: 4,
  },
  phaseInfo: {
    flex: 1,
  },
  phaseTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phaseName: {
    color: colors.text,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    flex: 1,
  },
  phasePercent: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    marginLeft: 8,
  },
  weekBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  weekText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
  },
  taskList: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  taskCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taskCardRisk: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  taskCardComplete: {
    opacity: 0.85,
  },
  taskTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  taskName: {
    color: colors.text,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  taskNameComplete: {
    color: colors.textSecondary,
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskDate: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    marginLeft: 'auto',
  },
});
