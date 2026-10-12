import { Project } from '../types';

const ACCESS_STORAGE_PREFIX = 'vf_recent_access_';

/**
 * Record that a project was accessed by the user at the current time.
 */
export const recordProjectAccess = (projectId: string, userId?: string): void => {
  if (!projectId) return;
  try {
    const key = userId ? `${ACCESS_STORAGE_PREFIX}${userId}` : 'vf_recent_access_global';
    const raw = localStorage.getItem(key);
    const data: Record<string, number> = raw ? JSON.parse(raw) : {};
    data[projectId] = Date.now();
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to record project access to localStorage:', error);
  }
};

/**
 * Get the timestamp (ms) when a project was last accessed by the user.
 */
export const getProjectAccessTime = (projectId: string, userId?: string): number => {
  if (!projectId) return 0;
  try {
    const key = userId ? `${ACCESS_STORAGE_PREFIX}${userId}` : 'vf_recent_access_global';
    const raw = localStorage.getItem(key);
    if (raw) {
      const data: Record<string, number> = JSON.parse(raw);
      if (typeof data[projectId] === 'number') {
        return data[projectId];
      }
    }
  } catch (error) {
    // ignore
  }
  return 0;
};

/**
 * Calculate the best access/activity timestamp for a project.
 * Priority: user's local access time > lastAccessedAt > updatedAt > createdAt > startDate.
 */
export const getProjectLastAccessedScore = (project: Project, userId?: string): number => {
  const localAccess = getProjectAccessTime(project.id, userId);
  if (localAccess > 0) return localAccess;

  const lastAccessedAt = (project as any).lastAccessedAt;
  if (lastAccessedAt) {
    if (lastAccessedAt instanceof Date) return lastAccessedAt.getTime();
    if (typeof lastAccessedAt.toDate === 'function') return lastAccessedAt.toDate().getTime();
    const parsed = new Date(lastAccessedAt).getTime();
    if (!isNaN(parsed)) return parsed;
  }

  const updatedAt = (project as any).updatedAt;
  if (updatedAt) {
    if (updatedAt instanceof Date) return updatedAt.getTime();
    if (typeof updatedAt.toDate === 'function') return updatedAt.toDate().getTime();
    const parsed = new Date(updatedAt).getTime();
    if (!isNaN(parsed)) return parsed;
  }

  if (project.createdAt) {
    if (project.createdAt instanceof Date) return project.createdAt.getTime();
    if (typeof (project.createdAt as any).toDate === 'function') return (project.createdAt as any).toDate().getTime();
    const parsed = new Date(project.createdAt).getTime();
    if (!isNaN(parsed)) return parsed;
  }

  if (project.startDate) {
    if (project.startDate instanceof Date) return project.startDate.getTime();
    const parsed = new Date(project.startDate).getTime();
    if (!isNaN(parsed)) return parsed;
  }

  return 0;
};

/**
 * Sort projects:
 * 1. Live (non-archived) projects first, sorted by most recent access descending.
 * 2. Archived projects last, greyed out, sorted by most recent access descending.
 */
export const sortProjectsByRecentAccess = (projects: Project[], userId?: string): Project[] => {
  return [...projects].sort((a, b) => {
    const aArchived = a.isArchived === true;
    const bArchived = b.isArchived === true;

    // Archived projects go to the bottom
    if (aArchived !== bArchived) {
      return aArchived ? 1 : -1;
    }

    const aScore = getProjectLastAccessedScore(a, userId);
    const bScore = getProjectLastAccessedScore(b, userId);
    return bScore - aScore;
  });
};
