import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TaskStatus } from '../../types';
import { colors, typography, borderRadius } from '../../constants/theme';

interface StatusBadgeProps {
  status: TaskStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const getStatusConfig = () => {
    switch (status) {
      case TaskStatus.Hundred:
      case '100%':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: colors.success, border: 'rgba(16, 185, 129, 0.3)' };
      case TaskStatus.SeventyFive:
      case '75%':
        return { bg: 'rgba(99, 102, 241, 0.15)', text: colors.secondary, border: 'rgba(99, 102, 241, 0.3)' };
      case TaskStatus.Fifty:
      case '50%':
        return { bg: 'rgba(59, 130, 246, 0.15)', text: colors.info, border: 'rgba(59, 130, 246, 0.3)' };
      case TaskStatus.TwentyFive:
      case '25%':
        return { bg: 'rgba(56, 189, 248, 0.15)', text: colors.primary, border: 'rgba(56, 189, 248, 0.3)' };
      case TaskStatus.AtRisk:
      case 'At Risk':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: colors.danger, border: 'rgba(239, 68, 68, 0.3)' };
      case TaskStatus.Zero:
      case '0%':
      default:
        return { bg: 'rgba(100, 116, 139, 0.15)', text: colors.textMuted, border: 'rgba(100, 116, 139, 0.3)' };
    }
  };

  const config = getStatusConfig();
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          paddingHorizontal: isSmall ? 6 : 10,
          paddingVertical: isSmall ? 2 : 4,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: config.text,
            fontSize: isSmall ? typography.sizes.xs : typography.sizes.sm,
          },
        ]}
      >
        {status}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontWeight: typography.weights.semibold,
  },
});
