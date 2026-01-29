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
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Project, Task, DurationUnit, Currency } from '../types';

/**
 * Convert Firestore Timestamps to Date objects recursively for tasks
 */
const convertTaskDatesFromFirestore = (task: any): Task => {
  return {
    ...task,
    startDate: task.startDate?.toDate() || new Date(),
    endDate: task.endDate?.toDate() || new Date(),
    subTasks: task.subTasks?.map(convertTaskDatesFromFirestore),
  };
};

/**
 * Convert Date objects to Firestore Timestamps recursively for tasks
 */
const convertTaskDatesToFirestore = (task: Task): any => {
  // Helper function to ensure we have a valid Date object
  const ensureDate = (dateValue: any): Date => {
    if (dateValue instanceof Date) {
      return dateValue;
    }
    if (dateValue?.toDate && typeof dateValue.toDate === 'function') {
      // Firestore Timestamp
      return dateValue.toDate();
    }
    // Try to parse as string or number
    return new Date(dateValue);
  };

  const converted: any = {
    ...task,
    startDate: Timestamp.fromDate(ensureDate(task.startDate)),
    endDate: Timestamp.fromDate(ensureDate(task.endDate)),
  };

  // Only include subTasks if they exist
  if (task.subTasks && task.subTasks.length > 0) {
    converted.subTasks = task.subTasks.map(convertTaskDatesToFirestore);
  } else {
    // Remove subTasks field if empty or undefined
    delete converted.subTasks;
  }

  return converted;
};

/**
 * Convert Firestore document to Project type
 */
const convertFirestoreDocToProject = (docData: DocumentData): Project => {
  // Handle duration conversion (old format was string like "1 wk", new is number)
  let duration = 0;
  if (typeof docData.duration === 'number') {
    duration = docData.duration;
  } else if (typeof docData.duration === 'string') {
    // Try to extract number from string like "1 wk" or "2 Months"
    const match = docData.duration.match(/(\d+)/);
    duration = match ? parseInt(match[1]) : 1;
  }

  // Handle createdAt conversion (might be Timestamp, string, or undefined)
  let createdAt: Date | undefined;
  if (docData.createdAt?.toDate && typeof docData.createdAt.toDate === 'function') {
    createdAt = docData.createdAt.toDate();
  } else if (docData.createdAt) {
    createdAt = new Date(docData.createdAt);
  }

  // Handle team - support both new format (members array) and legacy (name/size/manager)
  const team = docData.team || {};
  const normalizedTeam = {
    members: team.members || [],
    // Keep legacy fields for backward compatibility
    name: team.name,
    size: team.size,
    manager: team.manager,
  };

  const converted: any = {
    ...docData,
    startDate: docData.startDate?.toDate() || new Date(),
    duration: duration,
    durationUnit: docData.durationUnit || DurationUnit.Weeks,
    team: normalizedTeam,
    cost: typeof docData.cost === 'number' ? docData.cost : Number(docData.cost) || 0,
    currency: docData.currency || Currency.NGN,
    createdAt: createdAt,
    phases: docData.phases?.map((phase: any) => ({
      ...phase,
      tasks: phase.tasks?.map(convertTaskDatesFromFirestore) || [],
    })) || [],
  };
  return converted as Project;
};

/**
 * Convert Project to Firestore-compatible format
 * Filters out undefined values and converts dates
 */
const convertProjectToFirestore = (project: Omit<Project, 'id'> | Project): any => {
  try {
    console.log('Converting project to Firestore format:', project);

    // Ensure startDate is a valid Date object
    const startDate = project.startDate instanceof Date
      ? project.startDate
      : new Date(project.startDate);

    if (isNaN(startDate.getTime())) {
      throw new Error('Invalid start date');
    }

    // Helper to remove undefined values from an object
    const removeUndefined = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (Array.isArray(obj)) {
        return obj.map(removeUndefined);
      }
      if (typeof obj === 'object' && !(obj instanceof Timestamp) && !(obj instanceof Date)) {
        const cleaned: any = {};
        Object.keys(obj).forEach(key => {
          if (obj[key] !== undefined) {
            cleaned[key] = removeUndefined(obj[key]);
          }
        });
        return cleaned;
      }
      return obj;
    };

    // Prepare team data, ensuring members array exists
    const teamData = {
      members: project.team?.members || [],
      ...(project.team?.name && { name: project.team.name }),
      ...(project.team?.size !== undefined && { size: project.team.size }),
      ...(project.team?.manager && { manager: project.team.manager }),
    };

    const data: any = {
      name: project.name,
      description: project.description,
      coreSystem: project.coreSystem || '',
      startDate: Timestamp.fromDate(startDate),
      duration: project.duration || 0,
      durationUnit: project.durationUnit || DurationUnit.Weeks,
      team: teamData,
      cost: typeof project.cost === 'number' ? project.cost : 0,
      currency: project.currency || Currency.NGN,
      phases: project.phases.map((phase) => {
        const phaseData: any = {
          id: phase.id,
          name: phase.name,
          weekRange: phase.weekRange || 'TBD',
          tasks: phase.tasks.map(convertTaskDatesToFirestore),
        };
        // Only add optional fields if they have values
        if (phase.ownerId) phaseData.ownerId = phase.ownerId;
        if (phase.ownerEmail) phaseData.ownerEmail = phase.ownerEmail;
        if (phase.assignees && phase.assignees.length > 0) phaseData.assignees = phase.assignees;
        return phaseData;
      }),
      updatedAt: Timestamp.now(),
    };

    // Only add optional fields if defined
    if (project.ownerId) data.ownerId = project.ownerId;
    if (project.ownerEmail) data.ownerEmail = project.ownerEmail;

    // RBAC: Compute memberUids from team members + owner for efficient security rules
    const memberUids = new Set<string>();
    if (project.ownerId) {
      memberUids.add(project.ownerId);
    }
    (project.team?.members || []).forEach((m: any) => {
      if (m.uid) memberUids.add(m.uid);
    });
    data.memberUids = Array.from(memberUids);

    // Project Lifecycle: Archive fields
    if ((project as any).isArchived !== undefined) {
      data.isArchived = (project as any).isArchived;
    }
    if ((project as any).archivedAt) {
      const archivedAt = (project as any).archivedAt;
      data.archivedAt = archivedAt instanceof Date ? Timestamp.fromDate(archivedAt) : archivedAt;
    }
    if ((project as any).archivedBy) {
      data.archivedBy = (project as any).archivedBy;
    }

    console.log('Converted Firestore data:', data);

    // Final cleanup - remove any remaining undefined values recursively
    const cleanedData = removeUndefined(data);

    return cleanedData;
  } catch (error) {
    console.error('Error converting project to Firestore:', error);
    throw error;
  }
};

/**
 * Subscribe to real-time project updates
 * Returns unsubscribe function
 * 
 * @deprecated Use subscribeToUserProjects for RBAC-aware subscription
 */
export const subscribeToProjects = (
  callback: (projects: Project[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const projectsQuery = query(
    collection(db, 'projects'),
    orderBy('createdAt', 'desc')
  );

  const unsubscribe = onSnapshot(
    projectsQuery,
    (snapshot: QuerySnapshot) => {
      const projects: Project[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...convertFirestoreDocToProject(data),
        };
      });
      callback(projects);
    },
    (error) => {
      console.error('Error in projects subscription:', error);
      if (onError) {
        onError(error);
      }
    }
  );

  return unsubscribe;
};

/**
 * RBAC-aware subscription: Only returns projects where user is in memberUids
 * Admins see all projects.
 * 
 * @param userUid - The current user's UID
 * @param isAdmin - Whether the user is an admin
 * @param callback - Callback with filtered projects
 * @param onError - Error callback
 */
export const subscribeToUserProjects = (
  userUid: string,
  isAdmin: boolean,
  callback: (projects: Project[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  let projectsQuery;

  if (isAdmin) {
    // Admins see all projects
    projectsQuery = query(
      collection(db, 'projects'),
      orderBy('createdAt', 'desc')
    );
  } else {
    // Non-admins only see projects where they are in memberUids
    projectsQuery = query(
      collection(db, 'projects'),
      where('memberUids', 'array-contains', userUid)
    );
  }

  const unsubscribe = onSnapshot(
    projectsQuery,
    (snapshot: QuerySnapshot) => {
      const projects: Project[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...convertFirestoreDocToProject(data),
        };
      });

      // Sort by createdAt for non-admin queries (can't combine where + orderBy on different fields easily)
      if (!isAdmin) {
        projects.sort((a, b) => {
          const aTime = a.createdAt?.getTime() || 0;
          const bTime = b.createdAt?.getTime() || 0;
          return bTime - aTime; // descending
        });
      }

      callback(projects);
    },
    (error) => {
      console.error('Error in user projects subscription:', error);
      if (onError) {
        onError(error);
      }
    }
  );

  return unsubscribe;
};

/**
 * Create a new project
 */
export const createProject = async (
  project: Omit<Project, 'id'>
): Promise<string> => {
  try {
    const projectData = {
      ...convertProjectToFirestore(project),
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'projects'), projectData);
    console.log('Project created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating project:', error);
    throw new Error('Failed to create project. Please try again.');
  }
};

/**
 * Update an existing project
 */
export const updateProject = async (project: Project): Promise<void> => {
  try {
    console.log('Updating project:', project);
    const { id, createdAt, ...projectData } = project;
    const docRef = doc(db, 'projects', id);

    const updateData = convertProjectToFirestore(projectData);

    // Preserve createdAt if it exists, otherwise add it
    if (createdAt) {
      updateData.createdAt = createdAt instanceof Date ? Timestamp.fromDate(createdAt) : createdAt;
    }

    console.log('Update data being sent to Firestore:', updateData);
    await updateDoc(docRef, updateData);
    console.log('Project updated successfully:', id);
  } catch (error) {
    console.error('Error updating project:', error);
    throw new Error(`Failed to update project: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Delete a project
 */
export const deleteProject = async (projectId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'projects', projectId);
    await deleteDoc(docRef);
    console.log('Project deleted:', projectId);
  } catch (error) {
    console.error('Error deleting project:', error);
    throw new Error('Failed to delete project. Please try again.');
  }
};

/**
 * Check if Firestore is available (for testing/fallback)
 */
export const isFirestoreAvailable = (): boolean => {
  try {
    return !!db;
  } catch {
    return false;
  }
};
