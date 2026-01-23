
import React from 'react';
import { TaskStatus } from '../types';

interface StatusBadgeProps {
  status: TaskStatus | string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getConfig = (s: string) => {
    switch (s) {
      case TaskStatus.Hundred:
      case 'Completed':
        return { bgColor: 'bg-green-500/10', textColor: 'text-green-400', dotColor: 'bg-green-400' };
      case TaskStatus.SeventyFive:
        return { bgColor: 'bg-indigo-500/10', textColor: 'text-indigo-400', dotColor: 'bg-indigo-400' };
      case TaskStatus.Fifty:
      case 'In Progress':
        return { bgColor: 'bg-blue-500/10', textColor: 'text-blue-400', dotColor: 'bg-blue-400' };
      case TaskStatus.TwentyFive:
        return { bgColor: 'bg-amber-500/10', textColor: 'text-amber-400', dotColor: 'bg-amber-400' };
      case TaskStatus.AtRisk:
        return { bgColor: 'bg-red-500/10', textColor: 'text-red-400', dotColor: 'bg-red-400' };
      case TaskStatus.Zero:
      case 'Not Started':
      default:
        return { bgColor: 'bg-gray-500/10', textColor: 'text-gray-400', dotColor: 'bg-gray-400' };
    }
  };

  const { bgColor, textColor, dotColor } = getConfig(status);

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
