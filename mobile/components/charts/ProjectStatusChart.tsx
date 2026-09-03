import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { Project, TaskStatus } from '../../types';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';

interface ProjectStatusChartProps {
  projects: Project[];
}

export const ProjectStatusChart: React.FC<ProjectStatusChartProps> = ({ projects }) => {
  // Compute aggregate task statuses across all projects
  let completed = 0;
  let inProgress = 0;
  let atRisk = 0;
  let notStarted = 0;

  projects.forEach((proj) => {
    proj.phases.forEach((phase) => {
      phase.tasks.forEach((task) => {
        if (task.status === TaskStatus.Hundred) completed++;
        else if (task.status === TaskStatus.AtRisk) atRisk++;
        else if (task.status === TaskStatus.Zero) notStarted++;
        else inProgress++;
      });
    });
  });

  const total = completed + inProgress + atRisk + notStarted;

  const pieData = [
    { value: completed || (total === 0 ? 1 : 0), color: colors.success, text: 'Done' },
    { value: inProgress, color: colors.info, text: 'In Progress' },
    { value: atRisk, color: colors.danger, text: 'At Risk' },
    { value: notStarted, color: colors.statusZero, text: 'Not Started' },
  ].filter((d) => d.value > 0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Project Task Health</Text>
      <View style={styles.chartWrapper}>
        <PieChart
          data={pieData}
          donut
          radius={55}
          innerRadius={36}
          innerCircleColor={colors.card}
          centerLabelComponent={() => (
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.centerNumber}>{total}</Text>
              <Text style={styles.centerSub}>Tasks</Text>
            </View>
          )}
        />
        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
            <Text style={styles.legendText}>Done ({completed})</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.info }]} />
            <Text style={styles.legendText}>Active ({inProgress})</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
            <Text style={styles.legendText}>At Risk ({atRisk})</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.statusZero }]} />
            <Text style={styles.legendText}>Pending ({notStarted})</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  chartWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  centerNumber: {
    color: colors.text,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  centerSub: {
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  legend: {
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
  },
});
