import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Project, Task } from '../types';

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
  const converted: any = {
    ...task,
    startDate: Timestamp.fromDate(task.startDate),
    endDate: Timestamp.fromDate(task.endDate),
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
  return {
    ...docData,
    phases: docData.phases?.map((phase: any) => ({
      ...phase,
      tasks: phase.tasks?.map(convertTaskDatesFromFirestore) || [],
    })) || [],
  } as Project;
};

/**
 * Convert Project to Firestore-compatible format
 * Filters out undefined values and converts dates
 */
const convertProjectToFirestore = (project: Omit<Project, 'id'> | Project): any => {
  const data: any = {
    name: project.name,
    description: project.description,
    coreSystem: project.coreSystem,
    duration: project.duration,
    team: project.team,
    cost: project.cost,
    ownerId: project.ownerId,
    ownerEmail: project.ownerEmail,
    phases: project.phases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      weekRange: phase.weekRange,
      tasks: phase.tasks.map(convertTaskDatesToFirestore),
    })),
    updatedAt: Timestamp.now(),
  };

  // Remove undefined values to prevent Firestore errors
  Object.keys(data).forEach(key => {
    if (data[key] === undefined) {
      delete data[key];
    }
  });

  return data;
};

/**
 * Subscribe to real-time project updates
 * Returns unsubscribe function
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
    const { id, ...projectData } = project;
    const docRef = doc(db, 'projects', id);
    
    await updateDoc(docRef, convertProjectToFirestore(projectData));
    console.log('Project updated:', id);
  } catch (error) {
    console.error('Error updating project:', error);
    throw new Error('Failed to update project. Please try again.');
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
