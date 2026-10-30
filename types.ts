
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
  leadRole?: 'primary' | 'secondary'; // undefined = regular member, primary = project owner, secondary = other leads
  isFormerMember?: boolean; // true if member was removed from active team but retained for task attribution
  departedAt?: Date;
}

export interface TaskImpediment {
  id: string;
  category: 'dependency' | 'resources' | 'requirements' | 'technical' | 'other';
  description: string;
  reportedBy: TeamMember;
  reportedAt: Date | string;
  resolved?: boolean;
  resolvedAt?: Date | string;
  resolvedBy?: TeamMember;
  resolutionNote?: string;
}

export interface TaskFeedbackNote {
  id: string;
  author: TeamMember;
  message: string;
  createdAt: Date | string;
  type?: 'general' | 'deliverable_update' | 'impediment' | 'completion' | 'mention';
  mentionedUids?: string[];
  mentionedNames?: string[];
}

export interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  priority?: TaskPriority; // VantageFlow Priority Rubric — undefined means "not yet set"
  startDate: Date;
  endDate: Date;
  assignees?: TeamMember[]; // Changed from single ownerId to multiple assignees
  assignedBy?: TeamMember; // Track who assigned/delegated the task
  ownerId?: string;      // Legacy: kept for backward compatibility during migration
  ownerEmail?: string;   // Legacy
  deliverables?: string[];
  imageUrls?: string[]; // Up to 5 images per task
  subTasks?: Task[];
  impediment?: TaskImpediment; // Current or latest impediment
  feedbackNotes?: TaskFeedbackNote[]; // Lightweight updates/notes feed
  completedAt?: Date;
  completedBy?: TeamMember;
  updatedAt?: Date;
  statusUpdatedAt?: Date;
  lastUpdatedBy?: TeamMember;
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

export type NotificationType =
  | 'project_added'
  | 'responsibility_assigned'
  | 'member_joined'
  | 'task_impediment_reported'
  | 'task_impediment_resolved'
  | 'task_completed'
  | 'task_feedback_added'
  | 'task_feedback_mention';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  projectId: string;
  projectName: string;
  taskId?: string;
  taskName?: string;
  phaseName?: string;
  status?: TaskStatus;
  hasBlocker?: boolean;
  authorName?: string;
  authorPhotoURL?: string;
  message: string;
  read: boolean;
  dismissed?: boolean;
  emailSent: boolean;
  createdAt: Date;
  link?: string;
}

export type AchievementCategory =
  | 'task_complete'
  | 'phase_complete'
  | 'milestone'
  | 'collaboration'
  | 'quality'
  | 'progress_update'
  | 'blocker_resolved'
  | 'kudos';

export interface UserAchievement {
  id: string;
  userId: string;
  points: number;
  category: AchievementCategory;
  description: string;
  awardedAt: Date | any;
  projectId?: string;
  fromUserId?: string;
  fromUserName?: string;
}

export interface UserStats {
  userId: string;
  totalPoints: number;
  starRating: 1 | 2 | 3 | 4 | 5;
  rankTitle?: string;
  nextStarPoints?: number;
  achievements: UserAchievement[];
}

export interface BadgeAward {
  id: string;
  label: string;
  icon: string;
  description: string;
  colorClass: string;
}

export interface QuickWinOpportunity {
  id: string;
  projectId: string;
  projectName: string;
  phaseId: string;
  phaseName: string;
  taskId: string;
  taskName: string;
  actionLabel: string;
  reason: string;
  xpReward: number;
  urgency: 'high' | 'medium' | 'low';
}

export interface MemberPerformanceMetrics {
  userId: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
  leadRole?: 'primary' | 'secondary';
  totalPoints: number;
  starRating: 1 | 2 | 3 | 4 | 5;
  rankTitle: string;
  nextRankTitle: string | null;
  pointsToNextStar: number;
  progressToNextStarPct: number;
  // Dimension breakdowns
  executionPoints: number;     // Completions & priority bonus
  timelinessPoints: number;    // On-time delivery bonuses
  communicationPoints: number; // Feedback notes & @mentions
  unblockingPoints: number;    // Blockers reported & resolved
  transparencyPoints: number;  // Incremental status updates (25/50/75%) & proof uploads
  kudosPoints: number;         // Peer kudos received
  // Operational counts
  tasksAssigned: number;
  tasksCompleted: number;
  tasksInProgress: number;
  tasksOnTime: number;
  criticalCompleted: number;
  completionRatePct: number;
  onTimeRatePct: number;
  feedbackNotesCount: number;
  blockersResolvedCount: number;
  blockersReportedCount: number;
  proofUploadsCount: number;
  kudosReceivedCount: number;
  achievementsCount: number;
  needsEngagement: boolean;
  badges: BadgeAward[];
  lastActiveAt?: Date | null;
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
    formerMembers?: TeamMember[]; // Historical records of members who contributed to tasks
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
  updatedAt?: Date;
  lastAccessedAt?: Date;
  // RBAC: Array of member UIDs for efficient Firestore queries
  memberUids?: string[];
  // Project Lifecycle: Archive state
  isArchived?: boolean;
  archivedAt?: Date;
  archivedBy?: string; // UID of who archived
  // Privacy: false/undefined = private (members/owner only), true = public to all users
  isPublic?: boolean;
  // Project Lifecycle: Soft Delete state
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  deletedByName?: string;
}

export enum UserRole {
  SuperAdmin = 'SuperAdmin',
  Admin = 'Admin',
  Manager = 'Project Manager',
  Member = 'Team Member',
}

export interface UserPresence {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
  role?: string;
  currentProjectId?: string | null;
  lastSeen: any; // Firestore serverTimestamp, Timestamp, or Date
  state: 'online' | 'away' | 'offline';
}
