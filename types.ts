
export enum TaskStatus {
  Completed = 'Completed',
  InProgress = 'In Progress',
  NotStarted = 'Not Started',
  AtRisk = 'At Risk',
}

export interface Task {
  id: string;
  name:string;
  status: TaskStatus;
  startDate: Date;
  endDate: Date;
  assignee?: string;
  deliverables?: string[];
  subTasks?: Task[];
}

export interface Phase {
  id: string;
  name: string;
  weekRange: string;
  tasks: Task[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  coreSystem: string;
  startDate: Date; // Project start date
  duration: number; // Duration in weeks
  team: {
    name: string;
    size: number;
    manager: string;
  };
  cost: string;
  phases: Phase[];
  ownerId?: string; // User ID of project owner
  ownerEmail?: string; // Email of project owner
  createdAt?: Date; // Creation timestamp
}

export enum UserRole {
  Admin = 'Admin',
  Manager = 'Project Manager',
  Member = 'Team Member',
}
