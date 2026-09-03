import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TaskPriority } from '../../types';
import { colors, typography, borderRadius } from '../../constants/theme';

interface PriorityBadgeProps {
  priority?: TaskPriority;
  showText?: boolean;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority = TaskPriority.Important,
  showText = true,
}) => {
  const getPriorityConfig = () => {
    switch (priority) {
      case TaskPriority.Critical:
        return {
          label: 'Critical',
          dot: colors.priorityCritical,
          bg: 'rgba(239, 68, 68, 0.15)',
          text: colors.priorityCritical,
          border: 'rgba(239, 68, 68, 0.3)',
        };
      case TaskPriority.Important:
        return {
          label: 'Important',
          dot: colors.priorityImportant,
          bg: 'rgba(245, 158, 11, 0.15)',
          text: colors.priorityImportant,
          border: 'rgba(245, 158, 11, 0.3)',
        };
      case TaskPriority.Enhancement:
      default:
        return {
          label: 'Enhancement',
          dot: colors.priorityEnhancement,
          bg: 'rgba(56, 189, 248, 0.15)',
          text: colors.priorityEnhancement,
          border: 'rgba(56, 189, 248, 0.3)',
        };
    }
  };

  const config = getPriorityConfig();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: config.dot }]} />
      {showText && <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
});
