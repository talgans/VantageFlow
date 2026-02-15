import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Project, Task, TaskStatus, Phase, DurationUnit, Currency, TeamMember } from '../types';
import StatusBadge from './StatusBadge';
import CircularProgress from './CircularProgress';
import ResponsibilitySelector from './ResponsibilitySelector';
import { notificationService } from '../services/notificationService';
import { achievementService } from '../services/achievementService';
import { getProjectInsights } from '../services/geminiService';
import { ArrowLeftIcon, SparklesIcon, InfoIcon, TeamIcon, CalendarIcon, MoneyIcon, CheckCircleIcon, PlusCircleIcon, ChevronRightIcon, ChevronDownIcon, ListBulletIcon, ChartBarIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, GripVerticalIcon, StarIcon, UserIcon, WhatsAppIcon } from './icons';
import GanttChart from './GanttChart';
import ConfirmationModal from './ConfirmationModal';
import { useUserLookup } from '../hooks/useUserLookup';
import SectionStatusDonut from './charts/SectionStatusDonut';
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

type SortKey = 'name' | 'startDate' | 'status' | 'deliverables';
type SortDirection = 'ascending' | 'descending';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

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


const InlineTaskForm: React.FC<{
  onSave: (name: string) => void;
  onCancel: () => void;
  placeholder: string;
  className?: string;
}> = ({ onSave, onCancel, placeholder, className }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
      setName('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`flex items-center gap-2 ${className || ''}`}>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={placeholder}
        className="bg-slate-700 border border-slate-600 text-white text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
        autoFocus
      />
      <button type="submit" className="px-3 py-2 text-sm font-medium text-white bg-brand-secondary rounded-md hover:bg-blue-500">Save</button>
      <button type="button" onClick={onCancel} className="px-3 py-2 text-sm font-medium text-slate-300 bg-slate-700 rounded-md hover:bg-slate-600">Cancel</button>
    </form>
  )
}

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
  handleSaveSubtask: (parentTaskId: string, subTaskName: string) => void;
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
}

const TaskRow: React.FC<TaskRowProps> = ({ task, level, isExpanded, onToggleExpand, addingSubtaskTo, setAddingSubtaskTo, canEdit, handleSaveSubtask, editingField, setEditingField, handleUpdateTaskField, onRequestDelete, phaseId, parentId, onDragStart, onDragOver, onDrop, onDragEnd, onDragLeave, draggedItemId, dropTarget, checkPermission, onAssign, projectTeam, getUserDisplayName, getUserPhotoURL }) => {
  const hasSubtasks = task.subTasks && task.subTasks.length > 0;
  const formatDate = (date: Date) => new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric' });
  const isEditing = (field: string) => editingField?.taskId === task.id && editingField?.field === field;
  const progress = calculateTaskProgress(task);

  // Calculate permission for this specific task
  const canEditTask = canEdit && checkPermission(task.ownerId);

  const isBeingDragged = draggedItemId === task.id;
  const isDropTargetAbove = dropTarget?.taskId === task.id && dropTarget.position === 'above';
  const isDropTargetBelow = dropTarget?.taskId === task.id && dropTarget.position === 'below';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setEditingField(null);
    }
  }

  return (
    <>
      {isDropTargetAbove && <li className="h-0.5 bg-brand-secondary list-none" style={{ marginLeft: `${level * 2}rem` }} />}
      <li
        className={`bg-slate-800 rounded-lg p-2 grid grid-cols-10 gap-4 items-center transition-opacity ${isBeingDragged ? 'opacity-30' : 'opacity-100'}`}
        style={{ marginLeft: `${level * 2}rem` }}
        draggable={canEditTask}
        onDragStart={(e) => onDragStart(e, task, phaseId, parentId)}
        onDragOver={(e) => onDragOver(e, task, phaseId, parentId)}
        onDrop={(e) => onDrop(e, task, phaseId, parentId)}
        onDragEnd={onDragEnd}
        onDragLeave={onDragLeave}
      >
        <div className="col-span-4 text-white font-medium flex items-center">
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

          <div className="w-full">
            {isEditing('name') ? (
              <input
                type="text"
                defaultValue={task.name}
                onBlur={(e) => handleUpdateTaskField(task.id, 'name', e.target.value)}
                onKeyDown={handleKeyDown}
                className="bg-slate-700 border border-slate-600 text-white text-sm rounded-md block w-full p-1"
                autoFocus
              />
            ) : (
              <span className="w-full cursor-pointer" onClick={() => canEditTask && setEditingField({ taskId: task.id, field: 'name' })}>{task.name}</span>
            )}
            <TaskProgressBar progress={progress} status={task.status} useProgressColor={hasSubtasks} />
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

        <div className="col-span-2 relative">
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
          onSave={(name) => handleSaveSubtask(task.id, name)}
          onCancel={() => setAddingSubtaskTo(null)}
          placeholder="New sub-task name"
          className="mt-2 ml-12"
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
      <button onClick={() => onSort(sortKey)} className="flex items-center space-x-1 font-medium text-slate-400 hover:text-slate-200 transition-colors group">
        <span className="group-hover:text-white">{label}</span>
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
  const [editingPhase, setEditingPhase] = useState<{ id: string; field: 'name' | 'weekRange' } | null>(null);
  const [editingInfoCard, setEditingInfoCard] = useState<'duration' | 'cost' | 'team' | null>(null);
  const [phaseToDelete, setPhaseToDelete] = useState<Phase | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<{ show: boolean; action: 'archive' | 'unarchive' }>({ show: false, action: 'archive' });

  const [assigningTo, setAssigningTo] = useState<{
    type: 'phase' | 'task';
    id: string;
    currentAssignees: TeamMember[];
    name: string;
    hasChildren: boolean;
  } | null>(null);

  // --- Accordion State ---
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
      phase.tasks = sortTasks(phase.tasks || [], sortConfig);
    });
    return projectCopy;
  }, [project, sortConfig]);

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
    const member = project.team?.members?.find(m => m.uid === currentUserId);
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

  const handleSaveTask = (phaseId: string, taskName: string) => {
    if (!taskName.trim()) return;

    const newTask: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: taskName.trim(),
      status: TaskStatus.Zero,
      startDate: new Date(),
      endDate: new Date(new Date().setDate(new Date().getDate() + 7)),
      ownerId: currentUserId,
      ownerEmail: currentUserEmail,
    };

    const updatedProject = JSON.parse(JSON.stringify(project), reviveDates);

    const phase = updatedProject.phases.find((p: Phase) => p.id === phaseId);
    if (phase) {
      phase.tasks.push(newTask);
    }

    onUpdateProject(updatedProject);
    setAddingTaskToPhase(null);
  };

  const handleSaveSubtask = (parentTaskId: string, subTaskName: string) => {
    if (!subTaskName.trim()) return;

    const newSubTask: Task = {
      id: `subtask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: subTaskName.trim(),
      status: TaskStatus.Zero,
      startDate: new Date(),
      endDate: new Date(new Date().setDate(new Date().getDate() + 7)),
      ownerId: currentUserId,
      ownerEmail: currentUserEmail,
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
    <div className="space-y-8">
      <button onClick={onBack} className="flex items-center space-x-2 text-brand-light hover:text-white transition-colors">
        <ArrowLeftIcon className="w-5 h-5" />
        <span>Back to Projects</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Title & Description Card */}
        <div className={`col-span-1 lg:col-span-2 p-6 rounded-xl border ${project.isArchived
          ? 'bg-amber-500/10 border-amber-500/50'
          : 'bg-slate-800/50 border-slate-700'}`}>
          {/* Archived Notice */}
          {project.isArchived && (
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-amber-500/30">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <span className="text-amber-200 font-medium flex-1">This project is archived. No edits can be made until it is unarchived.</span>
              {canArchive && (
                <button
                  onClick={() => setArchiveConfirm({ show: true, action: 'unarchive' })}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-lg transition-colors"
                >
                  Unarchive
                </button>
              )}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <CircularProgress
                percentage={(() => {
                  const allTasks = (project.phases || []).flatMap(ph =>
                    (ph.tasks || []).flatMap(t => t.subTasks ? [t, ...t.subTasks] : [t])
                  );
                  if (allTasks.length === 0) return 0;
                  const completed = allTasks.filter(t => t.status === TaskStatus.Hundred || (t.status as string) === 'Completed').length;
                  return Math.round((completed / allTasks.length) * 100);
                })()}
                size={60}
              />
              <div>
                <h2 className="text-3xl font-bold text-white">{project.name}</h2>
                {project.ownerId && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-slate-400">Owner:</span>
                    {getUserPhotoURL(project.ownerId, project.ownerEmail) ? (
                      <img src={getUserPhotoURL(project.ownerId, project.ownerEmail)} alt="Owner" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-brand-secondary/30 flex items-center justify-center">
                        <UserIcon className="w-3 h-3 text-brand-light" />
                      </div>
                    )}
                    <span className="text-sm text-brand-light">{getUserDisplayName(project.ownerId, project.ownerEmail) || project.ownerEmail}</span>
                  </div>
                )}
              </div>
            </div>
            {/* Archive Button - visible to owner/admin when not archived */}
            {canArchive && !project.isArchived && (
              <button
                onClick={() => setArchiveConfirm({ show: true, action: 'archive' })}
                className="ml-4 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
                title="Archive Project"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Archive
              </button>
            )}
          </div>
          <p className="text-slate-400 mt-4 max-w-4xl">{project.description}</p>
        </div>

        {/* Section Progress Stats Card */}
        {/* Section Progress Stats Card */}
        <div className="col-span-1 bg-slate-800/50 rounded-xl border border-slate-700 p-6">
          <div className="grid grid-cols-2 h-full gap-4">
            {/* Left Column: Stats */}
            <div className="flex flex-col justify-center items-center space-y-6">
              {/* Sections Count */}
              <div className="text-center">
                <p className="text-4xl font-bold text-white">{(project.phases || []).length}</p>
                <span className="text-sm text-slate-400 font-medium">Sections</span>
              </div>
              {/* Tasks Count */}
              <div className="text-center">
                <p className="text-4xl font-bold text-white">
                  {(project.phases || []).reduce((acc, phase) =>
                    acc + (phase.tasks || []).reduce((taskAcc, task) =>
                      taskAcc + 1 + (task.subTasks?.length || 0), 0), 0)}
                </p>
                <span className="text-sm text-slate-400 font-medium">Tasks</span>
              </div>
            </div>

            {/* Right Column: Chart */}
            <div className="flex flex-col items-center justify-center">
              <div className="flex gap-2 items-end h-16">
                {(project.phases || []).length === 0 ? (
                  <div className="w-8 h-full bg-slate-600 rounded-md" title="No sections" />
                ) : (project.phases || []).map((phase) => {
                  const allTasks = (phase.tasks || []).flatMap(t => t.subTasks ? [t, ...t.subTasks] : [t]);
                  const totalTasks = allTasks.length;
                  if (totalTasks === 0) {
                    return (
                      <div key={phase.id} className="w-8 h-full bg-slate-600 rounded-md" title={`${phase.name}: No tasks`} />
                    );
                  }

                  const statusCounts = {
                    hundred: allTasks.filter(t => t.status === TaskStatus.Hundred || (t.status as string) === 'Completed').length,
                    seventyFive: allTasks.filter(t => t.status === TaskStatus.SeventyFive).length,
                    fifty: allTasks.filter(t => t.status === TaskStatus.Fifty || (t.status as string) === 'In Progress').length,
                    twentyFive: allTasks.filter(t => t.status === TaskStatus.TwentyFive).length,
                    atRisk: allTasks.filter(t => t.status === TaskStatus.AtRisk).length,
                    zero: allTasks.filter(t => t.status === TaskStatus.Zero || (t.status as string) === 'Not Started').length,
                  };

                  const pcts = {
                    hundred: (statusCounts.hundred / totalTasks) * 100,
                    seventyFive: (statusCounts.seventyFive / totalTasks) * 100,
                    fifty: (statusCounts.fifty / totalTasks) * 100,
                    twentyFive: (statusCounts.twentyFive / totalTasks) * 100,
                    atRisk: (statusCounts.atRisk / totalTasks) * 100,
                    zero: (statusCounts.zero / totalTasks) * 100,
                  };

                  const completionPct = Math.round((statusCounts.hundred / totalTasks) * 100);

                  return (
                    <div
                      key={phase.id}
                      className="w-8 h-full bg-slate-700/50 rounded-md overflow-hidden flex flex-col-reverse"
                      title={`${phase.name}: ${completionPct}% complete (${statusCounts.hundred}/${totalTasks} tasks)`}
                    >
                      {pcts.hundred > 0 && <div className="bg-green-400" style={{ height: `${pcts.hundred}%` }} />}
                      {pcts.seventyFive > 0 && <div className="bg-indigo-400" style={{ height: `${pcts.seventyFive}%` }} />}
                      {pcts.fifty > 0 && <div className="bg-blue-400" style={{ height: `${pcts.fifty}%` }} />}
                      {pcts.twentyFive > 0 && <div className="bg-amber-400" style={{ height: `${pcts.twentyFive}%` }} />}
                      {pcts.atRisk > 0 && <div className="bg-red-400" style={{ height: `${pcts.atRisk}%` }} />}
                      {pcts.zero > 0 && <div className="bg-gray-400" style={{ height: `${pcts.zero}%` }} />}
                    </div>
                  );
                })}
              </div>
              <span className="text-lg font-medium text-slate-300 mt-3">Section Progress</span>
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
            <div className="flex items-center rounded-lg bg-slate-900 p-1">
              <ViewModeButton icon={<ListBulletIcon />} label="List" isActive={viewMode === 'list'} onClick={() => setViewMode('list')} />
              <ViewModeButton icon={<ChartBarIcon />} label="Gantt" isActive={viewMode === 'gantt'} onClick={() => setViewMode('gantt')} />
            </div>
          </div>
        </div>

        {viewMode === 'list' ? (
          <>
            {sortedProject.phases.map(phase => (
              <div key={phase.id} className="border-b border-slate-700 last:border-b-0">
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
                  >
                    <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ${collapsedPhases.has(phase.id) ? '-rotate-90' : ''}`} />
                  </button>

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
                      <button onClick={() => setAddingTaskToPhase(phase.id)} className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-1 px-3 rounded-lg transition-colors text-sm">
                        <PlusCircleIcon className="w-4 h-4" />
                        <span>Add Item</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${collapsedPhases.has(phase.id) ? 'max-h-0 opacity-0' : 'max-h-[5000px] opacity-100'}`}>
                  {addingTaskToPhase === phase.id && (
                    <div className="p-4 pb-0">
                      <InlineTaskForm
                        onSave={(name) => handleSaveTask(phase.id, name)}
                        onCancel={() => setAddingTaskToPhase(null)}
                        placeholder="New task name"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="grid grid-cols-10 gap-4 text-sm mb-2 px-2" style={{ paddingLeft: '2.5rem' }}>
                      <SortableHeaderCell label="Task" sortKey="name" sortConfig={sortConfig} onSort={handleSort} className="col-span-4" />
                      <SortableHeaderCell label="Timeline" sortKey="startDate" sortConfig={sortConfig} onSort={handleSort} className="col-span-2" />
                      <SortableHeaderCell label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} className="col-span-2" />
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
                        />
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
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