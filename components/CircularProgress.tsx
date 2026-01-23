import React from 'react';

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  showText?: boolean;
}

const CircularProgress: React.FC<CircularProgressProps> = ({ percentage, size = 60, strokeWidth = 6, showText = true }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  // Color based on percentage
  const getColor = () => {
    if (percentage >= 80) return '#10b981'; // green
    if (percentage >= 50) return '#3b82f6'; // blue
    if (percentage >= 30) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#334155"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {/* Percentage text */}
      {showText && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-white">{Math.round(percentage)}%</span>
        </div>
      )}
    </div>
  );
};

export default CircularProgress;
