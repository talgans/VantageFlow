import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
  QuerySnapshot,
  DocumentData,
  getDoc,
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from './firebaseConfig';
import { Project, Task, DurationUnit, Currency, UserRole } from '../types';
import { MOCK_PROJECTS } from '../constants/mockData';

/**
 * Convert Firestore Timestamps to Date objects recursively for tasks
 */
export const convertTaskDatesFromFirestore = (task: any): Task => {
  return {
    ...task,
    startDate: task.startDate?.toDate ? task.startDate.toDate() : new Date(task.startDate || Date.now()),
    endDate: task.endDate?.toDate ? task.endDate.toDate() : new Date(task.endDate || Date.now()),
    subTasks: task.subTasks?.map(convertTaskDatesFromFirestore),
  };
};

/**
 * Convert Date objects to Firestore Timestamps recursively for tasks
 */
export const convertTaskDatesToFirestore = (task: Task): any => {
  const ensureDate = (dateValue: any): Date => {
    if (dateValue instanceof Date) return dateValue;
    if (dateValue?.toDate && typeof dateValue.toDate === 'function') return dateValue.toDate();
    return new Date(dateValue || Date.now());
  };

  const converted: any = {
    ...task,
    startDate: Timestamp.fromDate(ensureDate(task.startDate)),
    endDate: Timestamp.fromDate(ensureDate(task.endDate)),
  };

  if (task.subTasks && task.subTasks.length > 0) {
    converted.subTasks = task.subTasks.map(convertTaskDatesToFirestore);
  } else {
    delete converted.subTasks;
  }

  return converted;
};

/**
 * Convert Firestore document to Project type
 */
export const convertFirestoreDocToProject = (docData: DocumentData): Project => {
  let duration = 0;
  if (typeof docData.duration === 'number') {
    duration = docData.duration;
  } else if (typeof docData.duration === 'string') {
    const match = docData.duration.match(/(\d+)/);
    duration = match ? parseInt(match[1]) : 1;
  }

  let createdAt: Date | undefined;
  if (docData.createdAt?.toDate && typeof docData.createdAt.toDate === 'function') {
    createdAt = docData.createdAt.toDate();
  } else if (docData.createdAt) {
    createdAt = new Date(docData.createdAt);
  }

  const team = docData.team || {};
  const normalizedTeam = {
    members: team.members || [],
    name: team.name,
    size: team.size,
    manager: team.manager,
  };

  return {
    id: docData.id,
    name: docData.name || '',
    description: docData.description || '',
    coreSystem: docData.coreSystem || '',
    startDate: docData.startDate?.toDate ? docData.startDate.toDate() : new Date(docData.startDate || Date.now()),
    duration,
    durationUnit: docData.durationUnit || DurationUnit.Weeks,
    team: normalizedTeam,
    cost: docData.cost || 0,
    currency: docData.currency || Currency.NGN,
    phases: (docData.phases || []).map((phase: any) => ({
      ...phase,
      tasks: (phase.tasks || []).map(convertTaskDatesFromFirestore),
    })),
    ownerId: docData.ownerId,
    ownerEmail: docData.ownerEmail,
    ownerName: docData.ownerName,
    ownerPhotoURL: docData.ownerPhotoURL,
    createdAt,
    memberUids: docData.memberUids || [],
    isArchived: Boolean(docData.isArchived),
  };
};

/**
 * Check if Firestore is reachable / configured
 */
export const isFirestoreAvailable = (): boolean => {
  return isFirebaseConfigured();
};

/**
 * Subscribe to projects based on user authentication and RBAC
 */
export const subscribeToUserProjects = (
  userId: string,
  isAdmin: boolean,
  onProjectsUpdated: (projects: Project[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  if (!isFirestoreAvailable() || !auth?.currentUser) {
    console.log('[Firestore] Using mock data (Demo/Offline user)');
    onProjectsUpdated(MOCK_PROJECTS);
    return () => {};
  }

  try {
    const projectsRef = collection(db, 'projects');
    const q = isAdmin
      ? query(projectsRef, orderBy('createdAt', 'desc'))
      : query(projectsRef, where('memberUids', 'array-contains', userId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const projects: Project[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const project = convertFirestoreDocToProject({ ...data, id: docSnap.id });
          projects.push(project);
        });

        if (!isAdmin) {
          projects.sort((a, b) => {
            const aTime = a.createdAt?.getTime() || 0;
            const bTime = b.createdAt?.getTime() || 0;
            return bTime - aTime;
          });
        }

        onProjectsUpdated(projects);
      },
      (error) => {
        console.warn('[Firestore] Realtime subscription error, using fallback:', error);
        onProjectsUpdated(MOCK_PROJECTS);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (err: any) {
    console.warn('[Firestore] Setup error:', err);
    onProjectsUpdated(MOCK_PROJECTS);
    return () => {};
  }
};

/**
 * Update project in Firestore
 */
export const updateProject = async (project: Project): Promise<void> => {
  if (!isFirestoreAvailable()) {
    console.log('[Firestore] Mock update for project:', project.name);
    return;
  }

  const projectRef = doc(db, 'projects', project.id);
  const convertedPhases = project.phases.map((phase) => ({
    ...phase,
    tasks: phase.tasks.map(convertTaskDatesToFirestore),
  }));

  const memberUids = project.team.members.map((m) => m.uid);
  if (project.ownerId && !memberUids.includes(project.ownerId)) {
    memberUids.push(project.ownerId);
  }

  await updateDoc(projectRef, {
    name: project.name,
    description: project.description,
    coreSystem: project.coreSystem,
    startDate: Timestamp.fromDate(project.startDate),
    duration: project.duration,
    durationUnit: project.durationUnit,
    team: project.team,
    cost: project.cost,
    currency: project.currency,
    phases: convertedPhases,
    memberUids,
    isArchived: Boolean(project.isArchived),
  });
};
