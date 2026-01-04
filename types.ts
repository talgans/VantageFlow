
export enum TaskStatus {
  Zero = '0%',
  TwentyFive = '25%',
  Fifty = '50%',
  SeventyFive = '75%',
  Hundred = '100%',
  AtRisk = 'At Risk',
}

export enum DurationUnit {
  Hours = 'hours',
  Days = 'days',
  Weeks = 'weeks',
  Months = 'months',
}

export enum Currency {
  NGN = 'NGN', // Naira (default)
  USD = 'USD',
}

export interface TeamMember {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  leadRole?: 'primary' | 'secondary'; // undefined = regular member, primary = project owner, secondary = other leads
}

export interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  startDate: Date;
  endDate: Date;
  assignee?: string;
  ownerId?: string;      // User assigned to this task
  ownerEmail?: string;
  deliverables?: string[];
  subTasks?: Task[];
}

export interface Phase {
  id: string;
  name: string;
  weekRange: string;
  tasks: Task[];
  ownerId?: string;      // User assigned to this phase
  ownerEmail?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  coreSystem: string;
  startDate: Date;
  duration: number;
  durationUnit: DurationUnit; // hours/days/weeks/months
  team: {
    members: TeamMember[];
    // Legacy fields for backward compatibility
    name?: string;
    size?: number;
    manager?: string;
  };
  cost: number;
  currency: Currency; // NGN or USD
  phases: Phase[];
  ownerId?: string;
  ownerEmail?: string;
  ownerName?: string;
  ownerPhotoURL?: string;
  createdAt?: Date;
}

export enum UserRole {
  Admin = 'Admin',
  Manager = 'Project Manager',
  Member = 'Team Member',
}
