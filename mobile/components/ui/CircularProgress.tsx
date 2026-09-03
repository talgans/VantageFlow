import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, typography } from '../../constants/theme';

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  showText?: boolean;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  percentage,
  size = 48,
  strokeWidth = 4,
  showText = true,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  const strokeDashoffset = circumference - (circumference * clampedPercentage) / 100;

  const getColor = () => {
    if (clampedPercentage >= 100) return colors.success;
    if (clampedPercentage >= 75) return colors.secondary;
    if (clampedPercentage >= 50) return colors.info;
    if (clampedPercentage >= 25) return colors.primary;
    return colors.textMuted;
  };

  const progressColor = getColor();

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Animated Progress Ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {showText && (
        <View style={styles.textContainer}>
          <Text style={[styles.percentageText, { fontSize: size > 40 ? 11 : 9 }]}>
            {Math.round(clampedPercentage)}%
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  textContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageText: {
    color: colors.text,
    fontWeight: typography.weights.bold,
  },
});
