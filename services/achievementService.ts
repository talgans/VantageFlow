import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';
import {
    UserAchievement,
    UserStats,
    Project,
    Task,
    TaskStatus,
    TaskPriority,
    Phase,
    BadgeAward,
    QuickWinOpportunity,
    MemberPerformanceMetrics,
} from '../types';

export type PerformanceTimeRange = 'all' | 'month' | 'week';

export interface RankTierInfo {
    starRating: 1 | 2 | 3 | 4 | 5;
    rankTitle: string;
    nextRankTitle: string | null;
    currentTierMin: number;
    nextTierThreshold: number | null;
    pointsToNextStar: number;
    progressToNextStarPct: number;
}

export const getRankTier = (totalPoints: number): RankTierInfo => {
    const pts = Math.max(0, Math.round(totalPoints));
    if (pts >= 1000) {
        return {
            starRating: 5,
            rankTitle: 'Vantage Legend',
            nextRankTitle: null,
            currentTierMin: 1000,
            nextTierThreshold: null,
            pointsToNextStar: 0,
            progressToNextStarPct: 100,
        };
    }
    if (pts >= 600) {
        const span = 1000 - 600;
        const progress = Math.min(100, Math.round(((pts - 600) / span) * 100));
        return {
            starRating: 4,
            rankTitle: 'Execution Champion',
            nextRankTitle: 'Vantage Legend',
            currentTierMin: 600,
            nextTierThreshold: 1000,
            pointsToNextStar: 1000 - pts,
            progressToNextStarPct: progress,
        };
    }
    if (pts >= 300) {
        const span = 600 - 300;
        const progress = Math.min(100, Math.round(((pts - 300) / span) * 100));
        return {
            starRating: 3,
            rankTitle: 'Momentum Maker',
            nextRankTitle: 'Execution Champion',
            currentTierMin: 300,
            nextTierThreshold: 600,
            pointsToNextStar: 600 - pts,
            progressToNextStarPct: progress,
        };
    }
    if (pts >= 100) {
        const span = 300 - 100;
        const progress = Math.min(100, Math.round(((pts - 100) / span) * 100));
        return {
            starRating: 2,
            rankTitle: 'Builder',
            nextRankTitle: 'Momentum Maker',
            currentTierMin: 100,
            nextTierThreshold: 300,
            pointsToNextStar: 300 - pts,
            progressToNextStarPct: progress,
        };
    }
    const progress = Math.min(100, Math.round((pts / 100) * 100));
    return {
        starRating: 1,
        rankTitle: 'Contributor',
        nextRankTitle: 'Builder',
        currentTierMin: 0,
        nextTierThreshold: 100,
        pointsToNextStar: 100 - pts,
        progressToNextStarPct: progress,
    };
};

export interface ActivityFeedItem {
    id: string;
    userId: string;
    userName?: string;
    points: number;
    category: UserAchievement['category'];
    description: string;
    projectId?: string;
    projectName?: string;
    timestamp: Date;
    fromUserName?: string;
}

export interface PerformanceAnalyticsResult {
    members: MemberPerformanceMetrics[];
    mvpMember: MemberPerformanceMetrics | null;
    currentUserMetrics: MemberPerformanceMetrics | null;
    summary: {
        totalPoints: number;
        activeMembersCount: number;
        totalMembersCount: number;
        tasksAssignedTotal: number;
        tasksCompletedTotal: number;
        overallCompletionPct: number;
        onTimeDeliveryPct: number;
        engagementFreshnessPct: number;
        totalFeedbackNotes: number;
        totalBlockersResolved: number;
        totalKudos: number;
    };
    habitRadarData: {
        habit: string;
        score: number;
        rawPoints: number;
        description: string;
    }[];
    categoryBreakdownData: {
        id: string;
        label: string;
        value: number;
        color: string;
    }[];
    projectBarData: Record<string, any>[];
    sectionBarData: Record<string, any>[];
    barUserKeys: string[];
    quickWins: QuickWinOpportunity[];
    activityFeed: ActivityFeedItem[];
}

const toDateSafe = (val: any): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val?.toDate === 'function') {
        const d = val.toDate();
        return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    }
    if (typeof val?.seconds === 'number') {
        return new Date(val.seconds * 1000);
    }
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? null : parsed;
};

const isWithinTimeRange = (dateVal: any, timeRange: PerformanceTimeRange): boolean => {
    if (timeRange === 'all') return true;
    const d = toDateSafe(dateVal);
    if (!d) return true; // For legacy tasks without explicit updatedAt, include so baseline isn't blank
    const now = Date.now();
    const cutoff = timeRange === 'week' ? now - 7 * 24 * 3600 * 1000 : now - 30 * 24 * 3600 * 1000;
    return d.getTime() >= cutoff;
};

const isStrictWithinTimeRange = (dateVal: any, timeRange: PerformanceTimeRange): boolean => {
    if (timeRange === 'all') return true;
    const d = toDateSafe(dateVal);
    if (!d) return false;
    const now = Date.now();
    const cutoff = timeRange === 'week' ? now - 7 * 24 * 3600 * 1000 : now - 30 * 24 * 3600 * 1000;
    return d.getTime() >= cutoff;
};

export const achievementService = {
    /**
     * Award points to a user
     */
    awardPoints: async (
        userId: string,
        points: number,
        category: UserAchievement['category'],
        description: string,
        projectId?: string,
        extra?: { fromUserId?: string; fromUserName?: string }
    ) => {
        try {
            await addDoc(collection(db, 'achievements'), {
                userId,
                points,
                category,
                description,
                projectId: projectId || null,
                fromUserId: extra?.fromUserId || null,
                fromUserName: extra?.fromUserName || null,
                awardedAt: serverTimestamp(),
            });
            console.log(`Awarded ${points} points to ${userId} for ${category} (Project: ${projectId})`);
            return true;
        } catch (error) {
            console.error('Error awarding points:', error);
            return false;
        }
    },

    /**
     * Send Peer Kudos (+5 XP) to a teammate
     */
    sendKudos: async (
        toUserId: string,
        fromUser: { uid: string; displayName: string },
        message: string,
        projectId?: string
    ): Promise<boolean> => {
        const cleanMsg = message.trim() || 'Great teamwork and execution!';
        return achievementService.awardPoints(
            toUserId,
            5,
            'kudos',
            `👏 Kudos from ${fromUser.displayName}: "${cleanMsg}"`,
            projectId,
            { fromUserId: fromUser.uid, fromUserName: fromUser.displayName }
        );
    },

    /**
     * Get user achievements
     */
    getUserAchievements: async (userId: string): Promise<UserAchievement[]> => {
        try {
            const q = query(
                collection(db, 'achievements'),
                where('userId', '==', userId),
                orderBy('awardedAt', 'desc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserAchievement));
        } catch (error) {
            console.error('Error fetching achievements:', error);
            return [];
        }
    },

    /**
     * Get user stats (total points and star rating)
     */
    getUserStats: async (userId: string): Promise<UserStats> => {
        try {
            const achievements = await achievementService.getUserAchievements(userId);
            const totalPoints = achievements.reduce((sum, a) => sum + (a.points || 0), 0);
            const tier = getRankTier(totalPoints);

            return {
                userId,
                totalPoints,
                starRating: tier.starRating,
                rankTitle: tier.rankTitle,
                nextStarPoints: tier.pointsToNextStar,
                achievements,
            };
        } catch (error) {
            console.error('Error getting user stats:', error);
            return { userId, totalPoints: 0, starRating: 1, rankTitle: 'Contributor', achievements: [] };
        }
    },

    /**
     * Get all achievements (for dashboard)
     */
    getAllAchievements: async (): Promise<UserAchievement[]> => {
        try {
            const q = query(
                collection(db, 'achievements'),
                orderBy('awardedAt', 'desc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserAchievement));
        } catch (error) {
            console.error('Error fetching all achievements:', error);
            return [];
        }
    },

    /**
     * Get leaderboard data
     */
    getLeaderboard: async (): Promise<{ userId: string; points: number; achievements: number }[]> => {
        try {
            const allAchievements = await achievementService.getAllAchievements();
            const userPoints: Record<string, { points: number; achievements: number }> = {};

            allAchievements.forEach(a => {
                if (!userPoints[a.userId]) {
                    userPoints[a.userId] = { points: 0, achievements: 0 };
                }
                userPoints[a.userId].points += (a.points || 0);
                userPoints[a.userId].achievements += 1;
            });

            return Object.entries(userPoints)
                .map(([userId, stats]) => ({ userId, ...stats }))
                .sort((a, b) => b.points - a.points);
        } catch (error) {
            console.error('Error getting leaderboard:', error);
            return [];
        }
    },

    /**
     * Hybrid Live + Event Scoring Calculator
     * Combines live task/section state across projects with Firestore achievement awards
     */
    computePerformanceAnalytics: (
        projects: Project[],
        achievements: UserAchievement[],
        options: {
            timeRange?: PerformanceTimeRange;
            projectId?: string;
            currentUserId?: string;
            resolveDisplayName?: (uid: string) => string;
            resolvePhotoURL?: (uid: string) => string;
        } = {}
    ): PerformanceAnalyticsResult => {
        const timeRange = options.timeRange || 'all';
        const targetProjects = options.projectId
            ? projects.filter(p => p.id === options.projectId)
            : projects.filter(p => !p.isDeleted);

        const targetProjectIds = new Set(targetProjects.map(p => p.id));

        interface InternalMemberAccumulator {
            userId: string;
            displayName?: string;
            email?: string;
            photoURL?: string;
            leadRole?: 'primary' | 'secondary';
            executionPoints: number;
            timelinessPoints: number;
            communicationPoints: number;
            unblockingPoints: number;
            transparencyPoints: number;
            kudosPoints: number;
            tasksAssigned: number;
            tasksCompleted: number;
            tasksInProgress: number;
            tasksOnTime: number;
            criticalCompleted: number;
            feedbackNotesCount: number;
            blockersResolvedCount: number;
            blockersReportedCount: number;
            proofUploadsCount: number;
            kudosReceivedCount: number;
            achievementsCount: number;
            lastActiveAt: Date | null;
        }

        const memberMap = new Map<string, InternalMemberAccumulator>();

        const ensureMember = (
            uid: string,
            meta?: { displayName?: string; email?: string; photoURL?: string; leadRole?: 'primary' | 'secondary' }
        ): InternalMemberAccumulator => {
            let acc = memberMap.get(uid);
            if (!acc) {
                acc = {
                    userId: uid,
                    displayName: meta?.displayName,
                    email: meta?.email,
                    photoURL: meta?.photoURL,
                    leadRole: meta?.leadRole,
                    executionPoints: 0,
                    timelinessPoints: 0,
                    communicationPoints: 0,
                    unblockingPoints: 0,
                    transparencyPoints: 0,
                    kudosPoints: 0,
                    tasksAssigned: 0,
                    tasksCompleted: 0,
                    tasksInProgress: 0,
                    tasksOnTime: 0,
                    criticalCompleted: 0,
                    feedbackNotesCount: 0,
                    blockersResolvedCount: 0,
                    blockersReportedCount: 0,
                    proofUploadsCount: 0,
                    kudosReceivedCount: 0,
                    achievementsCount: 0,
                    lastActiveAt: null,
                };
                memberMap.set(uid, acc);
            } else if (meta) {
                if (!acc.displayName && meta.displayName) acc.displayName = meta.displayName;
                if (!acc.email && meta.email) acc.email = meta.email;
                if (!acc.photoURL && meta.photoURL) acc.photoURL = meta.photoURL;
                if (!acc.leadRole && meta.leadRole) acc.leadRole = meta.leadRole;
            }
            return acc;
        };

        const recordActivityDate = (acc: InternalMemberAccumulator, dateVal: any) => {
            const d = toDateSafe(dateVal);
            if (!d) return;
            if (!acc.lastActiveAt || d.getTime() > acc.lastActiveAt.getTime()) {
                acc.lastActiveAt = d;
            }
        };

        // 1. Register all project team members (including 0-point members so leads see everyone)
        targetProjects.forEach(project => {
            if (project.ownerId) {
                ensureMember(project.ownerId, {
                    displayName: project.ownerName,
                    email: project.ownerEmail,
                    photoURL: project.ownerPhotoURL,
                    leadRole: 'primary',
                });
            }
            (project.team?.members || []).forEach(m => {
                if (m.uid && !m.isFormerMember) {
                    ensureMember(m.uid, {
                        displayName: m.displayName,
                        email: m.email,
                        photoURL: m.photoURL,
                        leadRole: m.leadRole,
                    });
                }
            });
        });

        const getNameForUid = (uid: string): string => {
            if (options.resolveDisplayName) {
                const resolved = options.resolveDisplayName(uid);
                if (resolved && resolved !== 'User' && resolved !== '?') return resolved;
            }
            const acc = memberMap.get(uid);
            if (acc?.displayName && !acc.displayName.includes('@')) return acc.displayName;
            if (acc?.email) {
                const prefix = acc.email.split('@')[0];
                return prefix
                    .split(/[._-]/)
                    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(' ');
            }
            return 'Team Member';
        };

        // Stacked Bar accumulators
        const projectPointsMap: Record<string, Record<string, number>> = {};
        const sectionPointsMap: Record<string, Record<string, number>> = {};
        const addBarPoints = (projectName: string, sectionName: string, uid: string, pts: number) => {
            if (pts <= 0) return;
            const userName = getNameForUid(uid);
            if (!projectPointsMap[projectName]) {
                projectPointsMap[projectName] = { project: projectName as any };
            }
            projectPointsMap[projectName][userName] = (projectPointsMap[projectName][userName] || 0) + pts;

            if (!sectionPointsMap[sectionName]) {
                sectionPointsMap[sectionName] = { section: sectionName as any };
            }
            sectionPointsMap[sectionName][userName] = (sectionPointsMap[sectionName][userName] || 0) + pts;
        };

        const activityFeed: ActivityFeedItem[] = [];
        const quickWins: QuickWinOpportunity[] = [];

        let totalTasksCount = 0;
        let completedTasksCount = 0;
        let onTimeCompletedTasksCount = 0;
        let recentlyUpdatedActiveTasksCount = 0;
        let activeTasksCount = 0;

        const nowMs = Date.now();
        const sevenDaysAgoMs = nowMs - 7 * 24 * 3600 * 1000;
        const threeDaysAheadMs = nowMs + 3 * 24 * 3600 * 1000;

        // 2. Traverse live projects, phases, and tasks
        targetProjects.forEach(project => {
            (project.phases || []).forEach((phase: Phase, phaseIdx: number) => {
                const sectionLabel = phase.name || `Section ${phaseIdx + 1}`;
                const allPhaseTasks: Task[] = [];

                const walkTasks = (tasks: Task[]) => {
                    tasks.forEach(task => {
                        allPhaseTasks.push(task);
                        const statusStr = task.status as string;
                        const isCompleted = statusStr === TaskStatus.Hundred || statusStr === 'Completed';
                        const isInProgress =
                            statusStr === TaskStatus.TwentyFive ||
                            statusStr === TaskStatus.Fifty ||
                            statusStr === TaskStatus.SeventyFive ||
                            statusStr === 'In Progress';
                        const isBlocked =
                            statusStr === TaskStatus.AtRisk || Boolean(task.impediment && !task.impediment.resolved);

                        const taskRefDate =
                            task.completedAt || task.statusUpdatedAt || task.updatedAt || project.updatedAt || task.startDate;
                        const inWindow = isWithinTimeRange(taskRefDate, timeRange);

                        // Determine assignees for attribution
                        const assigneeUids = new Set<string>();
                        (task.assignees || []).forEach(a => {
                            if (a.uid) {
                                ensureMember(a.uid, {
                                    displayName: a.displayName,
                                    email: a.email,
                                    photoURL: a.photoURL,
                                });
                                assigneeUids.add(a.uid);
                            }
                        });
                        if (assigneeUids.size === 0 && task.completedBy?.uid) {
                            ensureMember(task.completedBy.uid, task.completedBy);
                            assigneeUids.add(task.completedBy.uid);
                        }
                        if (assigneeUids.size === 0 && task.ownerId) {
                            ensureMember(task.ownerId, { email: task.ownerEmail });
                            assigneeUids.add(task.ownerId);
                        }

                        if (inWindow) {
                            totalTasksCount++;
                            if (isCompleted) {
                                completedTasksCount++;
                            } else {
                                activeTasksCount++;
                                const lastUpd = toDateSafe(task.updatedAt || task.statusUpdatedAt);
                                if (lastUpd && lastUpd.getTime() >= sevenDaysAgoMs) {
                                    recentlyUpdatedActiveTasksCount++;
                                }
                            }
                        }

                        // Priority points
                        const priorityPts =
                            task.priority === TaskPriority.Critical
                                ? 25
                                : task.priority === TaskPriority.Enhancement
                                ? 10
                                : 15;

                        // On-time check
                        const endD = toDateSafe(task.endDate);
                        const compD = toDateSafe(task.completedAt || task.updatedAt);
                        const isOnTime = isCompleted && (!endD || !compD || compD.getTime() <= endD.getTime() + 24 * 3600 * 1000);
                        if (inWindow && isCompleted && isOnTime) {
                            onTimeCompletedTasksCount++;
                        }

                        // Incremental progress points
                        let progressPts = 0;
                        if (statusStr === TaskStatus.TwentyFive) progressPts = 3;
                        else if (statusStr === TaskStatus.Fifty || statusStr === 'In Progress') progressPts = 5;
                        else if (statusStr === TaskStatus.SeventyFive) progressPts = 8;
                        else if (isCompleted) progressPts = 5; // Completed tasks also reflect full status progression

                        // Proof of work points
                        const hasProof = (task.imageUrls && task.imageUrls.length > 0) || (isCompleted && task.deliverables && task.deliverables.length > 0);
                        const proofPts = hasProof ? 5 : 0;

                        // Attribute task execution, timeliness, and transparency to assignees
                        assigneeUids.forEach(uid => {
                            const acc = ensureMember(uid);
                            if (inWindow) {
                                acc.tasksAssigned += 1;
                                recordActivityDate(acc, task.updatedAt || task.completedAt || task.statusUpdatedAt);

                                if (isCompleted) {
                                    acc.tasksCompleted += 1;
                                    if (task.priority === TaskPriority.Critical) {
                                        acc.criticalCompleted += 1;
                                    }
                                    acc.executionPoints += priorityPts;
                                    acc.achievementsCount += 1;
                                    addBarPoints(project.name, sectionLabel, uid, priorityPts);

                                    if (isOnTime) {
                                        acc.tasksOnTime += 1;
                                        acc.timelinessPoints += 10;
                                        addBarPoints(project.name, sectionLabel, uid, 10);
                                    }

                                    const compTimestamp = toDateSafe(task.completedAt || task.updatedAt);
                                    if (compTimestamp && isStrictWithinTimeRange(compTimestamp, timeRange)) {
                                        activityFeed.push({
                                            id: `live-comp-${task.id}-${uid}`,
                                            userId: uid,
                                            userName: getNameForUid(uid),
                                            points: priorityPts + (isOnTime ? 10 : 0),
                                            category: 'task_complete',
                                            description: `Completed "${task.name}"${isOnTime ? ' (On-Time Bonus +10 XP)' : ''}`,
                                            projectId: project.id,
                                            projectName: project.name,
                                            timestamp: compTimestamp,
                                        });
                                    }
                                } else if (isInProgress) {
                                    acc.tasksInProgress += 1;
                                }

                                if (progressPts > 0) {
                                    acc.transparencyPoints += progressPts;
                                    addBarPoints(project.name, sectionLabel, uid, progressPts);
                                }

                                if (proofPts > 0) {
                                    acc.proofUploadsCount += 1;
                                    acc.transparencyPoints += proofPts;
                                    addBarPoints(project.name, sectionLabel, uid, proofPts);
                                }
                            }
                        });

                        // Feedback notes attribution (+3 XP each)
                        (task.feedbackNotes || []).forEach(note => {
                            const authorUid = note.author?.uid;
                            if (!authorUid) return;
                            if (!isWithinTimeRange(note.createdAt, timeRange)) return;
                            const acc = ensureMember(authorUid, note.author);
                            acc.feedbackNotesCount += 1;
                            acc.communicationPoints += 3;
                            recordActivityDate(acc, note.createdAt);
                            addBarPoints(project.name, sectionLabel, authorUid, 3);

                            const noteDate = toDateSafe(note.createdAt);
                            if (noteDate) {
                                activityFeed.push({
                                    id: `note-${note.id}`,
                                    userId: authorUid,
                                    userName: getNameForUid(authorUid),
                                    points: 3,
                                    category: 'collaboration',
                                    description: `Posted update on "${task.name}": "${note.message.slice(0, 60)}${note.message.length > 60 ? '...' : ''}"`,
                                    projectId: project.id,
                                    projectName: project.name,
                                    timestamp: noteDate,
                                });
                            }
                        });

                        // Impediment / Blocker attribution (+2 XP reported, +10 XP resolved)
                        if (task.impediment) {
                            const repUid = task.impediment.reportedBy?.uid;
                            if (repUid && isWithinTimeRange(task.impediment.reportedAt, timeRange)) {
                                const acc = ensureMember(repUid, task.impediment.reportedBy);
                                acc.blockersReportedCount += 1;
                                acc.unblockingPoints += 2;
                                recordActivityDate(acc, task.impediment.reportedAt);
                                addBarPoints(project.name, sectionLabel, repUid, 2);
                            }
                            if (task.impediment.resolved) {
                                const resUid = task.impediment.resolvedBy?.uid || repUid;
                                if (resUid && isWithinTimeRange(task.impediment.resolvedAt || task.updatedAt, timeRange)) {
                                    const acc = ensureMember(resUid, task.impediment.resolvedBy);
                                    acc.blockersResolvedCount += 1;
                                    acc.unblockingPoints += 10;
                                    recordActivityDate(acc, task.impediment.resolvedAt);
                                    addBarPoints(project.name, sectionLabel, resUid, 10);

                                    const resDate = toDateSafe(task.impediment.resolvedAt || task.updatedAt);
                                    if (resDate) {
                                        activityFeed.push({
                                            id: `blocker-res-${task.id}`,
                                            userId: resUid,
                                            userName: getNameForUid(resUid),
                                            points: 10,
                                            category: 'blocker_resolved',
                                            description: `Resolved blocker on "${task.name}"`,
                                            projectId: project.id,
                                            projectName: project.name,
                                            timestamp: resDate,
                                        });
                                    }
                                }
                            }
                        }

                        // Quick Wins Generator for incomplete tasks
                        if (!isCompleted) {
                            const isUserTask =
                                !options.currentUserId ||
                                assigneeUids.has(options.currentUserId) ||
                                assigneeUids.size === 0;

                            if (isUserTask) {
                                if (isBlocked) {
                                    quickWins.push({
                                        id: `qw-blocker-${task.id}`,
                                        projectId: project.id,
                                        projectName: project.name,
                                        phaseId: phase.id,
                                        phaseName: sectionLabel,
                                        taskId: task.id,
                                        taskName: task.name,
                                        actionLabel: 'Resolve Blocker',
                                        reason: 'Task is flagged At Risk / Blocked — resolve it to unblock the team',
                                        xpReward: 10,
                                        urgency: 'high',
                                    });
                                } else if (endD && endD.getTime() <= threeDaysAheadMs && endD.getTime() >= nowMs - 24 * 3600 * 1000) {
                                    quickWins.push({
                                        id: `qw-due-${task.id}`,
                                        projectId: project.id,
                                        projectName: project.name,
                                        phaseId: phase.id,
                                        phaseName: sectionLabel,
                                        taskId: task.id,
                                        taskName: task.name,
                                        actionLabel: 'Complete On-Time',
                                        reason: 'Due soon — finish on time to claim priority + on-time bonus',
                                        xpReward: priorityPts + 10,
                                        urgency: 'high',
                                    });
                                } else if (statusStr === TaskStatus.Zero) {
                                    quickWins.push({
                                        id: `qw-start-${task.id}`,
                                        projectId: project.id,
                                        projectName: project.name,
                                        phaseId: phase.id,
                                        phaseName: sectionLabel,
                                        taskId: task.id,
                                        taskName: task.name,
                                        actionLabel: 'Update Progress & Add Note',
                                        reason: 'Currently at 0% — update status to 25%+ and post a quick note',
                                        xpReward: 6,
                                        urgency: 'medium',
                                    });
                                } else if (!task.feedbackNotes || task.feedbackNotes.length === 0) {
                                    quickWins.push({
                                        id: `qw-note-${task.id}`,
                                        projectId: project.id,
                                        projectName: project.name,
                                        phaseId: phase.id,
                                        phaseName: sectionLabel,
                                        taskId: task.id,
                                        taskName: task.name,
                                        actionLabel: 'Post Follow-up Note',
                                        reason: 'In progress with no status notes — share a quick update with the team',
                                        xpReward: 3,
                                        urgency: 'low',
                                    });
                                }
                            }
                        }

                        if (task.subTasks && task.subTasks.length > 0) {
                            walkTasks(task.subTasks);
                        }
                    });
                };

                walkTasks(phase.tasks || []);

                // Section 100% completion bonus (+50 XP)
                if (allPhaseTasks.length > 0) {
                    const allDone = allPhaseTasks.every(
                        t => t.status === TaskStatus.Hundred || (t.status as string) === 'Completed'
                    );
                    if (allDone && isWithinTimeRange(project.updatedAt, timeRange)) {
                        const sectionUids = new Set<string>();
                        (phase.assignees || []).forEach(a => {
                            if (a.uid) sectionUids.add(a.uid);
                        });
                        if (sectionUids.size === 0) {
                            allPhaseTasks.forEach(t =>
                                (t.assignees || []).forEach(a => {
                                    if (a.uid) sectionUids.add(a.uid);
                                })
                            );
                        }
                        sectionUids.forEach(uid => {
                            const acc = ensureMember(uid);
                            acc.executionPoints += 50;
                            acc.achievementsCount += 1;
                            addBarPoints(project.name, sectionLabel, uid, 50);
                        });
                    }
                }
            });
        });

        // 3. Merge Firestore achievements (Peer Kudos, explicit awards, and historical points)
        const relevantAchievements = achievements.filter(a => {
            if (options.projectId && a.projectId !== options.projectId) return false;
            if (!options.projectId && a.projectId && !targetProjectIds.has(a.projectId)) return false;
            return isStrictWithinTimeRange(a.awardedAt, timeRange);
        });

        relevantAchievements.forEach(ach => {
            if (!ach.userId) return;
            const acc = ensureMember(ach.userId);
            const achDate = toDateSafe(ach.awardedAt) || new Date();
            recordActivityDate(acc, achDate);
            const proj = targetProjects.find(p => p.id === ach.projectId);
            const projName = proj ? proj.name : 'General';

            if (ach.category === 'kudos') {
                const pts = ach.points || 5;
                acc.kudosPoints += pts;
                acc.kudosReceivedCount += 1;
                acc.achievementsCount += 1;
                addBarPoints(projName, 'Peer Kudos', ach.userId, pts);
            } else if (ach.category === 'collaboration' || ach.category === 'quality' || ach.category === 'milestone') {
                const pts = ach.points || 5;
                acc.communicationPoints += pts;
                acc.achievementsCount += 1;
                addBarPoints(projName, 'Milestones & Quality', ach.userId, pts);
            } else if (ach.category === 'progress_update') {
                const pts = ach.points || 3;
                acc.transparencyPoints += pts;
                acc.achievementsCount += 1;
            } else if (ach.category === 'blocker_resolved') {
                const pts = ach.points || 10;
                acc.unblockingPoints += pts;
                acc.achievementsCount += 1;
            } else if (acc.tasksCompleted === 0 && (ach.category === 'task_complete' || ach.category === 'phase_complete')) {
                // Historical achievement when task is no longer in live state
                const pts = ach.points || 10;
                acc.executionPoints += pts;
                acc.achievementsCount += 1;
                addBarPoints(projName, 'Completed Milestones', ach.userId, pts);
            }

            activityFeed.push({
                id: `ach-${ach.id}`,
                userId: ach.userId,
                userName: getNameForUid(ach.userId),
                points: ach.points || 10,
                category: ach.category,
                description: ach.description,
                projectId: ach.projectId,
                projectName: projName,
                timestamp: achDate,
                fromUserName: ach.fromUserName,
            });
        });

        // 4. Finalize member metrics, badges, and rank tiers
        let maxPoints = 0;
        memberMap.forEach(acc => {
            const total =
                acc.executionPoints +
                acc.timelinessPoints +
                acc.communicationPoints +
                acc.unblockingPoints +
                acc.transparencyPoints +
                acc.kudosPoints;
            if (total > maxPoints) maxPoints = total;
        });

        const members: MemberPerformanceMetrics[] = Array.from(memberMap.values()).map(acc => {
            const totalPoints =
                acc.executionPoints +
                acc.timelinessPoints +
                acc.communicationPoints +
                acc.unblockingPoints +
                acc.transparencyPoints +
                acc.kudosPoints;

            const tier = getRankTier(totalPoints);
            const completionRatePct =
                acc.tasksAssigned > 0 ? Math.round((acc.tasksCompleted / acc.tasksAssigned) * 100) : 0;
            const onTimeRatePct =
                acc.tasksCompleted > 0 ? Math.round((acc.tasksOnTime / acc.tasksCompleted) * 100) : 0;

            // Compute Specialty Habit Badges
            const badges: BadgeAward[] = [];
            if (totalPoints > 0 && totalPoints === maxPoints) {
                badges.push({
                    id: 'mvp',
                    label: options.projectId ? 'Project MVP' : 'Top Performer',
                    icon: '🏆',
                    description: 'Highest overall points earned in this scope',
                    colorClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
                });
            }
            if (acc.tasksOnTime >= 3 || (acc.tasksCompleted >= 2 && onTimeRatePct === 100)) {
                badges.push({
                    id: 'ontime-pro',
                    label: 'On-Time Pro',
                    icon: '🎯',
                    description: 'Consistently delivers tasks on or before the deadline',
                    colorClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                });
            }
            if (acc.criticalCompleted >= 1) {
                badges.push({
                    id: 'critical-crusher',
                    label: 'Critical Crusher',
                    icon: '🔥',
                    description: `Completed ${acc.criticalCompleted} Critical-priority task${acc.criticalCompleted > 1 ? 's' : ''}`,
                    colorClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
                });
            }
            if (acc.feedbackNotesCount >= 2) {
                badges.push({
                    id: 'communicator',
                    label: 'Great Communicator',
                    icon: '💬',
                    description: `Posted ${acc.feedbackNotesCount} task feedback updates to keep the team aligned`,
                    colorClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
                });
            }
            if (acc.blockersResolvedCount >= 1) {
                badges.push({
                    id: 'unblocker',
                    label: 'Unblocker',
                    icon: '🛠️',
                    description: `Resolved ${acc.blockersResolvedCount} project impediment${acc.blockersResolvedCount > 1 ? 's' : ''}`,
                    colorClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
                });
            }
            if (acc.transparencyPoints >= 10) {
                badges.push({
                    id: 'momentum',
                    label: 'Momentum Keeper',
                    icon: '⚡',
                    description: 'Actively updates task progress percentages & deliverables',
                    colorClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                });
            }
            if (acc.kudosReceivedCount >= 1) {
                badges.push({
                    id: 'team-player',
                    label: 'Team Favorite',
                    icon: '👏',
                    description: `Recognized with ${acc.kudosReceivedCount} peer kudos`,
                    colorClass: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
                });
            }

            const resolvedPhoto =
                (options.resolvePhotoURL && options.resolvePhotoURL(acc.userId)) || acc.photoURL || '';

            return {
                userId: acc.userId,
                displayName: getNameForUid(acc.userId),
                email: acc.email,
                photoURL: resolvedPhoto,
                leadRole: acc.leadRole,
                totalPoints,
                starRating: tier.starRating,
                rankTitle: tier.rankTitle,
                nextRankTitle: tier.nextRankTitle,
                pointsToNextStar: tier.pointsToNextStar,
                progressToNextStarPct: tier.progressToNextStarPct,
                executionPoints: acc.executionPoints,
                timelinessPoints: acc.timelinessPoints,
                communicationPoints: acc.communicationPoints + acc.kudosPoints,
                unblockingPoints: acc.unblockingPoints,
                transparencyPoints: acc.transparencyPoints,
                kudosPoints: acc.kudosPoints,
                tasksAssigned: acc.tasksAssigned,
                tasksCompleted: acc.tasksCompleted,
                tasksInProgress: acc.tasksInProgress,
                tasksOnTime: acc.tasksOnTime,
                criticalCompleted: acc.criticalCompleted,
                completionRatePct,
                onTimeRatePct,
                feedbackNotesCount: acc.feedbackNotesCount,
                blockersResolvedCount: acc.blockersResolvedCount,
                blockersReportedCount: acc.blockersReportedCount,
                proofUploadsCount: acc.proofUploadsCount,
                kudosReceivedCount: acc.kudosReceivedCount,
                achievementsCount: acc.achievementsCount,
                needsEngagement: totalPoints === 0,
                badges,
                lastActiveAt: acc.lastActiveAt,
            };
        });

        // Sort: highest points first, then most tasks assigned
        members.sort((a, b) => {
            if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
            return b.tasksAssigned - a.tasksAssigned;
        });

        // 5. Team Summary & Habit Radar calculations
        const totalPoints = members.reduce((s, m) => s + m.totalPoints, 0);
        const activeMembersCount = members.filter(m => m.totalPoints > 0).length;
        const totalExec = members.reduce((s, m) => s + m.executionPoints, 0);
        const totalTime = members.reduce((s, m) => s + m.timelinessPoints, 0);
        const totalComm = members.reduce((s, m) => s + m.communicationPoints, 0);
        const totalUnblock = members.reduce((s, m) => s + m.unblockingPoints, 0);
        const totalTransp = members.reduce((s, m) => s + m.transparencyPoints, 0);

        const overallCompletionPct =
            totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
        const onTimeDeliveryPct =
            completedTasksCount > 0 ? Math.round((onTimeCompletedTasksCount / completedTasksCount) * 100) : 100;
        const engagementFreshnessPct =
            activeTasksCount > 0
                ? Math.min(100, Math.round((recentlyUpdatedActiveTasksCount / activeTasksCount) * 100))
                : completedTasksCount > 0
                ? 100
                : 0;

        const maxDim = Math.max(25, totalExec, totalTime, totalComm, totalUnblock, totalTransp);

        const habitRadarData = [
            {
                habit: 'Execution',
                score: Math.min(100, Math.round((totalExec / maxDim) * 100) || overallCompletionPct),
                rawPoints: totalExec,
                description: 'Priority-weighted task & section completions',
            },
            {
                habit: 'Timeliness',
                score: Math.min(100, Math.max(Math.round((totalTime / maxDim) * 100), onTimeDeliveryPct)),
                rawPoints: totalTime,
                description: 'Completing deliverables on or before due date',
            },
            {
                habit: 'Transparency',
                score: Math.min(100, Math.max(Math.round((totalTransp / maxDim) * 100), engagementFreshnessPct)),
                rawPoints: totalTransp,
                description: 'Incremental status updates (25% / 50% / 75%) & proof uploads',
            },
            {
                habit: 'Communication',
                score: Math.min(100, Math.round((totalComm / Math.max(15, maxDim * 0.5)) * 100)),
                rawPoints: totalComm,
                description: 'Task feedback notes, @mentions, and peer kudos',
            },
            {
                habit: 'Problem Solving',
                score: Math.min(100, Math.round((totalUnblock / Math.max(15, maxDim * 0.4)) * 100)),
                rawPoints: totalUnblock,
                description: 'Flagging blockers early & resolving impediments',
            },
        ];

        const categoryBreakdownData = [
            { id: 'Execution', label: 'Task & Section Delivery', value: totalExec, color: '#38bdf8' },
            { id: 'Timeliness', label: 'On-Time Bonus', value: totalTime, color: '#34d399' },
            { id: 'Transparency', label: 'Progress & Proof', value: totalTransp, color: '#fbbf24' },
            { id: 'Communication', label: 'Feedback & Kudos', value: totalComm, color: '#818cf8' },
            { id: 'Unblocking', label: 'Blocker Resolution', value: totalUnblock, color: '#f472b6' },
        ].filter(item => item.value > 0);

        const projectBarData = Object.values(projectPointsMap);
        const sectionBarData = Object.values(sectionPointsMap);

        const barUserKeysSet = new Set<string>();
        [...projectBarData, ...sectionBarData].forEach(row => {
            Object.keys(row).forEach(k => {
                if (k !== 'project' && k !== 'section') barUserKeysSet.add(k);
            });
        });

        // Sort Quick Wins by urgency (high -> medium -> low) and XP reward
        const urgencyRank = { high: 1, medium: 2, low: 3 };
        quickWins.sort((a, b) => {
            if (urgencyRank[a.urgency] !== urgencyRank[b.urgency]) {
                return urgencyRank[a.urgency] - urgencyRank[b.urgency];
            }
            return b.xpReward - a.xpReward;
        });

        // Deduplicate & sort Activity Feed newest first
        activityFeed.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        const mvpMember = members.length > 0 && members[0].totalPoints > 0 ? members[0] : null;
        const currentUserMetrics = options.currentUserId
            ? members.find(m => m.userId === options.currentUserId) || null
            : null;

        return {
            members,
            mvpMember,
            currentUserMetrics,
            summary: {
                totalPoints,
                activeMembersCount,
                totalMembersCount: members.length,
                tasksAssignedTotal: totalTasksCount,
                tasksCompletedTotal: completedTasksCount,
                overallCompletionPct,
                onTimeDeliveryPct,
                engagementFreshnessPct,
                totalFeedbackNotes: members.reduce((s, m) => s + m.feedbackNotesCount, 0),
                totalBlockersResolved: members.reduce((s, m) => s + m.blockersResolvedCount, 0),
                totalKudos: members.reduce((s, m) => s + m.kudosReceivedCount, 0),
            },
            habitRadarData,
            categoryBreakdownData,
            projectBarData,
            sectionBarData,
            barUserKeys: Array.from(barUserKeysSet),
            quickWins: quickWins.slice(0, 6),
            activityFeed: activityFeed.slice(0, 15),
        };
    },
};
