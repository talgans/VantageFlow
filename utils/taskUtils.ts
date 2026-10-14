import { Task, Project } from '../types';

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
 * Recursively updates task startDate and endDate to match the rolled-up subtask dates.
 * Returns a new Task object with updated dates and recursively synced subtasks.
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

  return {
    ...task,
    startDate,
    endDate,
    subTasks: syncedSubTasks,
  };
};

/**
 * Recursively synchronizes all parent task start and end dates across all phases of a project.
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
