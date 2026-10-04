import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Project, Task, TaskStatus, TaskPriority, Phase, DurationUnit, Currency, TeamMember } from '../types';
import StatusBadge from './StatusBadge';
import CircularProgress from './CircularProgress';
import ResponsibilitySelector from './ResponsibilitySelector';
import { notificationService } from '../services/notificationService';
import { achievementService } from '../services/achievementService';
import { getProjectInsights } from '../services/geminiService';
import { uploadTaskImage } from '../services/storageService';
import { ArrowLeftIcon, SparklesIcon, InfoIcon, TeamIcon, CalendarIcon, MoneyIcon, CheckCircleIcon, PlusCircleIcon, ChevronRightIcon, ChevronDownIcon, ListBulletIcon, ChartBarIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, GripVerticalIcon, StarIcon, UserIcon, WhatsAppIcon, PhotoIcon, XMarkIcon, FlagIcon, MagnifyingGlassIcon } from './icons';

// --- Filter Icon (inline SVG, funnel) ---
const FilterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
  </svg>
);

// --- Filter Types ---
interface TaskFilters {
  search: string;
  statuses: TaskStatus[];
  priorities: TaskPriority[];
  assigneeUids: string[];
  dateFrom: string; // ISO date string (yyyy-mm-dd) or ''
  dateTo: string;
}

const EMPTY_FILTERS: TaskFilters = {
  search: '',
  statuses: [],
  priorities: [],
  assigneeUids: [],
  dateFrom: '',
  dateTo: '',
};

const isFiltersEmpty = (f: TaskFilters): boolean =>
  f.search === '' &&
  f.statuses.length === 0 &&
  f.priorities.length === 0 &&
  f.assigneeUids.length === 0 &&
  f.dateFrom === '' &&
  f.dateTo === '';

const countActiveFilters = (f: TaskFilters): number => {
  let c = 0;
  if (f.search) c++;
  if (f.statuses.length) c++;
  if (f.priorities.length) c++;
  if (f.assigneeUids.length) c++;
  if (f.dateFrom || f.dateTo) c++;
  return c;
};

/** Returns true if a task (leaf-level check) passes ALL active filters */
const taskMatchesFilters = (task: Task, filters: TaskFilters): boolean => {
  // Search
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const nameMatch = task.name.toLowerCase().includes(q);
    const deliverablesMatch = task.deliverables?.some(d => d.toLowerCase().includes(q)) || false;
    if (!nameMatch && !deliverablesMatch) return false;
  }
  // Status
  if (filters.statuses.length > 0) {
    if (!filters.statuses.includes(task.status)) return false;
  }
  // Priority
  if (filters.priorities.length > 0) {
    const effectivePri = task.priority ?? TaskPriority.Important;
    if (!filters.priorities.includes(effectivePri)) return false;
  }
  // Assignee
  if (filters.assigneeUids.length > 0) {
    const taskUids = (task.assignees || []).map(a => a.uid);
    // Passes if the task has at least one of the selected assignees
    if (!filters.assigneeUids.some(uid => taskUids.includes(uid))) return false;
  }
  // Date range
  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom);
    const taskEnd = new Date(task.endDate);
    if (taskEnd < from) return false;
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    to.setHours(23, 59, 59, 999);
    const taskStart = new Date(task.startDate);
    if (taskStart > to) return false;
  }
  return true;
};

/** Recursively filter tasks: keep a parent if it matches OR any of its children match */
const filterTasksRecursive = (tasks: Task[], filters: TaskFilters): Task[] => {
  if (isFiltersEmpty(filters)) return tasks;
  return tasks.reduce<Task[]>((acc, task) => {
    const filteredSubTasks = task.subTasks ? filterTasksRecursive(task.subTasks, filters) : undefined;
    const selfMatches = taskMatchesFilters(task, filters);
    const hasMatchingChildren = filteredSubTasks && filteredSubTasks.length > 0;
    if (selfMatches || hasMatchingChildren) {
      acc.push({ ...task, subTasks: hasMatchingChildren ? filteredSubTasks : (selfMatches ? task.subTasks : undefined) });
    }
    return acc;
  }, []);
};
import GanttChart from './GanttChart';
import ConfirmationModal from './ConfirmationModal';
import { useUserLookup } from '../hooks/useUserLookup';
import SectionStatusDonut from './charts/SectionStatusDonut';
import PriorityDonut from './charts/PriorityDonut';
import UserAchievementBadge from './UserAchievementBadge';

// Helper function to calculate task progress recursively
const calculateTaskProgress = (task: Task): number => {
  if (!task.subTasks || task.subTasks.length === 0) {
    const statusStr = task.status as string;
    if (statusStr === TaskStatus.AtRisk) return 50;

    // Parse percentage
    const percentage = parseInt(statusStr.replace('%', ''));
    if (!isNaN(percentage)) return percentage;

    // Legacy fallbacks
    if (statusStr === 'Completed') return 100;
    if (statusStr === 'In Progress') return 50;
    return 0;
  }

  const totalProgress = task.subTasks.reduce((sum, subTask) => sum + calculateTaskProgress(subTask), 0);
  return Math.round(totalProgress / task.subTasks.length);
};

const getProgressBarColor = (status: TaskStatus | string): string => {
  switch (status) {
    case TaskStatus.Hundred:
    case 'Completed':
      return 'bg-green-400';
    case TaskStatus.SeventyFive:
      return 'bg-indigo-400';
    case TaskStatus.Fifty:
    case 'In Progress':
      return 'bg-blue-400';
    case TaskStatus.TwentyFive:
      return 'bg-amber-400';
    case TaskStatus.AtRisk:
      return 'bg-red-400';
    case TaskStatus.Zero:
    case 'Not Started':
    default:
      return 'bg-gray-400';
  }
};

// Get progress bar color based on percentage value
const getProgressBarColorFromPercent = (percent: number): string => {
  if (percent >= 100) return 'bg-green-400';
  if (percent >= 75) return 'bg-indigo-400';
  if (percent >= 50) return 'bg-blue-400';
  if (percent >= 25) return 'bg-amber-400';
  return 'bg-gray-400';
};

const TaskProgressBar: React.FC<{ progress: number; status: TaskStatus | string; useProgressColor?: boolean }> = ({ progress, status, useProgressColor = false }) => {
  const colorClass = useProgressColor ? getProgressBarColorFromPercent(progress) : getProgressBarColor(status);
  return (
    <div className="w-full bg-slate-700 rounded-full h-1.5 mt-1.5">
      <div
        className={`${colorClass} h-1.5 rounded-full transition-all duration-500`}
        style={{ width: `${progress}%` }}
      ></div>
    </div>
  );
};

// --- Section Status & Color Helper for Section Card & Section Headers ---
interface SectionStatusConfig {
  status: TaskStatus | 'Completed' | 'Not Started' | 'In Progress';
  fillGradient: string;
  fillColor: string;
  glowColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  label: string;
  completionPct: number;
  completedTasks: number;
  totalTasks: number;
}

const getSectionStatusConfig = (phase: Phase): SectionStatusConfig => {
  const allTasks = (phase.tasks || []).flatMap(t => t.subTasks ? [t, ...t.subTasks] : [t]);
  const totalTasks = allTasks.length;
  if (totalTasks === 0) {
    return {
      status: 'Not Started',
      fillGradient: 'from-slate-600 to-slate-500',
      fillColor: 'bg-slate-600',
      glowColor: 'shadow-slate-500/20',
      badgeBg: 'bg-slate-700/60',
      badgeText: 'text-slate-400',
      badgeBorder: 'border-slate-600/40',
      label: 'No tasks',
      completionPct: 0,
      completedTasks: 0,
      totalTasks: 0,
    };
  }

  const hasAtRisk = allTasks.some(t => t.status === TaskStatus.AtRisk);
  const completedTasks = allTasks.filter(t => t.status === TaskStatus.Hundred || (t.status as string) === 'Completed').length;
  const completionPct = Math.round((completedTasks / totalTasks) * 100);

  if (hasAtRisk) {
    return {
      status: TaskStatus.AtRisk,
      fillGradient: 'from-red-600 to-rose-500',
      fillColor: 'bg-red-500',
      glowColor: 'shadow-red-500/30',
      badgeBg: 'bg-red-500/15',
      badgeText: 'text-red-400',
      badgeBorder: 'border-red-500/40',
      label: 'At Risk',
      completionPct,
      completedTasks,
      totalTasks,
    };
  }

  if (completionPct === 100) {
    return {
      status: TaskStatus.Hundred,
      fillGradient: 'from-green-600 to-emerald-400',
      fillColor: 'bg-green-500',
      glowColor: 'shadow-green-500/30',
      badgeBg: 'bg-green-500/15',
      badgeText: 'text-green-400',
      badgeBorder: 'border-green-500/40',
      label: 'Completed',
      completionPct,
      completedTasks,
      totalTasks,
    };
  }

  if (completionPct >= 75) {
    return {
      status: TaskStatus.SeventyFive,
      fillGradient: 'from-indigo-600 to-indigo-400',
      fillColor: 'bg-indigo-500',
      glowColor: 'shadow-indigo-500/30',
      badgeBg: 'bg-indigo-500/15',
      badgeText: 'text-indigo-400',
      badgeBorder: 'border-indigo-500/40',
      label: '75%',
      completionPct,
      completedTasks,
      totalTasks,
    };
  }

  if (completionPct >= 50) {
    return {
      status: TaskStatus.Fifty,
      fillGradient: 'from-blue-600 to-blue-400',
      fillColor: 'bg-blue-500',
      glowColor: 'shadow-blue-500/30',
      badgeBg: 'bg-blue-500/15',
      badgeText: 'text-blue-400',
      badgeBorder: 'border-blue-500/40',
      label: '50%',
      completionPct,
      completedTasks,
      totalTasks,
    };
  }

  if (completionPct >= 25) {
    return {
      status: TaskStatus.TwentyFive,
      fillGradient: 'from-amber-600 to-amber-400',
      fillColor: 'bg-amber-500',
      glowColor: 'shadow-amber-500/30',
      badgeBg: 'bg-amber-500/15',
      badgeText: 'text-amber-400',
      badgeBorder: 'border-amber-500/40',
      label: '25%',
      completionPct,
      completedTasks,
      totalTasks,
    };
  }

  if (completionPct > 0) {
    return {
      status: 'In Progress',
      fillGradient: 'from-sky-600 to-sky-400',
      fillColor: 'bg-sky-500',
      glowColor: 'shadow-sky-500/30',
      badgeBg: 'bg-sky-500/15',
      badgeText: 'text-sky-400',
      badgeBorder: 'border-sky-500/40',
      label: `${completionPct}%`,
      completionPct,
      completedTasks,
      totalTasks,
    };
  }

  return {
    status: TaskStatus.Zero,
    fillGradient: 'from-slate-600 to-slate-500',
    fillColor: 'bg-slate-600',
    glowColor: 'shadow-slate-600/20',
    badgeBg: 'bg-slate-700/60',
    badgeText: 'text-slate-400',
    badgeBorder: 'border-slate-600/30',
    label: 'Not Started',
    completionPct: 0,
    completedTasks: 0,
    totalTasks,
  };
};

// --- Stacked Status Breakdown for Section Progress Chart ---
// Order is bottom -> top when rendered with flex-col-reverse
type StatusStackKey = 'done' | 'p75' | 'p50' | 'p25' | 'risk' | 'zero';

const STATUS_STACK_ORDER: { key: StatusStackKey; label: string; color: string }[] = [
  { key: 'done', label: '100%', color: 'bg-gradient-to-t from-green-600 to-emerald-400' },
  { key: 'p75', label: '75%', color: 'bg-gradient-to-t from-indigo-600 to-indigo-400' },
  { key: 'p50', label: '50%', color: 'bg-gradient-to-t from-blue-600 to-blue-400' },
  { key: 'p25', label: '25%', color: 'bg-gradient-to-t from-amber-600 to-amber-400' },
  { key: 'risk', label: 'At Risk', color: 'bg-gradient-to-t from-red-600 to-rose-500' },
  { key: 'zero', label: '0%', color: 'bg-slate-600/70' },
];

const getStatusStackKey = (status: string): StatusStackKey => {
  if (status === TaskStatus.AtRisk) return 'risk';
  if (status === TaskStatus.Hundred || status === 'Completed') return 'done';
  if (status === TaskStatus.SeventyFive) return 'p75';
  if (status === TaskStatus.Fifty || status === 'In Progress') return 'p50';
  if (status === TaskStatus.TwentyFive) return 'p25';
  return 'zero';
};

/** Counts tasks (incl. subtasks, consistent with the Tasks stat) per status bucket */
const getSectionStatusBreakdown = (phase: Phase): { counts: Record<StatusStackKey, number>; total: number } => {
  const counts: Record<StatusStackKey, number> = { done: 0, p75: 0, p50: 0, p25: 0, risk: 0, zero: 0 };
  const allTasks = (phase.tasks || []).flatMap(t => t.subTasks ? [t, ...t.subTasks] : [t]);
  allTasks.forEach(t => { counts[getStatusStackKey(t.status as string)]++; });
  return { counts, total: allTasks.length };
};

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
  canEdit: boolean;
  onUpdateProject: (project: Project) => void;
  showToast: (message: string) => void;
  currentUserId?: string;  // Current user's ID for creator tracking
  currentUserEmail?: string; // Current user's email
  userRole?: 'admin' | 'manager' | 'member'; // Current user's role
  onEditProject?: () => void;
}

type SortKey = 'name' | 'startDate' | 'status' | 'priority' | 'deliverables';
type SortDirection = 'ascending' | 'descending';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

// --- Priority System Colors & Helpers ---
const PRIORITY_COLORS: Record<number, { border: string; bg: string; text: string; label: string; dot: string }> = {
  [TaskPriority.Critical]: { border: 'border-l-red-500', bg: 'bg-red-500/10', text: 'text-red-400', label: 'Critical', dot: 'bg-red-500' },
  [TaskPriority.Important]: { border: 'border-l-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Important', dot: 'bg-amber-500' },
  [TaskPriority.Enhancement]: { border: 'border-l-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Enhancement', dot: 'bg-blue-500' },
};

const getEffectivePriority = (task: Task): number => {
  // Unset priority defaults to Important (2) for display/sort purposes
  return task.priority ?? TaskPriority.Important;
};

const PriorityEditButtons: React.FC<{
  onSelect: (priority: TaskPriority) => void;
  onClose: () => void;
}> = ({ onSelect, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  const priorities = [
    { value: TaskPriority.Critical, label: 'Critical', colors: PRIORITY_COLORS[TaskPriority.Critical] },
    { value: TaskPriority.Important, label: 'Important', colors: PRIORITY_COLORS[TaskPriority.Important] },
    { value: TaskPriority.Enhancement, label: 'Enhancement', colors: PRIORITY_COLORS[TaskPriority.Enhancement] },
  ];

  return (
    <div
      ref={ref}
      className="absolute top-1/2 -translate-y-1/2 left-0 z-20 flex items-center space-x-1 outline-none p-1 bg-slate-900 rounded-lg shadow-xl border border-slate-700"
    >
      {priorities.map((p) => (
        <button
          key={p.value}
          onClick={() => onSelect(p.value)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border flex items-center gap-1.5 ${p.colors.bg} ${p.colors.text} hover:brightness-125 border-transparent`}
        >
          <span className={`w-2 h-2 rounded-full ${p.colors.dot}`}></span>
          {p.label}
        </button>
      ))}
    </div>
  );
};

const sortTasks = (tasks: Task[], config: SortConfig): Task[] => {
  if (!tasks) return [];

  const sorted = [...tasks].sort((a, b) => {
    let compareValue = 0;
    switch (config.key) {
      case 'name':
        compareValue = a.name.localeCompare(b.name);
        break;
      case 'startDate':
        // revive dates since they might be strings from JSON.parse
        const dateA = new Date(a.startDate);
        const dateB = new Date(b.startDate);
        compareValue = dateA.getTime() - dateB.getTime();
        break;
      case 'status':
        compareValue = calculateTaskProgress(a) - calculateTaskProgress(b);
        break;
      case 'priority':
        // Lower number = higher priority (Critical=1 first)
        compareValue = getEffectivePriority(a) - getEffectivePriority(b);
        break;
      case 'deliverables':
        const aLen = a.deliverables?.length || 0;
        const bLen = b.deliverables?.length || 0;
        compareValue = aLen - bLen;
        break;
    }
    return config.direction === 'ascending' ? compareValue : -compareValue;
  });

  return sorted.map(task => ({
    ...task,
    subTasks: task.subTasks ? sortTasks(task.subTasks, config) : undefined
  }));
};


export interface TaskFormData {
  name: string;
  priority: TaskPriority;
  startDate: Date;
  endDate: Date;
  assignees: TeamMember[];
}

const formatLocalDate = (d: Date): string => {
  const date = new Date(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return new Date();
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
};

interface InlineTaskFormProps {
  onSave: (data: TaskFormData) => void;
  onCancel: () => void;
  placeholder?: string;
  className?: string;
  teamMembers?: TeamMember[];
  getUserDisplayName?: (uid: string, email?: string) => string | undefined;
  getUserPhotoURL?: (uid: string, email?: string) => string | undefined;
  sectionLabel?: string;
  isSubtask?: boolean;
}

const InlineTaskForm: React.FC<InlineTaskFormProps> = ({
  onSave,
  onCancel,
  placeholder = 'New task name',
  className,
  teamMembers = [],
  getUserDisplayName,
  getUserPhotoURL,
  sectionLabel,
  isSubtask = false,
}) => {
  const [name, setName] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.Important);

  // 24hr default timeline: today to tomorrow
  const now = useMemo(() => new Date(), []);
  const tomorrow = useMemo(() => new Date(now.getTime() + 24 * 60 * 60 * 1000), [now]);
  const [startDateStr, setStartDateStr] = useState<string>(() => formatLocalDate(now));
  const [endDateStr, setEndDateStr] = useState<string>(() => formatLocalDate(tomorrow));

  // Assign dropdown state
  const [selectedAssignees, setSelectedAssignees] = useState<TeamMember[]>([]);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsAssignOpen(false);
      }
    };
    if (isAssignOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAssignOpen]);

  const handleStartDateChange = (val: string) => {
    setStartDateStr(val);
    if (val) {
      const newStart = parseLocalDate(val);
      const newEnd = new Date(newStart.getTime() + 24 * 60 * 60 * 1000);
      setEndDateStr(formatLocalDate(newEnd));
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (name.trim()) {
      onSave({
        name: name.trim(),
        priority,
        startDate: parseLocalDate(startDateStr),
        endDate: parseLocalDate(endDateStr),
        assignees: selectedAssignees,
      });
      setName('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return teamMembers;
    const query = memberSearch.toLowerCase();
    return teamMembers.filter(m => {
      const dName = getUserDisplayName?.(m.uid, m.email) || m.displayName || '';
      return dName.toLowerCase().includes(query) || (m.email && m.email.toLowerCase().includes(query));
    });
  }, [teamMembers, memberSearch, getUserDisplayName]);

  const priorityPills = [
    {
      value: TaskPriority.Critical,
      label: 'Critical',
      dot: 'bg-red-500',
      activeClass: 'bg-red-500/20 text-red-300 border-red-500/60 ring-1 ring-red-500/40',
      inactiveClass: 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-300 hover:border-slate-600',
    },
    {
      value: TaskPriority.Important,
      label: 'Important',
      dot: 'bg-amber-500',
      activeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/60 ring-1 ring-amber-500/40',
      inactiveClass: 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-300 hover:border-slate-600',
    },
    {
      value: TaskPriority.Enhancement,
      label: 'Enhancement',
      dot: 'bg-blue-500',
      activeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/60 ring-1 ring-blue-500/40',
      inactiveClass: 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-300 hover:border-slate-600',
    },
  ];

  return (
    <form onSubmit={handleSubmit} className={`bg-slate-800/95 border border-slate-700/80 rounded-xl p-3.5 shadow-lg space-y-3 transition-all ${className || ''}`}>
      {/* Top row: Section Label / Title + Action buttons */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {sectionLabel && (
            <span className="text-xs font-mono font-bold px-2 py-1 rounded-lg bg-slate-900 text-brand-secondary border border-slate-700/90 flex-shrink-0 select-none shadow-sm" title={`Section ${sectionLabel}`}>
              {sectionLabel}
            </span>
          )}
          <span className="text-xs font-semibold text-slate-300">
            {isSubtask ? 'New Subtask' : 'New Task'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={!name.trim()}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-brand-secondary hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0 shadow-sm"
          >
            <PlusCircleIcon className="w-4 h-4" />
            <span>{isSubtask ? 'Add Subtask' : 'Add Task'}</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors flex-shrink-0"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* 2-line text edit box before vertical scroll */}
      <div className="relative">
        <textarea
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Task name or description...'}
          rows={2}
          className="w-full bg-slate-900/90 border border-slate-700 hover:border-slate-600 focus:border-brand-secondary text-white text-sm rounded-lg p-2 outline-none transition-colors resize-none overflow-y-auto leading-relaxed"
          autoFocus
        />
      </div>

      {/* Controls row: Assign Dropdown | Priority compact pill buttons | Timeline 24hr default */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-700/50 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Assign Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsAssignOpen(!isAssignOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-900/80 hover:bg-slate-900 border border-slate-700 text-slate-300 transition-colors"
              title="Assign task"
            >
              {selectedAssignees.length === 0 ? (
                <>
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Assign</span>
                  <ChevronDownIcon className="w-3 h-3 text-slate-500" />
                </>
              ) : (
                <>
                  <div className="flex -space-x-1 items-center">
                    {selectedAssignees.slice(0, 2).map((m, i) => {
                      const photo = getUserPhotoURL?.(m.uid, m.email) || m.photoURL;
                      const dName = getUserDisplayName?.(m.uid, m.email) || m.displayName || m.email;
                      return (
                        <div key={i} className="w-4 h-4 rounded-full bg-slate-700 border border-slate-900 flex items-center justify-center text-[9px] overflow-hidden">
                          {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : (dName[0] || '?').toUpperCase()}
                        </div>
                      );
                    })}
                  </div>
                  <span className="max-w-[110px] truncate text-slate-200">
                    {selectedAssignees.length === 1
                      ? (getUserDisplayName?.(selectedAssignees[0].uid, selectedAssignees[0].email) || selectedAssignees[0].displayName || selectedAssignees[0].email.split('@')[0])
                      : `${selectedAssignees.length} assigned`}
                  </span>
                  <ChevronDownIcon className="w-3 h-3 text-slate-400" />
                </>
              )}
            </button>

            {isAssignOpen && (
              <div className="absolute left-0 mt-1.5 w-60 max-h-60 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 space-y-1">
                {teamMembers.length > 4 && (
                  <div className="px-1 pb-1">
                    <input
                      type="text"
                      placeholder="Search members..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-secondary"
                      autoFocus
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAssignees([]);
                    setIsAssignOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors text-left ${
                    selectedAssignees.length === 0 ? 'bg-slate-800 text-brand-secondary font-medium' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <UserIcon className="w-3 h-3 text-slate-500" />
                  </div>
                  <span>Unassigned</span>
                  {selectedAssignees.length === 0 && <CheckCircleIcon className="w-3.5 h-3.5 ml-auto text-brand-secondary" />}
                </button>

                {filteredMembers.map(member => {
                  const isSelected = selectedAssignees.some(m => m.uid === member.uid);
                  const dName = getUserDisplayName?.(member.uid, member.email) || member.displayName || member.email.split('@')[0];
                  const photo = getUserPhotoURL?.(member.uid, member.email) || member.photoURL;

                  return (
                    <button
                      key={member.uid}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedAssignees(selectedAssignees.filter(m => m.uid !== member.uid));
                        } else {
                          setSelectedAssignees([member]);
                          setIsAssignOpen(false);
                        }
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors text-left ${
                        isSelected ? 'bg-brand-secondary/15 text-white font-medium' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-[10px] overflow-hidden flex-shrink-0">
                        {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : (dName[0] || '?').toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0 flex-grow">
                        <span className="truncate">{dName}</span>
                        <span className="text-[10px] text-slate-500 truncate">{member.email}</span>
                      </div>
                      {isSelected && <CheckCircleIcon className="w-3.5 h-3.5 ml-auto text-brand-secondary flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Priority Compact Pill Buttons (Default: Important) */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium flex items-center gap-1 mr-0.5">
              <FlagIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>Priority:</span>
            </span>
            {priorityPills.map((pill) => {
              const isSelected = priority === pill.value;
              return (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setPriority(pill.value)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected ? pill.activeClass : pill.inactiveClass
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${pill.dot} ${isSelected ? 'scale-110' : 'opacity-70'}`} />
                  <span>{pill.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Timeline (24hr default) */}
        <div className="flex items-center gap-2 text-slate-300 bg-slate-900/80 border border-slate-700/80 px-2.5 py-1 rounded-lg">
          <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400 font-medium">Timeline:</span>
          <input
            type="date"
            value={startDateStr}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className="bg-transparent text-slate-200 border-none outline-none text-xs p-0 cursor-pointer"
          />
          <span className="text-slate-500">-</span>
          <input
            type="date"
            value={endDateStr}
            onChange={(e) => setEndDateStr(e.target.value)}
            className="bg-transparent text-slate-200 border-none outline-none text-xs p-0 cursor-pointer"
          />
          <span className="text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded bg-brand-secondary/20 text-brand-secondary border border-brand-secondary/30 select-none">
            24h default
          </span>
        </div>
      </div>
    </form>
  );
};

const STATUS_BUTTON_STYLES: Record<string, string> = {
  [TaskStatus.Hundred]: 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/20',
  [TaskStatus.SeventyFive]: 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border-indigo-500/20',
  [TaskStatus.Fifty]: 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20',
  [TaskStatus.TwentyFive]: 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/20',
  [TaskStatus.Zero]: 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/20 border-gray-500/20',
  [TaskStatus.AtRisk]: 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20',
};

const StatusEditButtons: React.FC<{
  onSelect: (status: TaskStatus) => void;
  onClose: () => void;
}> = ({ onSelect, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Handle click outside to close - use 'click' instead of 'mousedown' so button onClick fires first
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Add listener with a small delay to prevent immediate close from the opening click
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);



  return (
    <div
      ref={ref}
      className="absolute top-1/2 -translate-y-1/2 left-0 z-20 flex items-center space-x-1 outline-none p-1 bg-slate-900 rounded-lg shadow-xl"
    >
      {Object.values(TaskStatus).map((status) => (
        <button
          key={status}
          onClick={() => onSelect(status)}
          className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors border ${STATUS_BUTTON_STYLES[status]}`}
        >
          {status}
        </button>
      ))}
    </div>
  );
};


interface TaskRowProps {
  task: Task;
  level: number;
  isExpanded: boolean;
  onToggleExpand: (taskId: string) => void;
  addingSubtaskTo: string | null;
  setAddingSubtaskTo: (taskId: string | null) => void;
  canEdit: boolean;
  handleSaveSubtask: (parentTaskId: string, data: TaskFormData | string) => void;
  editingField: { taskId: string; field: string } | null;
  setEditingField: (field: { taskId: string; field: string } | null) => void;
  handleUpdateTaskField: (taskId: string, field: keyof Task, value: any) => void;
  onRequestDelete: (taskId: string) => void;
  phaseId: string;
  parentId?: string;
  onDragStart: (e: React.DragEvent, task: Task, phaseId: string, parentId?: string) => void;
  onDragOver: (e: React.DragEvent, task: Task, phaseId: string, parentId?: string) => void;
  onDrop: (e: React.DragEvent, task: Task, phaseId: string, parentId?: string) => void;
  onDragEnd: () => void;
  onDragLeave: () => void;
  draggedItemId: string | null;
  dropTarget: { taskId: string; position: 'above' | 'below' } | null;
  checkPermission: (ownerId?: string) => boolean;
  onAssign?: (task: Task) => void;
  projectTeam?: TeamMember[];
  getUserDisplayName?: (uid: string, email?: string) => string | undefined;
  getUserPhotoURL?: (uid: string, email?: string) => string | undefined;
  onImageUpload?: (taskId: string, file: File) => void;
  onRemoveImage?: (taskId: string, imageUrl: string) => void;
  onViewImage?: (imageUrl: string) => void;
}

const TaskRow: React.FC<TaskRowProps> = ({ task, level, isExpanded, onToggleExpand, addingSubtaskTo, setAddingSubtaskTo, canEdit, handleSaveSubtask, editingField, setEditingField, handleUpdateTaskField, onRequestDelete, phaseId, parentId, onDragStart, onDragOver, onDrop, onDragEnd, onDragLeave, draggedItemId, dropTarget, checkPermission, onAssign, projectTeam, getUserDisplayName, getUserPhotoURL, onImageUpload, onRemoveImage, onViewImage }) => {
  const effectivePriority = getEffectivePriority(task);
  const priorityColor = PRIORITY_COLORS[effectivePriority];
  const isPriorityUnset = task.priority === undefined || task.priority === null;
  const hasSubtasks = task.subTasks && task.subTasks.length > 0;
  const formatDate = (date: Date) => new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric' });
  const isEditing = (field: string) => editingField?.taskId === task.id && editingField?.field === field;
  const progress = calculateTaskProgress(task);
  const originatorName = getUserDisplayName?.(task.ownerId || '', task.ownerEmail) || task.ownerEmail?.split('@')[0] || (task.ownerId ? 'Originator' : 'Unassigned');
  const originatorPhoto = getUserPhotoURL?.(task.ownerId || '', task.ownerEmail);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const hasImages = task.imageUrls && task.imageUrls.length > 0;
  const canAddMoreImages = !task.imageUrls || task.imageUrls.length < 5;

  // Calculate permission for this specific task
  const canEditTask = canEdit && checkPermission(task.ownerId);

  const isBeingDragged = draggedItemId === task.id;
  const isDropTargetAbove = dropTarget?.taskId === task.id && dropTarget.position === 'above';
  const isDropTargetBelow = dropTarget?.taskId === task.id && dropTarget.position === 'below';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setEditingField(null);
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!canEditTask || !canAddMoreImages) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          onImageUpload?.(task.id, file);
        }
        return;
      }
    }
  };

  return (
    <>
      {isDropTargetAbove && <li className="h-0.5 bg-brand-secondary list-none" style={{ marginLeft: `${level * 2}rem` }} />}
      <li
        className={`group/task bg-slate-800 rounded-lg p-2 grid grid-cols-10 gap-4 items-center transition-opacity outline-none focus:ring-1 focus:ring-brand-secondary/50 border-l-4 ${priorityColor.border} ${isPriorityUnset ? 'border-l-dashed' : ''} ${isBeingDragged ? 'opacity-30' : 'opacity-100'}`}
        style={{ marginLeft: `${level * 2}rem` }}
        tabIndex={0}
        draggable={canEditTask}
        onDragStart={(e) => onDragStart(e, task, phaseId, parentId)}
        onDragOver={(e) => onDragOver(e, task, phaseId, parentId)}
        onDrop={(e) => onDrop(e, task, phaseId, parentId)}
        onDragEnd={onDragEnd}
        onDragLeave={onDragLeave}
        onPaste={handlePaste}
      >
        <div className="col-span-4 text-white font-medium flex items-center min-w-0">
          {canEditTask && <GripVerticalIcon className="w-5 h-5 mr-2 text-slate-500 cursor-grab flex-shrink-0" />}
          {hasSubtasks ? (
            <button onClick={() => onToggleExpand(task.id)} className="mr-2 text-slate-400 hover:text-white flex-shrink-0" title="Has subtasks">
              {isExpanded ? (
                <span className="flex flex-col -space-y-2">
                  <ChevronDownIcon className="w-4 h-4" />
                  <ChevronDownIcon className="w-4 h-4" />
                </span>
              ) : (
                <span className="flex -space-x-2">
                  <ChevronRightIcon className="w-4 h-4" />
                  <ChevronRightIcon className="w-4 h-4" />
                </span>
              )}
            </button>
          ) : <div className="w-4 h-4 mr-2 flex-shrink-0" style={!canEditTask ? { marginLeft: '1.75rem' } : {}} />}

          {/* Task Originator Icon (Square to differentiate from circular Assignee icons) */}
          <div
            className="w-7 h-7 rounded-md bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-200 overflow-hidden flex-shrink-0 mr-2.5 shadow-sm ring-1 ring-slate-800"
            title={`Originator: ${originatorName}${task.ownerEmail ? ` (${task.ownerEmail})` : ''}`}
          >
            {originatorPhoto ? (
              <img src={originatorPhoto} className="w-full h-full object-cover" alt={originatorName} />
            ) : task.ownerId || task.ownerEmail ? (
              (originatorName[0] || 'U').toUpperCase()
            ) : (
              <UserIcon className="w-4 h-4 text-slate-400" />
            )}
          </div>

          <div className="w-full min-w-0">
            {isEditing('name') ? (
              <textarea
                defaultValue={task.name}
                rows={3}
                onBlur={(e) => handleUpdateTaskField(task.id, 'name', e.target.value)}
                onKeyDown={handleKeyDown}
                className="bg-slate-700 border border-slate-600 text-white text-sm rounded-md block w-full p-1.5 resize-none overflow-y-auto leading-relaxed focus:ring-1 focus:ring-brand-secondary outline-none"
                autoFocus
              />
            ) : (
              <span className="w-full cursor-pointer whitespace-pre-wrap break-words" onClick={() => canEditTask && setEditingField({ taskId: task.id, field: 'name' })}>{task.name}</span>
            )}
            <TaskProgressBar progress={progress} status={task.status} useProgressColor={hasSubtasks} />
            {/* Task Image Thumbnails */}
            {hasImages && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {task.imageUrls!.map((url, idx) => (
                  <div key={idx} className="relative group/img w-8 h-8 rounded-md overflow-hidden border border-slate-600 hover:border-brand-secondary transition-colors flex-shrink-0 cursor-pointer">
                    <img
                      src={url}
                      alt={`Task image ${idx + 1}`}
                      className="w-full h-full object-cover"
                      onClick={(e) => { e.stopPropagation(); onViewImage?.(url); }}
                    />
                    {canEditTask && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemoveImage?.(task.id, url); }}
                        className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity shadow-lg"
                        title="Remove image"
                      >
                        <XMarkIcon className="w-2.5 h-2.5 text-white" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Add Image — visible on hover */}
            {canEditTask && canAddMoreImages && (
              <div className="flex items-center mt-1 opacity-0 group-hover/task:opacity-100 transition-opacity">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onImageUpload?.(task.id, file);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => { e.stopPropagation(); imageInputRef.current?.click(); }}
                  className="flex items-center gap-1 text-slate-500 hover:text-brand-light transition-colors text-xs py-0.5 px-1.5 rounded hover:bg-slate-700/50"
                  title={`Add Image (${task.imageUrls?.length || 0}/5)`}
                >
                  <PhotoIcon className="w-3.5 h-3.5" />
                  <span>Add Image ({task.imageUrls?.length || 0}/5)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="col-span-2 text-slate-300">
          {isEditing('startDate') ? (
            <input
              type="date"
              defaultValue={new Date(task.startDate).toISOString().split('T')[0]}
              onBlur={(e) => handleUpdateTaskField(task.id, 'startDate', new Date(e.target.value))}
              onKeyDown={handleKeyDown}
              className="bg-slate-700 border border-slate-600 text-white text-sm rounded-md block w-full p-1"
              autoFocus
            />
          ) : (
            <span className="p-1 cursor-pointer" onClick={() => canEditTask && setEditingField({ taskId: task.id, field: 'startDate' })}>{formatDate(task.startDate)}</span>
          )}
          <span className="mx-1">-</span>
          {isEditing('endDate') ? (
            <input
              type="date"
              defaultValue={new Date(task.endDate).toISOString().split('T')[0]}
              onBlur={(e) => handleUpdateTaskField(task.id, 'endDate', new Date(e.target.value))}
              onKeyDown={handleKeyDown}
              className="bg-slate-700 border border-slate-600 text-white text-sm rounded-md block w-full p-1"
              autoFocus
            />
          ) : (
            <span className="p-1 cursor-pointer" onClick={() => canEditTask && setEditingField({ taskId: task.id, field: 'endDate' })}>{formatDate(task.endDate)}</span>
          )}
        </div>

        <div className="col-span-1 relative">
          {hasSubtasks ? (
            // Parent task: show calculated progress from subtasks (non-editable) with color coding
            (() => {
              // Get color based on calculated progress
              const getParentStatusColors = () => {
                if (progress >= 100) return { bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-400' };
                if (progress >= 75) return { bg: 'bg-indigo-500/10', text: 'text-indigo-400', dot: 'bg-indigo-400' };
                if (progress >= 50) return { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' };
                if (progress >= 25) return { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' };
                return { bg: 'bg-gray-500/10', text: 'text-gray-400', dot: 'bg-gray-400' };
              };
              const colors = getParentStatusColors();
              return (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
                  title="Calculated from subtasks"
                >
                  <span className={`w-2 h-2 mr-1.5 rounded-full ${colors.dot}`}></span>
                  {progress}%
                </span>
              );
            })()
          ) : isEditing('status') ? (
            <StatusEditButtons
              onSelect={(status) => {
                handleUpdateTaskField(task.id, 'status', status);
                setEditingField(null);
              }}
              onClose={() => setEditingField(null)}
            />
          ) : (
            <div
              className="inline-block cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (canEditTask) {
                  setEditingField({ taskId: task.id, field: 'status' });
                }
              }}
            >
              <StatusBadge status={task.status} />
            </div>
          )}
        </div>

        {/* Priority Column */}
        <div className="col-span-1 relative">
          {isEditing('priority') ? (
            <PriorityEditButtons
              onSelect={(priority) => {
                handleUpdateTaskField(task.id, 'priority', priority);
                setEditingField(null);
              }}
              onClose={() => setEditingField(null)}
            />
          ) : (
            <div
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${isPriorityUnset ? 'bg-slate-700/50 text-slate-400 animate-pulse' : `${priorityColor.bg} ${priorityColor.text}`}`}
              onClick={(e) => {
                e.stopPropagation();
                if (canEditTask) {
                  setEditingField({ taskId: task.id, field: 'priority' });
                }
              }}
              title={isPriorityUnset ? 'Set priority (required)' : priorityColor.label}
            >
              <FlagIcon className="w-3 h-3" />
              <span>{isPriorityUnset ? 'Set' : priorityColor.label}</span>
            </div>
          )}
        </div>

        <div className="col-span-2 flex items-center justify-between overflow-hidden">
          <div className="flex flex-col gap-1 w-full mr-2">
            {/* Assignees */}
            <div className="flex items-center gap-2">
              {task.assignees && task.assignees.length > 0 ? (
                <div className="flex -space-x-2 overflow-hidden hover:space-x-1 transition-all p-1">
                  {task.assignees.map((a, i) => {
                    // Dynamic lookup for fresh data
                    const lookupName = getUserDisplayName?.(a.uid, a.email);
                    const lookupPhoto = getUserPhotoURL?.(a.uid, a.email);
                    const displayName = lookupName || a.displayName;
                    const photoURL = lookupPhoto || a.photoURL;

                    let name = displayName;
                    if (!name || name.includes('@')) {
                      name = a.email.split('@')[0];
                      name = name.charAt(0).toUpperCase() + name.slice(1);
                    }

                    return (
                      <div key={i} className="w-6 h-6 shrink-0 rounded-full bg-slate-600 border border-slate-700 flex items-center justify-center text-[10px] text-white cursor-help"
                        title={`${name} (${a.email})`}>
                        {photoURL ? <img src={photoURL} className="w-6 h-6 rounded-full" alt="" /> : (displayName?.[0] || a.email[0]).toUpperCase()}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span className="text-xs text-slate-600 italic">Unassigned</span>
              )}
            </div>

            {/* Deliverables */}
            <div className="text-slate-400 text-xs space-y-1">
              {task.deliverables?.map(d => <div key={d} className="flex items-center truncate"><CheckCircleIcon className="w-3 h-3 text-green-500 mr-1.5 flex-shrink-0" /> <span className="truncate">{d}</span></div>)}
            </div>
          </div>
          {canEditTask && (
            <div className="flex items-center space-x-1">
              <button
                onClick={() => onAssign?.(task)}
                className={`text-slate-500 hover:text-brand-light transition-colors p-1 rounded-full ${(!task.assignees || task.assignees.length === 0) ? 'animate-pulse text-slate-600' : ''}`}
                title="Assign Members"
              >
                <UserIcon className="w-5 h-5" />
              </button>

              <button onClick={() => setAddingSubtaskTo(task.id)} className="text-slate-500 hover:text-brand-light transition-colors p-1 rounded-full" title="Add Subtask">
                <PlusCircleIcon className="w-5 h-5" />
              </button>
              <button onClick={() => onRequestDelete(task.id)} className="text-slate-500 hover:text-red-500 transition-colors p-1 rounded-full" title="Delete Task">
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </li>
      {isDropTargetBelow && <li className="h-0.5 bg-brand-secondary list-none" style={{ marginLeft: `${level * 2}rem` }} />}

      {addingSubtaskTo === task.id && (
        <InlineTaskForm
          onSave={(data) => handleSaveSubtask(task.id, data)}
          onCancel={() => setAddingSubtaskTo(null)}
          placeholder="New sub-task name"
          className="mt-2 ml-12"
          teamMembers={projectTeam}
          getUserDisplayName={getUserDisplayName}
          getUserPhotoURL={getUserPhotoURL}
          isSubtask
        />
      )}
      {isExpanded && hasSubtasks && (
        task.subTasks?.map(subTask => (
          <TaskRow
            key={subTask.id}
            task={subTask}
            level={level + 1}
            isExpanded={isExpanded}
            onToggleExpand={onToggleExpand}
            addingSubtaskTo={addingSubtaskTo}
            setAddingSubtaskTo={setAddingSubtaskTo}
            canEdit={canEdit}
            handleSaveSubtask={handleSaveSubtask}
            editingField={editingField}
            setEditingField={setEditingField}
            handleUpdateTaskField={handleUpdateTaskField}
            onRequestDelete={onRequestDelete}
            phaseId={phaseId}
            parentId={task.id}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            onDragLeave={onDragLeave}
            draggedItemId={draggedItemId}
            dropTarget={dropTarget}
            checkPermission={checkPermission}
            getUserDisplayName={getUserDisplayName}
            getUserPhotoURL={getUserPhotoURL}
            onImageUpload={onImageUpload}
            onRemoveImage={onRemoveImage}
            onViewImage={onViewImage}
          />
        ))
      )}
    </>
  );
};


interface SortableHeaderCellProps {
  label: string;
  sortKey: SortKey;
  sortConfig: SortConfig;
  onSort: (key: SortKey) => void;
  className?: string;
}

const SortableHeaderCell: React.FC<SortableHeaderCellProps> = ({ label, sortKey, sortConfig, onSort, className }) => {
  const isSorted = sortConfig.key === sortKey;

  return (
    <div className={className}>
      <button
        onClick={() => onSort(sortKey)}
        className={`flex items-center space-x-1 font-medium transition-colors group ${
          isSorted
            ? 'text-brand-light bg-brand-secondary/10 px-2 py-0.5 rounded-md'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <span className={isSorted ? 'text-brand-light' : 'group-hover:text-white'}>{label}</span>
        {isSorted && (
          sortConfig.direction === 'ascending'
            ? <ArrowUpIcon className="w-3 h-3 text-brand-light" />
            : <ArrowDownIcon className="w-3 h-3 text-brand-light" />
        )}
      </button>
    </div>
  );
};


const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, onBack, canEdit, onUpdateProject, showToast, currentUserId, currentUserEmail, userRole, onEditProject }) => {
  const [aiInsight, setAiInsight] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Only project owner or admin can archive/unarchive
  const canArchive = canEdit && (userRole === 'admin' || project.ownerId === currentUserId);
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<string | null>(null);
  const [addingTaskToPhase, setAddingTaskToPhase] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ taskId: string; field: string } | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'gantt'>('list');
  const [taskToDeleteId, setTaskToDeleteId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'status', direction: 'ascending' });

  // --- Task Filter State ---
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const activeFilterCount = countActiveFilters(filters);

  const updateFilter = useCallback(<K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleStatusFilter = useCallback((status: TaskStatus) => {
    setFilters(prev => {
      const has = prev.statuses.includes(status);
      return { ...prev, statuses: has ? prev.statuses.filter(s => s !== status) : [...prev.statuses, status] };
    });
  }, []);

  const togglePriorityFilter = useCallback((priority: TaskPriority) => {
    setFilters(prev => {
      const has = prev.priorities.includes(priority);
      return { ...prev, priorities: has ? prev.priorities.filter(p => p !== priority) : [...prev.priorities, priority] };
    });
  }, []);

  const toggleAssigneeFilter = useCallback((uid: string) => {
    setFilters(prev => {
      const has = prev.assigneeUids.includes(uid);
      return { ...prev, assigneeUids: has ? prev.assigneeUids.filter(u => u !== uid) : [...prev.assigneeUids, uid] };
    });
  }, []);

  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  // Collect unique assignees across the entire project for the assignee filter dropdown
  const allProjectAssignees = useMemo(() => {
    const map = new Map<string, TeamMember>();
    (project.phases || []).forEach(phase => {
      const walk = (tasks: Task[]) => {
        tasks.forEach(t => {
          (t.assignees || []).forEach(a => { if (a.uid && !map.has(a.uid)) map.set(a.uid, a); });
          if (t.subTasks) walk(t.subTasks);
        });
      };
      walk(phase.tasks || []);
    });
    // Also add team members from project.team
    (project.team?.members || []).forEach(m => { if (m.uid && !map.has(m.uid)) map.set(m.uid, m); });
    return Array.from(map.values());
  }, [project]);

  const availableTeamMembers = useMemo(() => {
    const map = new Map<string, TeamMember>();
    (project.team?.members || []).forEach(m => {
      if (m.uid && !map.has(m.uid)) map.set(m.uid, m);
    });
    (allProjectAssignees || []).forEach(m => {
      if (m.uid && !map.has(m.uid)) map.set(m.uid, m);
    });
    if (currentUserId && !map.has(currentUserId)) {
      map.set(currentUserId, {
        uid: currentUserId,
        email: currentUserEmail || '',
        displayName: 'You',
      });
    }
    return Array.from(map.values());
  }, [project.team, allProjectAssignees, currentUserId, currentUserEmail]);
  const [editingPhase, setEditingPhase] = useState<{ id: string; field: 'name' | 'weekRange' } | null>(null);
  const [editingInfoCard, setEditingInfoCard] = useState<'duration' | 'cost' | 'team' | null>(null);
  const [phaseToDelete, setPhaseToDelete] = useState<Phase | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<{ show: boolean; action: 'archive' | 'unarchive' }>({ show: false, action: 'archive' });
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [uploadingTaskImage, setUploadingTaskImage] = useState<string | null>(null); // taskId currently uploading

  const [assigningTo, setAssigningTo] = useState<{
    type: 'phase' | 'task';
    id: string;
    currentAssignees: TeamMember[];
    name: string;
    hasChildren: boolean;
  } | null>(null);

  // --- Accordion State ---
  const [isTopBandCollapsed, setIsTopBandCollapsed] = useState(false);
  // Once the user clicks anywhere in the summary row, it stops auto-collapsing
  const [isTopBandPinned, setIsTopBandPinned] = useState(false);
  // Track hover to pause the auto-collapse timer while user is reading/interacting
  const [isTopBandHovered, setIsTopBandHovered] = useState(false);

  // Reset summary row state whenever a different project is opened
  useEffect(() => {
    setIsTopBandCollapsed(false);
    setIsTopBandPinned(false);
    setIsTopBandHovered(false);
  }, [project.id]);

  // Auto-collapse the summary row after 3s unless it has been clicked/pinned or is currently hovered
  useEffect(() => {
    if (isTopBandPinned || isTopBandCollapsed || isTopBandHovered) return;
    const timer = setTimeout(() => setIsTopBandCollapsed(true), 3000);
    return () => clearTimeout(timer);
  }, [isTopBandPinned, isTopBandCollapsed, isTopBandHovered, project.id]);

  const handleSummaryRowClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const isInteractive = target.closest('button, a, input, select, textarea, [role="button"]');
    if (isInteractive) {
      setIsTopBandPinned(true);
      return;
    }
    setIsTopBandPinned(true);
    setIsTopBandCollapsed(prev => !prev);
  }, []);

  const overallCompletionPct = useMemo(() => {
    const allTasks = (project.phases || []).flatMap(ph =>
      (ph.tasks || []).flatMap(t => t.subTasks ? [t, ...t.subTasks] : [t])
    );
    if (allTasks.length === 0) return 0;
    const completed = allTasks.filter(t => t.status === TaskStatus.Hundred || (t.status as string) === 'Completed').length;
    return Math.round((completed / allTasks.length) * 100);
  }, [project.phases]);

  const priorityBreakdown = useMemo(() => {
    const allTasks = (project.phases || []).flatMap(ph =>
      (ph.tasks || []).flatMap(t => t.subTasks ? [t, ...t.subTasks] : [t])
    );
    let critical = 0;
    let important = 0;
    let enhancement = 0;
    allTasks.forEach(t => {
      const p = getEffectivePriority(t);
      if (p === TaskPriority.Critical) critical++;
      else if (p === TaskPriority.Important) important++;
      else if (p === TaskPriority.Enhancement) enhancement++;
    });
    return { critical, important, enhancement, total: allTasks.length };
  }, [project.phases]);

  const projectStartDateLabel = useMemo(() => {
    if (!project.startDate) return null;
    const d = new Date(project.startDate);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [project.startDate]);
  const [isCardsCollapsed, setIsCardsCollapsed] = useState(false);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [phaseAnimationKeys, setPhaseAnimationKeys] = useState<Record<string, number>>({});

  const togglePhaseCollapse = (phaseId: string) => {
    setCollapsedPhases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(phaseId)) {
        newSet.delete(phaseId);
      } else {
        newSet.add(phaseId);
      }
      return newSet;
    });
    // Increment animation key to restart donut animation
    setPhaseAnimationKeys(prev => ({
      ...prev,
      [phaseId]: (prev[phaseId] || 0) + 1
    }));
  };

  const handleScrollToSection = (phaseId: string) => {
    // If phase is currently collapsed, expand it
    if (collapsedPhases.has(phaseId)) {
      setCollapsedPhases(prev => {
        const next = new Set(prev);
        next.delete(phaseId);
        return next;
      });
      setPhaseAnimationKeys(prev => ({
        ...prev,
        [phaseId]: (prev[phaseId] || 0) + 1
      }));
    }
    // Also if in gantt view, switch to list view so the section is visible
    if (viewMode !== 'list') {
      setViewMode('list');
    }
    setTimeout(() => {
      const el = document.getElementById(`section-${phaseId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('ring-2', 'ring-brand-secondary', 'ring-offset-2', 'ring-offset-slate-900');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-brand-secondary', 'ring-offset-2', 'ring-offset-slate-900');
        }, 1800);
      }
    }, 50);
  };

  // --- User Lookup for displaying names and photos ---
  const { getUserDisplayName, getUserPhotoURL } = useUserLookup();

  // --- Drag and Drop State ---
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [draggedItemContext, setDraggedItemContext] = useState<{ phaseId: string; parentId?: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ taskId: string; position: 'above' | 'below' } | null>(null);


  const sortedProject = useMemo(() => {
    // Deep copy project to avoid mutating props, and revive dates which are lost in stringify
    const projectCopy = JSON.parse(JSON.stringify(project), (key, value) => {
      if (key === 'startDate' || key === 'endDate') {
        return new Date(value);
      }
      return value;
    });

    // Ensure phases exists (defensive check)
    if (!projectCopy.phases) {
      projectCopy.phases = [];
    }

    projectCopy.phases.forEach((phase: Phase) => {
      // Apply filters first, then sort
      let tasks = phase.tasks || [];
      tasks = filterTasksRecursive(tasks, filters);
      phase.tasks = sortTasks(tasks, sortConfig);
    });
    return projectCopy;
  }, [project, sortConfig, filters]);

  const reviveDates = (key: string, value: any) => {
    if (key === 'startDate' || key === 'endDate') {
      return new Date(value);
    }
    return value;
  };

  // Compute effective canEdit - false if project is archived
  const effectiveCanEdit = canEdit && !project.isArchived;

  const checkPermission = (itemOwnerId?: string) => {
    if (!effectiveCanEdit || !currentUserId) return false;
    if (project.ownerId === currentUserId) return true;
    // Admins and Managers have full item management permissions for projects they belong to
    if (userRole === 'admin' || userRole === 'manager') return true;
    const member = project.team?.members?.find(m => m.uid === currentUserId || (currentUserEmail && m.email?.toLowerCase() === currentUserEmail.toLowerCase()));
    if (!member) return true;
    if (member.leadRole === 'primary' || member.leadRole === 'secondary') return true;
    // If no owner is set on the item, allow any team member to edit
    if (!itemOwnerId) return true;
    return itemOwnerId === currentUserId;
  };

  // --- Drag and Drop Handlers ---

  const handleDragStart = (e: React.DragEvent, task: Task, phaseId: string, parentId?: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
    setDraggedItemId(task.id);
    setDraggedItemContext({ phaseId, parentId });
  };

  const handleDragOver = (e: React.DragEvent, targetTask: Task, phaseId: string, parentId?: string) => {
    e.preventDefault();
    if (!draggedItemContext || !draggedItemId) return;

    if (draggedItemId === targetTask.id) return;

    // Only allow dropping within the same parent
    if (draggedItemContext.phaseId !== phaseId || draggedItemContext.parentId !== parentId) {
      setDropTarget(null);
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    e.dataTransfer.dropEffect = 'move';

    const targetElement = e.currentTarget as HTMLLIElement;
    const rect = targetElement.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position = e.clientY < midpoint ? 'above' : 'below';

    if (dropTarget?.taskId !== targetTask.id || dropTarget?.position !== position) {
      setDropTarget({ taskId: targetTask.id, position });
    }
  };

  const handleDrop = (e: React.DragEvent, targetTask: Task, phaseId: string, parentId?: string) => {
    e.preventDefault();
    const draggedTaskId = e.dataTransfer.getData('text/plain');
    if (!draggedTaskId || !draggedItemContext || !dropTarget) {
      handleDragEnd();
      return;
    };
    if (draggedTaskId === targetTask.id) {
      handleDragEnd();
      return;
    };

    if (draggedItemContext.phaseId !== phaseId || draggedItemContext.parentId !== parentId) {
      handleDragEnd();
      return;
    }

    const updatedProject = JSON.parse(JSON.stringify(project), reviveDates);

    let parentList: Task[] | undefined;
    const findParentList = (p: Project) => {
      const phase = p.phases.find(ph => ph.id === phaseId);
      if (!phase) return;

      if (!parentId) {
        parentList = phase.tasks;
      } else {
        const findListRecursively = (tasks: Task[]): Task[] | undefined => {
          for (const task of tasks) {
            if (task.id === parentId) {
              return task.subTasks;
            }
            if (task.subTasks) {
              const list = findListRecursively(task.subTasks);
              if (list) return list;
            }
          }
          return undefined;
        };
        parentList = findListRecursively(phase.tasks);
      }
    };
    findParentList(updatedProject);

    if (!parentList) {
      handleDragEnd();
      return;
    }

    const dragIndex = parentList.findIndex(t => t.id === draggedTaskId);
    const targetIndex = parentList.findIndex(t => t.id === targetTask.id);

    if (dragIndex === -1 || targetIndex === -1) {
      handleDragEnd();
      return;
    }

    const [draggedItem] = parentList.splice(dragIndex, 1);
    const newTargetIndex = parentList.findIndex(t => t.id === targetTask.id);

    if (dropTarget.position === 'above') {
      parentList.splice(newTargetIndex, 0, draggedItem);
    } else {
      parentList.splice(newTargetIndex + 1, 0, draggedItem);
    }

    onUpdateProject(updatedProject);
    handleDragEnd();
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDraggedItemContext(null);
    setDropTarget(null);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleGetInsights = async () => {
    setIsLoading(true);
    setAiInsight('');
    const insight = await getProjectInsights(project);
    setAiInsight(insight);
    setIsLoading(false);
  };

  const handleToggleExpand = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleSort = (key: SortKey) => {
    setSortConfig(prevConfig => {
      if (prevConfig.key === key) {
        return {
          key,
          direction: prevConfig.direction === 'ascending' ? 'descending' : 'ascending',
        };
      }
      return { key, direction: 'ascending' };
    });
  };

  const handleAddPhase = () => {
    const newPhase: Phase = {
      id: `phase-${Date.now()}`,
      name: `Section: ${project.phases.length + 1}`,
      weekRange: 'TBD',
      tasks: [],
      ownerId: currentUserId,
      ownerEmail: currentUserEmail,
    };
    const updatedProject = JSON.parse(JSON.stringify(project), reviveDates);
    updatedProject.phases.unshift(newPhase);
    onUpdateProject(updatedProject);
    showToast("New section created below.");
  };

  const handleUpdatePhase = (phaseId: string, field: 'name' | 'weekRange', value: string) => {
    if (field === 'name' && !value.trim()) {
      setEditingPhase(null);
      return;
    }
    const updatedProject = JSON.parse(JSON.stringify(project), reviveDates);
    const phase = updatedProject.phases.find((p: Phase) => p.id === phaseId);
    if (phase) {
      phase[field] = value;
    }
    onUpdateProject(updatedProject);
    setEditingPhase(null);
  };

  const handleRequestDeletePhase = (phase: Phase) => {
    setPhaseToDelete(phase);
  };

  const handleConfirmDeletePhase = () => {
    if (!phaseToDelete) return;
    const updatedProject = JSON.parse(JSON.stringify(project), reviveDates);
    updatedProject.phases = updatedProject.phases.filter((p: Phase) => p.id !== phaseToDelete.id);
    onUpdateProject(updatedProject);
    setPhaseToDelete(null);
  };

  const handleSaveTask = (phaseId: string, data: TaskFormData | string) => {
    const isString = typeof data === 'string';
    const name = isString ? data.trim() : data.name.trim();
    if (!name) return;

    const defaultStart = new Date();
    const defaultEnd = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24hr default

    const assignees = !isString && data.assignees && data.assignees.length > 0 ? data.assignees : undefined;
    const ownerId = currentUserId;
    const ownerEmail = currentUserEmail;

    const newTask: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name,
      status: TaskStatus.Zero,
      priority: isString ? TaskPriority.Important : data.priority,
      startDate: isString ? defaultStart : data.startDate,
      endDate: isString ? defaultEnd : data.endDate,
      assignees: assignees,
      ownerId: ownerId,
      ownerEmail: ownerEmail,
    };

    const updatedProject = JSON.parse(JSON.stringify(project), reviveDates);

    const phase = updatedProject.phases.find((p: Phase) => p.id === phaseId);
    if (phase) {
      phase.tasks.push(newTask);
    }

    onUpdateProject(updatedProject);
    setAddingTaskToPhase(null);
  };

  const handleSaveSubtask = (parentTaskId: string, data: TaskFormData | string) => {
    const isString = typeof data === 'string';
    const name = isString ? data.trim() : data.name.trim();
    if (!name) return;

    const defaultStart = new Date();
    const defaultEnd = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24hr default

    const assignees = !isString && data.assignees && data.assignees.length > 0 ? data.assignees : undefined;
    const ownerId = currentUserId;
    const ownerEmail = currentUserEmail;

    const newSubTask: Task = {
      id: `subtask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name,
      status: TaskStatus.Zero,
      priority: isString ? TaskPriority.Important : data.priority,
      startDate: isString ? defaultStart : data.startDate,
      endDate: isString ? defaultEnd : data.endDate,
      assignees: assignees,
      ownerId: ownerId,
      ownerEmail: ownerEmail,
    };

    const updatedProject = JSON.parse(JSON.stringify(project), reviveDates);

    const findAndAdd = (tasks: Task[]): boolean => {
      for (const task of tasks) {
        if (task.id === parentTaskId) {
          task.subTasks = task.subTasks ? [...task.subTasks, newSubTask] : [newSubTask];
          return true;
        }
        if (task.subTasks && findAndAdd(task.subTasks)) {
          return true;
        }
      }
      return false;
    };

    updatedProject.phases.forEach((phase: Phase) => {
      findAndAdd(phase.tasks);
    });

    onUpdateProject(updatedProject);
    setAddingSubtaskTo(null);
    setExpandedTasks(prev => new Set(prev).add(parentTaskId));
  };

  const handleUpdateTaskField = (taskId: string, field: keyof Task, value: any) => {
    // Prevent saving if the name is empty
    if (field === 'name' && !value.trim()) {
      setEditingField(null);
      return;
    }

    const updatedProject = JSON.parse(JSON.stringify(project), reviveDates);

    const findAndUpdate = (tasks: Task[]): boolean => {
      for (const task of tasks) {
        if (task.id === taskId) {
          (task as any)[field] = value;
          return true;
        }
        if (task.subTasks && findAndUpdate(task.subTasks)) {
          return true;
        }
      }
      return false;
    };

    for (const phase of updatedProject.phases) {
      if (findAndUpdate(phase.tasks)) {
        break;
      }
    }

    onUpdateProject(updatedProject);
    setEditingField(null);

    // Check phase completion and award points
    if (field === 'status' && (value === TaskStatus.Hundred || value === 'Completed')) {
      setTimeout(async () => {
        // We need to use the updatedProject state effectively, or just traverse the current structure if we trust it matches the update.
        // Since we just called onUpdateProject, 'updatedProject' variable holds the new state.
        const relevantPhase = updatedProject.phases.find((p: Phase) => p.tasks.some(t => t.id === taskId || (t.subTasks && t.subTasks.some(st => st.id === taskId))));

        if (relevantPhase) {
          const allPhaseTasks = relevantPhase.tasks.flatMap((t: Task) => [t, ...(t.subTasks || [])]);
          // Re-check strict 100%
          const isStrictComplete = allPhaseTasks.every((t: Task) => t.status === TaskStatus.Hundred || (t.status as string) === 'Completed');

          if (isStrictComplete) {
            if (relevantPhase.assignees && relevantPhase.assignees.length > 0) {
              relevantPhase.assignees.forEach(async (member: TeamMember) => {
                if (member.uid) {
                  await achievementService.awardPoints(member.uid, 50, 'phase_complete', `Completed Section: ${relevantPhase.name}`, project.id);
                }
              });
              showToast(`Section "${relevantPhase.name}" complete! 50 points to assignees.`);
            }
          }
        }
      }, 1000);
    }

    // Award points if completed (Task level)
    if (field === 'status' && (value === TaskStatus.Hundred || value === 'Completed')) {
      const findTask = (phases: Phase[]): Task | undefined => {
        for (const p of phases) {
          const t = findInTasks(p.tasks);
          if (t) return t;
        }
        return undefined;
      }
      const findInTasks = (tasks: Task[]): Task | undefined => {
        for (const t of tasks) {
          if (t.id === taskId) return t;
          if (t.subTasks) {
            const sub = findInTasks(t.subTasks);
            if (sub) return sub;
          }
        }
        return undefined;
      }

      const completedTask = findTask(updatedProject.phases);
      if (completedTask && completedTask.assignees && completedTask.assignees.length > 0) {
        // Award points to all assignees
        completedTask.assignees.forEach(async (member) => {
          if (member.uid) {
            await achievementService.awardPoints(member.uid, 10, 'task_complete', `Completed task: ${completedTask.name}`, project.id);
          }
        });
        showToast('Task completed! 10 points awarded to assignees.');
      }
    }
  };

  const handleRequestDeleteTask = (taskId: string) => {
    setTaskToDeleteId(taskId);
  };

  const handleConfirmDeleteTask = () => {
    if (!taskToDeleteId) return;

    const updatedProject = JSON.parse(JSON.stringify(project), reviveDates);

    const findAndRemove = (tasks: Task[], id: string): Task[] => {
      return tasks.filter(task => {
        if (task.id === id) {
          return false; // remove this task
        }
        if (task.subTasks) {
          task.subTasks = findAndRemove(task.subTasks, id);
        }
        return true;
      });
    };

    updatedProject.phases.forEach((phase: Phase) => {
      phase.tasks = findAndRemove(phase.tasks, taskToDeleteId);
    });

    onUpdateProject(updatedProject);
    setTaskToDeleteId(null);
  };

  const handleUpdateDuration = (duration: string, unit: DurationUnit) => {
    const numDuration = parseInt(duration);
    if (!isNaN(numDuration)) {
      const updatedProject = JSON.parse(JSON.stringify(project), reviveDates);
      updatedProject.duration = numDuration;
      updatedProject.durationUnit = unit;
      onUpdateProject(updatedProject);
    }
    setEditingInfoCard(null);
  };

  const handleUpdateCost = (cost: string, currency: Currency) => {
    // Remove commas if present
    const cleanCost = cost.toString().replace(/,/g, '');
    const numCost = parseFloat(cleanCost);
    if (!isNaN(numCost)) {
      const updatedProject = JSON.parse(JSON.stringify(project), reviveDates);
      updatedProject.cost = numCost;
      updatedProject.currency = currency;
      onUpdateProject(updatedProject);
    }
    setEditingInfoCard(null);
  };

  // Helper to propagate assignments down the tree (retains existing assignments)
  const propagateAssignmentsToChildren = (tasks: Task[], newMembers: TeamMember[]): void => {
    for (const task of tasks) {
      // Merge new members with existing (retain manual assignments)
      const existingUids = new Set(task.assignees?.map(a => a.uid) || []);
      const membersToAdd = newMembers.filter(m => !existingUids.has(m.uid));
      task.assignees = [...(task.assignees || []), ...membersToAdd];

      // Recurse into subtasks
      if (task.subTasks) {
        propagateAssignmentsToChildren(task.subTasks, newMembers);
      }
    }
  };

  const handleAssign = async (members: TeamMember[], notify: boolean, propagate: boolean = false) => {
    if (!assigningTo) return;
    const updatedProject = JSON.parse(JSON.stringify(project), reviveDates);

    if (assigningTo.type === 'phase') {
      const phase = updatedProject.phases.find((p: Phase) => p.id === assigningTo.id);
      if (phase) {
        phase.assignees = members;
        // Propagate to all tasks in this phase if requested
        if (propagate && phase.tasks) {
          propagateAssignmentsToChildren(phase.tasks, members);
        }
      }
    } else {
      const findAndUpdateTask = (tasks: Task[]): boolean => {
        for (const task of tasks) {
          if (task.id === assigningTo.id) {
            task.assignees = members;
            // Propagate to subtasks if requested
            if (propagate && task.subTasks) {
              propagateAssignmentsToChildren(task.subTasks, members);
            }
            return true;
          }
          if (task.subTasks && findAndUpdateTask(task.subTasks)) return true;
        }
        return false;
      };
      updatedProject.phases.forEach((p: Phase) => findAndUpdateTask(p.tasks));
    }

    onUpdateProject(updatedProject);

    if (notify) {
      await notificationService.notifyResponsibilityAssigned(members, project, assigningTo.type, assigningTo.name);
      showToast('Notifications sent');
    }

    setAssigningTo(null);
  };

  // --- Task Image Handlers ---
  const handleTaskImageUpload = async (taskId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file');
      return;
    }
    // 1MB limit
    if (file.size > 1 * 1024 * 1024) {
      showToast('Image must be under 1MB');
      return;
    }

    setUploadingTaskImage(taskId);
    try {
      const imageUrl = await uploadTaskImage(project.id, taskId, file);

      // Find the task and append the new image URL
      const updatedProject = JSON.parse(JSON.stringify(project), reviveDates);
      const findAndAddImage = (tasks: Task[]): boolean => {
        for (const task of tasks) {
          if (task.id === taskId) {
            const currentImages = task.imageUrls || [];
            if (currentImages.length >= 5) {
              showToast('Maximum 5 images per task');
              return true;
            }
            task.imageUrls = [...currentImages, imageUrl];
            return true;
          }
          if (task.subTasks && findAndAddImage(task.subTasks)) return true;
        }
        return false;
      };

      for (const phase of updatedProject.phases) {
        if (findAndAddImage(phase.tasks)) break;
      }

      onUpdateProject(updatedProject);
      showToast('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading task image:', error);
      showToast('Failed to upload image. Please try again.');
    } finally {
      setUploadingTaskImage(null);
    }
  };

  const handleRemoveTaskImage = (taskId: string, imageUrl: string) => {
    const updatedProject = JSON.parse(JSON.stringify(project), reviveDates);
    const findAndRemoveImage = (tasks: Task[]): boolean => {
      for (const task of tasks) {
        if (task.id === taskId) {
          task.imageUrls = (task.imageUrls || []).filter((url: string) => url !== imageUrl);
          if (task.imageUrls.length === 0) delete task.imageUrls;
          return true;
        }
        if (task.subTasks && findAndRemoveImage(task.subTasks)) return true;
      }
      return false;
    };

    for (const phase of updatedProject.phases) {
      if (findAndRemoveImage(phase.tasks)) break;
    }

    onUpdateProject(updatedProject);
    showToast('Image removed');
  };

  // --- Archive Functionality ---
  const handleArchive = (archive: boolean) => {
    const updatedProject = JSON.parse(JSON.stringify(project), reviveDates);
    updatedProject.isArchived = archive;
    if (archive) {
      updatedProject.archivedAt = new Date();
      updatedProject.archivedBy = currentUserId;
    } else {
      // When unarchiving, keep archivedAt for history but clear archivedBy
      delete updatedProject.archivedBy;
    }
    onUpdateProject(updatedProject);
    showToast(archive ? 'Project archived' : 'Project unarchived');
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation & Action Bar */}
      <div className="flex items-center justify-between gap-4">
        <button onClick={onBack} className="flex items-center space-x-2 text-brand-light hover:text-white transition-colors text-sm font-medium">
          <ArrowLeftIcon className="w-4 h-4" />
          <span>Back to Projects</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Discreet Archive Button */}
          {canArchive && !project.isArchived && (
            <button
              onClick={() => setArchiveConfirm({ show: true, action: 'archive' })}
              className="text-slate-400 hover:text-amber-400 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-xs font-medium transition-colors flex items-center gap-1.5 border border-slate-700/60"
              title="Archive Project"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <span>Archive</span>
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Summary Row (Title Card + Sections Card) — auto-collapses after 3s unless clicked or hovered */}
      <div
        onMouseEnter={() => setIsTopBandHovered(true)}
        onMouseLeave={() => setIsTopBandHovered(false)}
      >
        {/* Collapsed compact row (styled like the Project Details header) */}
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isTopBandCollapsed ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              setIsTopBandPinned(true);
              setIsTopBandCollapsed(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsTopBandPinned(true);
                setIsTopBandCollapsed(false);
              }
            }}
            className={`w-full p-4 flex items-center justify-between gap-4 text-left rounded-xl border transition-colors cursor-pointer hover:bg-slate-700/30 ${project.isArchived
              ? 'bg-amber-500/10 border-amber-500/50'
              : 'bg-slate-800/50 border-slate-700'}`}
            title="Expand summary"
            aria-expanded={false}
          >
            <div className="flex items-center gap-3 min-w-0">
              <CircularProgress percentage={overallCompletionPct} size={30} strokeWidth={3} showText={false} />
              <span className="font-semibold text-base text-white truncate">{project.name}</span>
              {project.isPublic ? (
                <span className="inline-flex items-center px-2 py-0.2 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  <span className="mr-1">🌐</span> Public
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.2 rounded-full text-[10px] font-medium bg-slate-700/80 text-slate-400 border border-slate-600">
                  <span className="mr-1">🔒</span> Private
                </span>
              )}
              <span className="text-xs font-semibold text-slate-400 flex-shrink-0">{overallCompletionPct}%</span>
              {projectStartDateLabel && (
                <span className="hidden sm:flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  Started {projectStartDateLabel}
                </span>
              )}
            </div>
            <ChevronDownIcon className="w-5 h-5 text-slate-400 -rotate-90 flex-shrink-0" />
          </div>
        </div>

        {/* Expanded summary row */}
        <div
          onClick={handleSummaryRowClick}
          className={`transition-all duration-300 ease-in-out overflow-hidden ${isTopBandCollapsed ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[600px] opacity-100'}`}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Title & Description Card (lg:col-span-5) */}
            <div className={`lg:col-span-5 p-3.5 sm:p-4 rounded-xl border flex flex-col justify-between transition-colors cursor-pointer hover:border-slate-600/80 ${project.isArchived
              ? 'bg-amber-500/10 border-amber-500/50'
              : 'bg-slate-800/50 border-slate-700'}`}>
              {/* Archived Notice */}
              {project.isArchived && (
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-500/30">
                  <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  <span className="text-amber-200 text-xs font-medium flex-1">This project is archived.</span>
                  {canArchive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsTopBandPinned(true);
                        setArchiveConfirm({ show: true, action: 'unarchive' });
                      }}
                      className="px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-medium rounded transition-colors cursor-pointer"
                    >
                      Unarchive
                    </button>
                  )}
                </div>
              )}
              <div className="flex items-start gap-3">
                <CircularProgress
                  percentage={overallCompletionPct}
                  size={46}
                  strokeWidth={4}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-white leading-snug line-clamp-2 break-words" title={project.name}>{project.name}</h2>
                    {project.isPublic ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        <span className="mr-1">🌐</span> Public
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700/80 text-slate-400 border border-slate-600">
                        <span className="mr-1">🔒</span> Private
                      </span>
                    )}
                  </div>
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  {project.ownerId && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs text-slate-400">Owner:</span>
                      {getUserPhotoURL(project.ownerId, project.ownerEmail) ? (
                        <img src={getUserPhotoURL(project.ownerId, project.ownerEmail)} alt="Owner" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-brand-secondary/30 flex items-center justify-center flex-shrink-0">
                          <UserIcon className="w-2.5 h-2.5 text-brand-light" />
                        </div>
                      )}
                      <span className="text-xs text-brand-light truncate">{getUserDisplayName(project.ownerId, project.ownerEmail) || project.ownerEmail}</span>
                    </div>
                  )}
                  {projectStartDateLabel && (
                    <div className="flex items-center gap-1.5 flex-shrink-0" title="Project start date">
                      <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs text-slate-400">Start:</span>
                      <span className="text-xs text-slate-200 font-medium">{projectStartDateLabel}</span>
                    </div>
                  )}
                  </div>
                </div>
              </div>
              {project.description && (
                <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed" title={project.description}>{project.description}</p>
              )}
            </div>

            {/* Section Progress Stats Card (lg:col-span-7) */}
            <div className="lg:col-span-7 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-slate-600/80 p-3.5 sm:p-4 flex flex-col transition-colors cursor-pointer">
              {/* Header: label, status legend, collapse chevron */}
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex-shrink-0">Section Progress</span>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="hidden sm:flex items-center gap-2.5 flex-wrap justify-end">
                    {[...STATUS_STACK_ORDER].reverse().map(s => (
                      <span key={s.key} className="flex items-center gap-1 text-[10px] text-slate-400">
                        <span className={`w-2 h-2 rounded-sm ${s.color}`} />
                        {s.label}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsTopBandPinned(true);
                      setIsTopBandCollapsed(true);
                    }}
                    className="p-1 -m-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors flex-shrink-0 cursor-pointer"
                    title="Hide summary"
                    aria-label="Hide summary"
                    aria-expanded={!isTopBandCollapsed}
                  >
                    <ChevronDownIcon className="w-5 h-5 transition-transform duration-300" />
                  </button>
                </div>
              </div>

              <div className="flex items-stretch gap-4 flex-1 min-h-[110px]">
                {/* Left Column: Stats */}
                <div className="flex flex-col justify-center gap-2 pr-4 border-r border-slate-700/60 flex-shrink-0">
                  <div className="text-left">
                    <p className="text-xl sm:text-2xl font-bold text-white leading-none">{(project.phases || []).length}</p>
                    <span className="text-[11px] text-slate-400 font-medium">Sections</span>
                  </div>
                  <div className="text-left">
                    <p className="text-xl sm:text-2xl font-bold text-white leading-none">
                      {priorityBreakdown.total}
                    </p>
                    <span className="text-[11px] text-slate-400 font-medium">Tasks</span>
                  </div>
                </div>

                {/* Priority Donut Chart Column */}
                <div className="flex flex-col justify-center pr-4 border-r border-slate-700/60 flex-shrink-0">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Priority</span>
                  <PriorityDonut
                    critical={priorityBreakdown.critical}
                    important={priorityBreakdown.important}
                    enhancement={priorityBreakdown.enhancement}
                    total={priorityBreakdown.total}
                    activePriorities={filters.priorities}
                    onTogglePriority={togglePriorityFilter}
                  />
                </div>

                {/* Right Column: Stacked status chart using full card height */}
                <div className="flex-1 flex min-w-0">
                  <div className="flex gap-2 items-stretch h-full w-full overflow-x-auto pb-0.5 px-0.5">
                    {(project.phases || []).length === 0 ? (
                      <div className="flex flex-col items-center gap-1 h-full">
                        <div className="w-7 flex-1 min-h-[64px] bg-slate-700/50 rounded-md border border-slate-600/30" title="No sections" />
                        <span className="text-[10px] text-slate-500 font-medium">-</span>
                      </div>
                    ) : (project.phases || []).map((phase, index) => {
                      const config = getSectionStatusConfig(phase);
                      const breakdown = getSectionStatusBreakdown(phase);
                      const sectionIdLabel = `S${index + 1}`;
                      const breakdownText = STATUS_STACK_ORDER
                        .filter(s => breakdown.counts[s.key] > 0)
                        .map(s => `  ${s.label}: ${breakdown.counts[s.key]}`)
                        .join('\n');

                      return (
                        <button
                          key={phase.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsTopBandPinned(true);
                            handleScrollToSection(phase.id);
                          }}
                          className="group flex flex-col items-center gap-1 h-full focus:outline-none transition-transform hover:-translate-y-0.5 cursor-pointer flex-shrink-0"
                          title={`${sectionIdLabel}: ${phase.name}\nStatus: ${config.label}\nCompleted: ${config.completionPct}% (${config.completedTasks}/${config.totalTasks} tasks)${breakdownText ? `\n${breakdownText}` : ''}\nClick to scroll to this section`}
                        >
                          {/* Stacked Column: one segment per task status (bottom = 100%, top = 0%) */}
                          <div className="relative w-7 sm:w-8 flex-1 min-h-[64px] bg-slate-900/60 rounded-md border border-slate-700/80 overflow-hidden flex flex-col-reverse group-hover:border-slate-500 group-hover:shadow-md transition-all">
                            {breakdown.total > 0 && STATUS_STACK_ORDER.map(s => {
                              const count = breakdown.counts[s.key];
                              if (count === 0) return null;
                              return (
                                <div
                                  key={s.key}
                                  className={`w-full flex-shrink-0 ${s.color} border-t border-slate-900/50 transition-all duration-500 ease-out group-hover:brightness-110`}
                                  style={{ height: `${(count / breakdown.total) * 100}%`, minHeight: '3px' }}
                                />
                              );
                            })}
                          </div>

                          {/* Section ID Badge */}
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border transition-all ${config.badgeBg} ${config.badgeText} ${config.badgeBorder} group-hover:scale-105`}>
                            {sectionIdLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Collapsible Project Details Section */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        {/* Header with Project Type, Duration, and Cost inline */}
        <button
          onClick={() => setIsCardsCollapsed(!isCardsCollapsed)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-700/30 transition-colors"
        >
          <div className="flex items-center gap-6 flex-wrap">
            <h3 className="font-semibold text-lg text-white">Project Details</h3>
            {/* Project Type - inline */}
            <div className="flex items-center gap-2">
              <div className="bg-slate-700 p-1.5 rounded-lg text-brand-light">
                <InfoIcon className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs text-slate-400">Project Type</span>
                <p className="text-sm font-semibold text-white">{project.coreSystem}</p>
              </div>
            </div>
            {/* Duration - inline */}
            <div className="flex items-center gap-2">
              <div className="bg-slate-700 p-1.5 rounded-lg text-brand-light">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs text-slate-400">Duration</span>
                <p className="text-sm font-semibold text-white">{project.duration} {project.durationUnit || 'weeks'}</p>
              </div>
            </div>
            {/* Cost/Funding - inline */}
            <div className="flex items-center gap-2">
              <div className="bg-slate-700 p-1.5 rounded-lg text-brand-light">
                <MoneyIcon className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs text-slate-400">Cost / Funding</span>
                <p className="text-sm font-semibold text-white">{project.cost ? `${project.currency === Currency.USD ? '$' : '₦'}${project.cost.toLocaleString()}` : '—'}</p>
              </div>
            </div>
          </div>
          <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isCardsCollapsed ? '-rotate-90' : ''}`} />
        </button>
        <div className={`transition-all duration-300 ease-in-out ${isCardsCollapsed ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100'}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 pt-0">
            {/* Team Card - Expanded to 2 columns */}
            <div
              className={`md:col-span-2 bg-slate-800/50 p-4 rounded-xl border ${effectiveCanEdit && onEditProject ? 'border-slate-700 hover:border-brand-secondary cursor-pointer transition-colors' : 'border-slate-700'}`}
              onClick={() => effectiveCanEdit && onEditProject && onEditProject()}
            >
              <div className="flex items-center space-x-3 text-slate-400 mb-3">
                <TeamIcon className="w-5 h-5" />
                <span className="text-sm font-medium">Team Members</span>
              </div>
              {project.team?.members && project.team.members.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  {[...project.team.members].sort((a, b) => {
                    const getRank = (role?: string) => {
                      if (role === 'primary') return 1;
                      if (role === 'secondary') return 2;
                      return 3;
                    };
                    return getRank(a.leadRole) - getRank(b.leadRole);
                  }).slice(0, 8).map((member) => {
                    const isPrimary = member.leadRole === 'primary';
                    const isSecondary = member.leadRole === 'secondary';
                    const isLead = isPrimary || isSecondary;
                    const memberPhoto = getUserPhotoURL(member.uid, member.email);
                    const memberName = getUserDisplayName(member.uid, member.email) || member.displayName || member.email;
                    return (
                      <div key={member.uid} className="flex items-center gap-2 min-w-0">
                        {memberPhoto ? (
                          <img src={memberPhoto} alt={memberName} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isPrimary ? 'bg-blue-500/20' : isSecondary ? 'bg-amber-500/20' : 'bg-slate-700'
                            }`}>
                            {isLead ? <StarIcon className={`w-3 h-3 ${isPrimary ? 'text-blue-400' : 'text-amber-400'}`} /> : <UserIcon className="w-3 h-3 text-slate-400" />}
                          </div>
                        )}
                        <span className={`text-sm ${isPrimary ? 'text-blue-300 font-medium' : isSecondary ? 'text-amber-300 font-medium' : 'text-white'}`}>
                          {memberName}
                        </span>
                        <div className="scale-75 origin-left flex-shrink-0">
                          <UserAchievementBadge userId={member.uid} />
                        </div>
                        {isLead && (
                          <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${isPrimary ? 'bg-blue-500/30 text-blue-300' : 'bg-amber-500/30 text-amber-300'}`}>
                            {isPrimary ? '1st Lead' : '2nd Lead'}
                          </span>
                        )}
                        {member.phoneNumber && (
                          <a
                            href={`https://wa.me/${member.phoneNumber}?text=Hi ${memberName.split(' ')[0]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-500 hover:text-green-400 p-0.5 rounded-full hover:bg-green-500/10 transition-colors flex-shrink-0"
                            title={`Chat with ${memberName} on WhatsApp`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <WhatsAppIcon className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                  {project.team.members.length > 8 && (
                    <p className="text-xs text-slate-400 col-span-full">+{project.team.members.length - 8} more</p>
                  )}
                </div>
              ) : project.team?.name ? (
                <p className="text-white font-semibold">{project.team.name} / {project.team.size || 0}</p>
              ) : (
                <p className="text-slate-500 text-sm">No team assigned</p>
              )}
            </div>

            {/* Project Status Card */}
            {(() => {
              const allTasks = (project.phases || []).flatMap(ph => (ph.tasks || []).flatMap(t => t.subTasks ? [t, ...t.subTasks] : [t]));
              const now = new Date();
              const atRiskCount = allTasks.filter(t => t.status === TaskStatus.AtRisk).length;
              const overdueCount = allTasks.filter(t => {
                const endDate = new Date(t.endDate);
                const progress = (() => {
                  const statusStr = t.status as string;
                  if (statusStr === TaskStatus.Hundred || statusStr === 'Completed') return 100;
                  const pct = parseInt(statusStr.replace('%', ''));
                  return isNaN(pct) ? 0 : pct;
                })();
                return endDate < now && progress < 100;
              }).length;
              const lateDeliveryCount = allTasks.filter(t => {
                const endDate = new Date(t.endDate);
                const progress = (() => {
                  const statusStr = t.status as string;
                  if (statusStr === TaskStatus.Hundred || statusStr === 'Completed') return 100;
                  const pct = parseInt(statusStr.replace('%', ''));
                  return isNaN(pct) ? 0 : pct;
                })();
                // Late delivery: completed but after end date (simplified: just count overdue for now)
                return endDate < now && progress === 100;
              }).length;
              const totalIssues = atRiskCount + overdueCount;

              return (
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                  <div className="flex items-center space-x-3 text-slate-400 mb-3">
                    <ChartBarIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">Project Status</span>
                  </div>
                  <div className="space-y-3">
                    {/* At Risk */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${atRiskCount > 0 ? 'bg-red-500' : 'bg-green-500'}`} />
                        <span className="text-sm text-slate-300">At Risk</span>
                      </div>
                      <span className={`text-sm font-semibold ${atRiskCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {atRiskCount} {atRiskCount === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    {/* Overdue */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${overdueCount > 0 ? 'bg-amber-500' : 'bg-green-500'}`} />
                        <span className="text-sm text-slate-300">Overdue</span>
                      </div>
                      <span className={`text-sm font-semibold ${overdueCount > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                        {overdueCount} {overdueCount === 1 ? 'task' : 'tasks'}
                      </span>
                    </div>
                    {/* Late Deliveries */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${lateDeliveryCount > 0 ? 'bg-orange-500' : 'bg-green-500'}`} />
                        <span className="text-sm text-slate-300">Late Deliveries</span>
                      </div>
                      <span className={`text-sm font-semibold ${lateDeliveryCount > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                        {lateDeliveryCount}
                      </span>
                    </div>
                    {/* Summary */}
                    <div className="pt-2 border-t border-slate-700">
                      {totalIssues === 0 ? (
                        <p className="text-sm text-green-400 font-medium flex items-center gap-2">
                          <CheckCircleIcon className="w-4 h-4" /> All on track
                        </p>
                      ) : (
                        <p className="text-sm text-amber-400 font-medium">
                          {totalIssues} {totalIssues === 1 ? 'issue' : 'issues'} need attention
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <h3 className="font-semibold text-lg text-white">Project Timeline</h3>
          <div className="flex items-center gap-4">
            {effectiveCanEdit && viewMode === 'list' && (
              <button onClick={handleAddPhase} className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-1 px-3 rounded-lg transition-colors text-sm">
                <PlusCircleIcon className="w-4 h-4" />
                <span>Add Section</span>
              </button>
            )}
            {/* Filter Toggle Button */}
            {viewMode === 'list' && (
              <button
                onClick={() => setShowFilters(prev => !prev)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-brand-secondary/20 text-brand-light border border-brand-secondary/40 shadow-sm shadow-brand-secondary/10'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-transparent'
                }`}
                title={activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active` : 'Filter tasks'}
              >
                <FilterIcon className="w-4 h-4" />
                <span>{showFilters ? 'Hide Filters' : 'Filter'}</span>
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-brand-secondary text-white text-[10px] font-bold rounded-full px-1 shadow-lg animate-[scale-in_0.2s_ease-out]">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}
            <div className="flex items-center rounded-lg bg-slate-900 p-1">
              <ViewModeButton icon={<ListBulletIcon />} label="List" isActive={viewMode === 'list'} onClick={() => setViewMode('list')} />
              <ViewModeButton icon={<ChartBarIcon />} label="Gantt" isActive={viewMode === 'gantt'} onClick={() => setViewMode('gantt')} />
            </div>
          </div>
        </div>

        {/* ======== FILTER BAR ======== */}
        {showFilters && viewMode === 'list' && (
          <div className="border-b border-slate-700 bg-slate-900/60">
            <div className="p-4 space-y-3">
              {/* Row 1: Search + Date range + Clear */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Search Input */}
                <div className="relative flex-grow min-w-[200px] max-w-sm">
                  <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={e => updateFilter('search', e.target.value)}
                    placeholder="Search tasks…"
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg pl-9 pr-8 py-2 focus:ring-1 focus:ring-brand-secondary focus:border-brand-secondary placeholder-slate-500 transition-colors"
                  />
                  {filters.search && (
                    <button onClick={() => updateFilter('search', '')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Date Range */}
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={e => updateFilter('dateFrom', e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-2 focus:ring-1 focus:ring-brand-secondary focus:border-brand-secondary transition-colors"
                    title="From date"
                  />
                  <span className="text-slate-600 text-xs">→</span>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={e => updateFilter('dateTo', e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-2 focus:ring-1 focus:ring-brand-secondary focus:border-brand-secondary transition-colors"
                    title="To date"
                  />
                </div>

                {/* Clear All Filters */}
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors ml-auto"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" />
                    Clear All
                  </button>
                )}
              </div>

              {/* Row 2: Status + Priority pills */}
              <div className="flex items-start gap-6 flex-wrap">
                {/* Status Filter */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Status</span>
                  {Object.values(TaskStatus).map(status => {
                    const isActive = filters.statuses.includes(status);
                    return (
                      <button
                        key={status}
                        onClick={() => toggleStatusFilter(status)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                          isActive
                            ? STATUS_BUTTON_STYLES[status]
                            : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-600 hover:text-slate-300'
                        }`}
                      >
                        {status}
                      </button>
                    );
                  })}
                </div>

                {/* Priority Filter */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Priority</span>
                  {[
                    { value: TaskPriority.Critical, label: 'Critical', colors: PRIORITY_COLORS[TaskPriority.Critical] },
                    { value: TaskPriority.Important, label: 'Important', colors: PRIORITY_COLORS[TaskPriority.Important] },
                    { value: TaskPriority.Enhancement, label: 'Enhancement', colors: PRIORITY_COLORS[TaskPriority.Enhancement] },
                  ].map(p => {
                    const isActive = filters.priorities.includes(p.value);
                    return (
                      <button
                        key={p.value}
                        onClick={() => togglePriorityFilter(p.value)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border flex items-center gap-1.5 ${
                          isActive
                            ? `${p.colors.bg} ${p.colors.text} border-transparent`
                            : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-600 hover:text-slate-300'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isActive ? p.colors.dot : 'bg-slate-600'}`} />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 3: Assignee avatars (only if there are assignees) */}
              {allProjectAssignees.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Assignee</span>
                  {allProjectAssignees.map(member => {
                    const isActive = filters.assigneeUids.includes(member.uid);
                    const lookupName = getUserDisplayName(member.uid, member.email);
                    const lookupPhoto = getUserPhotoURL(member.uid, member.email);
                    const displayName = lookupName || member.displayName;
                    const photoURL = lookupPhoto || member.photoURL;
                    let name = displayName;
                    if (!name || name.includes('@')) {
                      name = member.email.split('@')[0];
                      name = name.charAt(0).toUpperCase() + name.slice(1);
                    }
                    return (
                      <button
                        key={member.uid}
                        onClick={() => toggleAssigneeFilter(member.uid)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium transition-all border ${
                          isActive
                            ? 'bg-brand-secondary/20 text-brand-light border-brand-secondary/40'
                            : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-600 hover:text-slate-300'
                        }`}
                        title={`${name} (${member.email})`}
                      >
                        <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] overflow-hidden ring-1 ${
                          isActive ? 'ring-brand-secondary' : 'ring-slate-700'
                        }`}>
                          {photoURL
                            ? <img src={photoURL} alt="" className="w-5 h-5 rounded-full" />
                            : <span className="bg-slate-700 w-full h-full flex items-center justify-center">{(displayName?.[0] || member.email[0]).toUpperCase()}</span>
                          }
                        </div>
                        {name}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Active filters summary */}
              {activeFilterCount > 0 && (() => {
                const totalVisibleTasks = sortedProject.phases.reduce((sum: number, ph: Phase) => {
                  const countTasks = (tasks: Task[]): number => 
                    tasks.reduce((s, t) => s + 1 + (t.subTasks ? countTasks(t.subTasks) : 0), 0);
                  return sum + countTasks(ph.tasks || []);
                }, 0);
                return (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-slate-500">
                      Showing <span className="text-brand-light font-semibold">{totalVisibleTasks}</span> matching task{totalVisibleTasks !== 1 ? 's' : ''}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {viewMode === 'list' ? (
          <>
            {sortedProject.phases.map((phase, phaseIndex) => {
              const phaseConfig = getSectionStatusConfig(phase);
              const sectionIdLabel = `S${phaseIndex + 1}`;

              return (
              <div key={phase.id} id={`section-${phase.id}`} className="border-b border-slate-700 last:border-b-0 scroll-mt-24 transition-all duration-300 rounded-lg">
                <div
                  className="p-4 bg-slate-800 flex justify-between items-center group cursor-pointer hover:bg-slate-700/50 transition-colors"
                  onClick={(e) => {
                    // Only toggle if clicking on the header area itself, not on interactive elements
                    const target = e.target as HTMLElement;
                    if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('button') || target.closest('input')) {
                      return;
                    }
                    // Don't toggle if clicking on editable text (when not in edit mode, these trigger edit)
                    if (target.tagName === 'H4' || target.tagName === 'SPAN') {
                      return;
                    }
                    togglePhaseCollapse(phase.id);
                  }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePhaseCollapse(phase.id); }}
                    className="mr-2 text-slate-400 hover:text-white transition-colors flex-shrink-0"
                    title={collapsedPhases.has(phase.id) ? "Expand section" : "Collapse section"}
                  >
                    <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ${collapsedPhases.has(phase.id) ? '-rotate-90' : ''}`} />
                  </button>

                  {/* Section ID Badge */}
                  <span
                    className={`mr-2.5 px-2 py-0.5 text-xs font-bold rounded border ${phaseConfig.badgeBg} ${phaseConfig.badgeText} ${phaseConfig.badgeBorder} flex-shrink-0`}
                    title={`${sectionIdLabel} - ${phaseConfig.label} (${phaseConfig.completionPct}% complete)`}
                  >
                    {sectionIdLabel}
                  </span>

                  {/* Section Status Donut Chart */}
                  <SectionStatusDonut
                    tasks={phase.tasks}
                    size={46}
                    animationKey={phaseAnimationKeys[phase.id] || 0}
                  />

                  <div className="flex items-center gap-2 flex-grow min-w-0 ml-3">
                    {editingPhase?.id === phase.id && editingPhase.field === 'name' ? (
                      <input
                        type="text"
                        defaultValue={phase.name}
                        onBlur={(e) => handleUpdatePhase(phase.id, 'name', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingPhase(null); }}
                        className="bg-slate-700 border border-slate-600 text-white font-semibold text-md rounded-md p-1 w-full"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <h4 className="font-semibold text-md text-slate-300 cursor-pointer truncate" onClick={(e) => { e.stopPropagation(); checkPermission(phase.ownerId) && setEditingPhase({ id: phase.id, field: 'name' }); }} title={phase.name}>{phase.name}</h4>
                    )}

                    {editingPhase?.id === phase.id && editingPhase.field === 'weekRange' ? (
                      <input
                        type="text"
                        defaultValue={phase.weekRange}
                        onBlur={(e) => handleUpdatePhase(phase.id, 'weekRange', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingPhase(null); }}
                        className="bg-slate-700 border border-slate-600 text-slate-400 text-sm rounded-md p-1 w-24"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="text-sm text-slate-400 font-normal cursor-pointer flex-shrink-0" onClick={(e) => { e.stopPropagation(); checkPermission(phase.ownerId) && setEditingPhase({ id: phase.id, field: 'weekRange' }); }}>{phase.weekRange}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pl-2" onClick={(e) => e.stopPropagation()}>
                    {/* Phase Assignees */}
                    <div
                      className="flex -space-x-1 hover:space-x-1 transition-all mr-2 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!effectiveCanEdit) return;
                        setAssigningTo({
                          type: 'phase',
                          id: phase.id,
                          currentAssignees: phase.assignees || [],
                          name: phase.name,
                          hasChildren: phase.tasks && phase.tasks.length > 0
                        });
                      }}
                    >
                      {(phase.assignees && phase.assignees.length > 0) ? (
                        phase.assignees.slice(0, 3).map((assignee, i) => {
                          // Dynamic lookup for fresh data
                          const lookupName = getUserDisplayName(assignee.uid, assignee.email);
                          const lookupPhoto = getUserPhotoURL(assignee.uid, assignee.email);
                          const displayName = lookupName || assignee.displayName;
                          const photoURL = lookupPhoto || assignee.photoURL;

                          let name = displayName;
                          if (!name || name.includes('@')) {
                            name = assignee.email.split('@')[0];
                            name = name.charAt(0).toUpperCase() + name.slice(1);
                          }

                          return (
                            <div key={i} className="w-6 h-6 rounded-full bg-slate-700 border border-slate-800 flex items-center justify-center text-xs overflow-hidden"
                              title={`${name} (${assignee.email})`}>
                              {photoURL ? <img src={photoURL} alt="" className="w-6 h-6 rounded-full" /> : (displayName?.[0] || assignee.email[0]).toUpperCase()}
                            </div>
                          );
                        })
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-700/50 border border-slate-600 border-dashed flex items-center justify-center hover:border-brand-secondary hover:text-brand-secondary transition-colors" title="Assign Section">
                          <UserIcon className="w-3 h-3 text-slate-400" />
                        </div>
                      )}
                    </div>

                    {checkPermission(phase.ownerId) && (
                      <button onClick={() => handleRequestDeletePhase(phase)} className="text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                    {effectiveCanEdit && (
                      <button
                        onClick={() => {
                          if (collapsedPhases.has(phase.id)) {
                            togglePhaseCollapse(phase.id);
                          }
                          setAddingTaskToPhase(phase.id);
                        }}
                        className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-1 px-3 rounded-lg transition-colors text-sm shadow-sm"
                        title={`Add task to ${sectionIdLabel}`}
                      >
                        <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-brand-secondary border border-slate-600/60 leading-none">
                          {sectionIdLabel}
                        </span>
                        <PlusCircleIcon className="w-4 h-4 text-slate-300" />
                        <span>Add Task</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${collapsedPhases.has(phase.id) ? 'max-h-0 opacity-0' : 'max-h-[5000px] opacity-100'}`}>
                  {addingTaskToPhase === phase.id && (
                    <div className="p-4 pb-0">
                      <InlineTaskForm
                        onSave={(data) => handleSaveTask(phase.id, data)}
                        onCancel={() => setAddingTaskToPhase(null)}
                        placeholder={`New task in ${sectionIdLabel}...`}
                        teamMembers={availableTeamMembers}
                        getUserDisplayName={getUserDisplayName}
                        getUserPhotoURL={getUserPhotoURL}
                        sectionLabel={sectionIdLabel}
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="grid grid-cols-10 gap-4 text-sm mb-2 px-2" style={{ paddingLeft: '2.5rem' }}>
                      <SortableHeaderCell label="Task" sortKey="name" sortConfig={sortConfig} onSort={handleSort} className="col-span-4" />
                      <SortableHeaderCell label="Timeline" sortKey="startDate" sortConfig={sortConfig} onSort={handleSort} className="col-span-2" />
                      <SortableHeaderCell label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} className="col-span-1" />
                      <SortableHeaderCell label="Priority" sortKey="priority" sortConfig={sortConfig} onSort={handleSort} className="col-span-1" />
                      <SortableHeaderCell label="Details" sortKey="deliverables" sortConfig={sortConfig} onSort={handleSort} className="col-span-2" />
                    </div>
                    <ul className="space-y-2">
                      {phase.tasks.map(task => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          level={0}
                          isExpanded={expandedTasks.has(task.id)}
                          onToggleExpand={handleToggleExpand}
                          addingSubtaskTo={addingSubtaskTo}
                          setAddingSubtaskTo={setAddingSubtaskTo}
                          canEdit={effectiveCanEdit}
                          handleSaveSubtask={handleSaveSubtask}
                          editingField={editingField}
                          setEditingField={setEditingField}
                          handleUpdateTaskField={handleUpdateTaskField}
                          onRequestDelete={handleRequestDeleteTask}
                          checkPermission={checkPermission}
                          phaseId={phase.id}
                          onDragStart={handleDragStart}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                          onDragEnd={handleDragEnd}
                          onDragLeave={handleDragLeave}
                          draggedItemId={draggedItemId}
                          dropTarget={dropTarget}
                          onAssign={(task) => {
                            if (!effectiveCanEdit) return;
                            setAssigningTo({
                              type: 'task',
                              id: task.id,
                              currentAssignees: task.assignees || [],
                              name: task.name,
                              hasChildren: task.subTasks && task.subTasks.length > 0
                            });
                          }}
                          projectTeam={project.team?.members || []}
                          getUserDisplayName={getUserDisplayName}
                          getUserPhotoURL={getUserPhotoURL}
                          onImageUpload={handleTaskImageUpload}
                          onRemoveImage={handleRemoveTaskImage}
                          onViewImage={(url) => setViewingImage(url)}
                        />
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
          </>
        ) : (
          <GanttChart project={project} />
        )}
      </div>

      <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center">
          <h3 className="text-xl font-bold text-white mb-2 sm:mb-0">AI-Powered Analytics</h3>
          {effectiveCanEdit && <button
            onClick={handleGetInsights}
            disabled={isLoading}
            className="bg-brand-secondary hover:bg-blue-500 disabled:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-colors disabled:cursor-not-allowed"
          >
            <SparklesIcon className="w-5 h-5 mr-2" />
            {isLoading ? 'Analyzing...' : 'Get Insights'}
          </button>}
        </div>
        {!effectiveCanEdit && <p className="text-sm text-slate-400 mt-2">You don't have permission to run AI analysis.</p>}
        {isLoading && <div className="text-center p-8 text-slate-400">Generating insights, please wait...</div>}
        {aiInsight && (
          <div className="mt-4 prose prose-invert prose-sm max-w-none text-slate-300" dangerouslySetInnerHTML={{ __html: aiInsight.replace(/\n/g, '<br />') }}>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={!!taskToDeleteId}
        onClose={() => setTaskToDeleteId(null)}
        onConfirm={handleConfirmDeleteTask}
        title="Delete Task"
        message="Are you sure you want to delete this task and all its sub-tasks? This action cannot be undone."
      />

      <ConfirmationModal
        isOpen={!!phaseToDelete}
        onClose={() => setPhaseToDelete(null)}
        onConfirm={handleConfirmDeletePhase}
        title="Delete Section"
        message={<>Are you sure you want to delete the section "<strong>{phaseToDelete?.name}</strong>"? All tasks and sub-tasks within this section will also be deleted. This action cannot be undone.</>}
      />

      <ConfirmationModal
        isOpen={archiveConfirm.show}
        onClose={() => setArchiveConfirm({ show: false, action: 'archive' })}
        onConfirm={() => {
          handleArchive(archiveConfirm.action === 'archive');
          setArchiveConfirm({ show: false, action: 'archive' });
        }}
        title={archiveConfirm.action === 'archive' ? 'Archive Project' : 'Unarchive Project'}
        message={archiveConfirm.action === 'archive'
          ? <>Are you sure you want to archive "<strong>{project.name}</strong>"? Team members will no longer be able to make edits until the project is unarchived.</>
          : <>Are you sure you want to unarchive "<strong>{project.name}</strong>"? Team members will be able to resume making edits.</>
        }
      />

      {assigningTo && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4" onClick={() => setAssigningTo(null)}>
          <div onClick={e => e.stopPropagation()}>
            <ResponsibilitySelector
              teamMembers={project.team?.members || []}
              assignedMembers={assigningTo.currentAssignees}
              onSave={handleAssign}
              onCancel={() => setAssigningTo(null)}
              title={`Assign ${assigningTo.type === 'phase' ? 'Section' : 'Task'}: ${assigningTo.name}`}
              showPropagateOption={assigningTo.hasChildren}
              hasExistingChildren={assigningTo.hasChildren}
            />
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {viewingImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setViewingImage(null)}
        >
          <button
            onClick={() => setViewingImage(null)}
            className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-white" />
          </button>
          <img
            src={viewingImage}
            alt="Task image preview"
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

    </div>
  );
};

interface InfoCardProps {
  icon: React.ReactElement<{ className?: string }>;
  title: string;
  value: string;
}

const InfoCard: React.FC<InfoCardProps> = ({ icon, title, value }) => (
  <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex items-start space-x-4">
    <div className="bg-slate-700 p-3 rounded-lg text-brand-light">
      {React.cloneElement(icon, { className: "w-6 h-6" })}
    </div>
    <div>
      <h4 className="text-sm text-slate-400 font-medium">{title}</h4>
      <p className="text-base font-semibold text-white mt-1">{value}</p>
    </div>
  </div>
);

interface ViewModeButtonProps {
  icon: React.ReactElement<{ className?: string }>;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const ViewModeButton: React.FC<ViewModeButtonProps> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center space-x-2 px-3 py-1 text-sm rounded-md transition-colors ${isActive
      ? 'bg-brand-secondary text-white'
      : 'text-slate-400 hover:bg-slate-700 hover:text-white'
      }`}
  >
    {React.cloneElement(icon, { className: "w-4 h-4" })}
    <span>{label}</span>
  </button>
);


export default ProjectDetail;