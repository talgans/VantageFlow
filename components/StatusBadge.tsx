
import React from 'react';
import { TaskStatus } from '../types';

interface StatusBadgeProps {
  status: TaskStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const statusConfig = {
    [TaskStatus.Completed]: {
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-400',
      dotColor: 'bg-green-400',
    },
    [TaskStatus.InProgress]: {
      bgColor: 'bg-yellow-500/10',
      textColor: 'text-yellow-400',
      dotColor: 'bg-yellow-400',
    },
    [TaskStatus.NotStarted]: {
      bgColor: 'bg-gray-500/10',
      textColor: 'text-gray-400',
      dotColor: 'bg-gray-400',
    },
    [TaskStatus.AtRisk]: {
      bgColor: 'bg-red-500/10',
      textColor: 'text-red-400',
      dotColor: 'bg-red-400',
    },
  };

  const { bgColor, textColor, dotColor } = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor}`}
    >
      <span className={`w-2 h-2 mr-1.5 rounded-full ${dotColor}`}></span>
      {status}
    </span>
  );
};

export default StatusBadge;
