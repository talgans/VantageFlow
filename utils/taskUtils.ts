import { Task, Project, TaskStatus } from '../types';

/**
 * Safely normalizes any date representation (Date instance, Firestore Timestamp, ISO string, etc.)
 * into a valid JavaScript Date object.
 */
export const ensureDate = (val: any): Date => {
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val;
  }
  if (val?.toDate && typeof val.toDate === 'function') {
    const d = val.toDate();
    if (d instanceof Date && !isNaN(d.getTime())) {
      return d;
    }
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
};

/**
 * Calculates a numerical progress percentage (0 - 100) for a task or subtask.
 */
export const getTaskProgressNumber = (task: Task): number => {
  if (!task.subTasks || task.subTasks.length === 0) {
    const s = task.status as string;
    if (s === TaskStatus.Hundred || s === 'Completed') return 100;
    if (s === TaskStatus.SeventyFive) return 75;
    if (s === TaskStatus.Fifty || s === 'In Progress') return 50;
    if (s === TaskStatus.TwentyFive) return 25;
    if (s === TaskStatus.AtRisk) return 50;
    const num = parseInt(s?.replace('%', '') || '0', 10);
    return isNaN(num) ? 0 : num;
  }
  const total = task.subTasks.reduce((sum, st) => sum + getTaskProgressNumber(st), 0);
  return Math.round(total / task.subTasks.length);
};

/**
 * Maps a numerical progress percentage to the appropriate TaskStatus enum value.
 */
export const getStatusFromProgress = (progress: number, hasBlocker = false): TaskStatus => {
  if (hasBlocker) return TaskStatus.AtRisk;
  if (progress >= 100) return TaskStatus.Hundred;
  if (progress >= 75) return TaskStatus.SeventyFive;
  if (progress >= 50) return TaskStatus.Fifty;
  if (progress >= 25) return TaskStatus.TwentyFive;
  return TaskStatus.Zero;
};

/**
 * Recursively calculates the effective date range for a task.
 * If the task has subtasks:
 * - startDate is the earliest startDate among its subtasks (recursively)
 * - endDate is the latest endDate (final date) among its subtasks (recursively)
 * If the task has no subtasks, returns its own startDate and endDate.
 */
export const getRolledUpTaskDates = (task: Task): { startDate: Date; endDate: Date } => {
  const currentStart = ensureDate(task.startDate);
  const currentEnd = ensureDate(task.endDate);

  if (!task.subTasks || task.subTasks.length === 0) {
    return { startDate: currentStart, endDate: currentEnd };
  }

  let minStart = Infinity;
  let maxEnd = -Infinity;

  for (const subTask of task.subTasks) {
    const subDates = getRolledUpTaskDates(subTask);
    const s = subDates.startDate.getTime();
    const e = subDates.endDate.getTime();
    if (s < minStart) minStart = s;
    if (e > maxEnd) maxEnd = e;
  }

  return {
    startDate: minStart !== Infinity ? new Date(minStart) : currentStart,
    endDate: maxEnd !== -Infinity ? new Date(maxEnd) : currentEnd,
  };
};

/**
 * Recursively updates task startDate, endDate, and status to match rolled-up subtask values.
 * Returns a new Task object with updated dates, rolled-up status, and recursively synced subtasks.
 */
export const syncTaskDates = (task: Task): Task => {
  if (!task.subTasks || task.subTasks.length === 0) {
    return {
      ...task,
      startDate: ensureDate(task.startDate),
      endDate: ensureDate(task.endDate),
    };
  }

  const syncedSubTasks = task.subTasks.map(syncTaskDates);
  const { startDate, endDate } = getRolledUpTaskDates({
    ...task,
    subTasks: syncedSubTasks,
  });

  const progress = Math.round(
    syncedSubTasks.reduce((sum, st) => sum + getTaskProgressNumber(st), 0) / syncedSubTasks.length
  );
  const hasActiveBlocker = syncedSubTasks.some(
    st => st.status === TaskStatus.AtRisk || (st.impediment && !st.impediment.resolved)
  );
  const rolledUpStatus = getStatusFromProgress(progress, hasActiveBlocker);

  return {
    ...task,
    startDate,
    endDate,
    status: rolledUpStatus,
    completedAt: rolledUpStatus === TaskStatus.Hundred ? (task.completedAt || new Date()) : undefined,
    completedBy: rolledUpStatus === TaskStatus.Hundred ? task.completedBy : undefined,
    subTasks: syncedSubTasks,
  };
};

/**
 * Recursively synchronizes all parent task start/end dates and statuses across all phases of a project.
 */
export const syncProjectTaskDates = (project: Project): Project => {
  if (!project.phases || !Array.isArray(project.phases)) {
    return project;
  }

  return {
    ...project,
    phases: project.phases.map(phase => ({
      ...phase,
      tasks: (phase.tasks || []).map(syncTaskDates),
    })),
  };
};
