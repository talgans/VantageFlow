import React from 'react';
import { TaskPriority } from '../../types';

interface PriorityDonutProps {
  critical: number;
  important: number;
  enhancement: number;
  total: number;
  activePriorities?: TaskPriority[];
  onTogglePriority?: (priority: TaskPriority) => void;
  size?: number;
  strokeWidth?: number;
  showLegend?: boolean;
}

const PriorityDonut: React.FC<PriorityDonutProps> = ({
  critical,
  important,
  enhancement,
  total,
  activePriorities = [],
  onTogglePriority,
  size = 58,
  strokeWidth = 6.5,
  showLegend = true,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const critPct = total > 0 ? Math.round((critical / total) * 100) : 0;
  const impPct = total > 0 ? Math.round((important / total) * 100) : 0;
  const enhPct = total > 0 ? Math.round((enhancement / total) * 100) : 0;

  const critLen = total > 0 ? (critical / total) * circumference : 0;
  const impLen = total > 0 ? (important / total) * circumference : 0;
  const enhLen = total > 0 ? (enhancement / total) * circumference : 0;

  const critOffset = 0;
  const impOffset = critLen;
  const enhOffset = critLen + impLen;

  return (
    <div className="flex items-center gap-2.5">
      {/* Donut Chart SVG */}
      <div className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Base track circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#334155"
            strokeWidth={strokeWidth}
          />

          {total > 0 && (
            <>
              {/* Critical Segment (Red) */}
              {critical > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${critLen} ${circumference - critLen}`}
                  strokeDashoffset={-critOffset}
                  className="transition-all duration-500 ease-out hover:opacity-80 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePriority?.(TaskPriority.Critical);
                  }}
                >
                  <title>{`Critical: ${critical} tasks (${critPct}%)`}</title>
                </circle>
              )}

              {/* Important Segment (Amber) */}
              {important > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${impLen} ${circumference - impLen}`}
                  strokeDashoffset={-impOffset}
                  className="transition-all duration-500 ease-out hover:opacity-80 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePriority?.(TaskPriority.Important);
                  }}
                >
                  <title>{`Important: ${important} tasks (${impPct}%)`}</title>
                </circle>
              )}

              {/* Enhancement Segment (Blue) */}
              {enhancement > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${enhLen} ${circumference - enhLen}`}
                  strokeDashoffset={-enhOffset}
                  className="transition-all duration-500 ease-out hover:opacity-80 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePriority?.(TaskPriority.Enhancement);
                  }}
                >
                  <title>{`Enhancement: ${enhancement} tasks (${enhPct}%)`}</title>
                </circle>
              )}
            </>
          )}
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] font-bold text-white leading-none">{total}</span>
          <span className="text-[7.5px] text-slate-400 font-medium uppercase tracking-tight scale-90">Tasks</span>
        </div>
      </div>

      {/* Mini Legend & Interactive Filter Buttons */}
      {showLegend && (
        <div className="flex flex-col justify-center gap-0.5 text-[10px]">
          {/* Critical */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePriority?.(TaskPriority.Critical);
            }}
            className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all text-left cursor-pointer ${
              activePriorities.includes(TaskPriority.Critical)
                ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/50'
                : 'hover:bg-slate-700/50 text-slate-300'
            }`}
            title={`Critical: ${critical} tasks (${critPct}%). Click to filter.`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
            <span className="text-[10px] font-medium">Critical</span>
            <span className="text-[10px] text-red-400 font-bold ml-auto pl-1.5">{critical}</span>
          </button>

          {/* Important */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePriority?.(TaskPriority.Important);
            }}
            className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all text-left cursor-pointer ${
              activePriorities.includes(TaskPriority.Important)
                ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50'
                : 'hover:bg-slate-700/50 text-slate-300'
            }`}
            title={`Important: ${important} tasks (${impPct}%). Click to filter.`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
            <span className="text-[10px] font-medium">Important</span>
            <span className="text-[10px] text-amber-400 font-bold ml-auto pl-1.5">{important}</span>
          </button>

          {/* Enhancement */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePriority?.(TaskPriority.Enhancement);
            }}
            className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all text-left cursor-pointer ${
              activePriorities.includes(TaskPriority.Enhancement)
                ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/50'
                : 'hover:bg-slate-700/50 text-slate-300'
            }`}
            title={`Enhancement: ${enhancement} tasks (${enhPct}%). Click to filter.`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
            <span className="text-[10px] font-medium">Enhance</span>
            <span className="text-[10px] text-blue-400 font-bold ml-auto pl-1.5">{enhancement}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default PriorityDonut;
