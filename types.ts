
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
  assignees?: TeamMember[]; // Changed from single ownerId to multiple assignees
  ownerId?: string;      // Legacy: kept for backward compatibility during migration
  ownerEmail?: string;   // Legacy
  deliverables?: string[];
  subTasks?: Task[];
}

export interface Phase {
  id: string;
  name: string;
  weekRange: string;
  tasks: Task[];
  assignees?: TeamMember[]; // Changed from single ownerId to multiple assignees
  ownerId?: string;      // Legacy
  ownerEmail?: string;   // Legacy
}

export interface Notification {
  id: string;
  userId: string;
  type: 'project_added' | 'responsibility_assigned' | 'member_joined';
  projectId: string;
  projectName: string;
  message: string;
  read: boolean;
  emailSent: boolean;
  createdAt: Date;
  link?: string;
}

export interface UserAchievement {
  id: string;
  userId: string;
  points: number;
  category: 'task_complete' | 'phase_complete' | 'milestone' | 'collaboration' | 'quality';
  description: string;
  awardedAt: Date;
}

export interface UserStats {
  userId: string;
  totalPoints: number;
  starRating: 1 | 2 | 3 | 4 | 5;
  achievements: UserAchievement[];
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
