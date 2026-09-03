export enum TaskStatus {
  Zero = '0%',
  TwentyFive = '25%',
  Fifty = '50%',
  SeventyFive = '75%',
  Hundred = '100%',
  AtRisk = 'At Risk',
}

export enum TaskPriority {
  Critical = 1,   // 🔴 Red — Immediate impact, non-negotiable
  Important = 2,  // 🟠 Amber — Strategic value, must be done
  Enhancement = 3, // 🔵 Blue — Productivity/ease gains
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
  phoneNumber?: string;
  leadRole?: 'primary' | 'secondary';
}

export interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  priority?: TaskPriority;
  startDate: Date;
  endDate: Date;
  assignees?: TeamMember[];
  ownerId?: string;
  ownerEmail?: string;
  deliverables?: string[];
  imageUrls?: string[]; // Up to 5 images per task
  subTasks?: Task[];
}

export interface Phase {
  id: string;
  name: string;
  weekRange: string;
  tasks: Task[];
  assignees?: TeamMember[];
  ownerId?: string;
  ownerEmail?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'project_added' | 'responsibility_assigned' | 'member_joined' | 'achievement_celebration' | 'project_archived';
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
  durationUnit: DurationUnit;
  team: {
    members: TeamMember[];
    name?: string;
    size?: number;
    manager?: string;
  };
  cost: number;
  currency: Currency;
  phases: Phase[];
  ownerId?: string;
  ownerEmail?: string;
  ownerName?: string;
  ownerPhotoURL?: string;
  createdAt?: Date;
  memberUids?: string[];
  isArchived?: boolean;
  archivedAt?: Date;
  archivedBy?: string;
}

export enum UserRole {
  Admin = 'Admin',
  Manager = 'Project Manager',
  Member = 'Team Member',
}

export interface AuthUser {
  uid: string;
  email: string | null;
  role: UserRole;
  displayName?: string | null;
  photoURL?: string | null;
  phoneNumber?: string | null;
}
