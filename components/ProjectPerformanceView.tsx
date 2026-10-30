import React, { useState, useEffect, useMemo } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsiveRadar } from '@nivo/radar';
import { ResponsivePie } from '@nivo/pie';
import {
    achievementService,
    PerformanceTimeRange,
    getRankTier,
} from '../services/achievementService';
import {
    Project,
    UserAchievement,
    MemberPerformanceMetrics,
    QuickWinOpportunity,
} from '../types';
import { useUserLookup } from '../hooks/useUserLookup';
import {
    StarIcon,
    TrophyIcon,
    SparklesIcon,
    FireIcon,
    CheckCircleIcon,
    ChatBubbleBottomCenterTextIcon,
    FlagIcon,
    ChartBarIcon,
    InfoIcon,
    XMarkIcon,
} from './icons';

interface ProjectPerformanceViewProps {
    projects: Project[];
    /** When provided, locks the view to this single project (Per-Project mode) */
    focusedProject?: Project;
    currentUserId?: string;
    currentUserName?: string;
    onJumpToTask?: (projectId: string, taskId: string, phaseId?: string) => void;
    showToast?: (msg: string) => void;
}

const KUDOS_PRESETS = [
    'Crushed a critical deliverable on time! 🚀',
    'Thanks for unblocking the team so quickly! 🛠️',
    'Awesome proactive updates and clear notes! 💬',
    'Going above and beyond for the project! ⭐',
];

const formatRelativeDate = (dateInput?: Date | null): string => {
    if (!dateInput) return 'No recent activity';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'No recent activity';
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const ProjectPerformanceView: React.FC<ProjectPerformanceViewProps> = ({
    projects,
    focusedProject,
    currentUserId,
    currentUserName,
    onJumpToTask,
    showToast,
}) => {
    const isSingleProjectMode = Boolean(focusedProject);
    const [achievements, setAchievements] = useState<UserAchievement[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<PerformanceTimeRange>('all');
    const [showMyProjectsOnly, setShowMyProjectsOnly] = useState(false);
    const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
    const [chartTab, setChartTab] = useState<'habits' | 'categories'>('habits');
    const [showRubricGuide, setShowRubricGuide] = useState(false);

    // Kudos Modal state
    const [kudosTarget, setKudosTarget] = useState<MemberPerformanceMetrics | null>(null);
    const [kudosMessage, setKudosMessage] = useState<string>(KUDOS_PRESETS[0]);
    const [sendingKudos, setSendingKudos] = useState(false);

    const { getUserDisplayName, getUserPhotoURL } = useUserLookup();

    const loadAchievements = async () => {
        const achData = await achievementService.getAllAchievements();
        setAchievements(achData);
        setLoading(false);
    };

    useEffect(() => {
        loadAchievements();
    }, []);

    // Build fallback user lookup from projects
    const projectUserLookup = useMemo(() => {
        const lookup = new Map<string, { displayName?: string; photoURL?: string; email: string }>();
        const sourceProjects = focusedProject ? [focusedProject] : projects;
        sourceProjects.forEach(project => {
            if (project.ownerId && project.ownerEmail && !lookup.has(project.ownerId)) {
                lookup.set(project.ownerId, {
                    displayName: project.ownerName,
                    photoURL: project.ownerPhotoURL,
                    email: project.ownerEmail,
                });
            }
            project.team?.members?.forEach(member => {
                if (member.uid && !lookup.has(member.uid)) {
                    lookup.set(member.uid, {
                        displayName: member.displayName,
                        photoURL: member.photoURL,
                        email: member.email,
                    });
                }
            });
        });
        return lookup;
    }, [projects, focusedProject]);

    const resolveDisplayName = (userId: string): string => {
        const name = getUserDisplayName(userId);
        if (name && name !== 'User' && name !== '?') return name;
        const projectUser = projectUserLookup.get(userId);
        if (projectUser?.displayName && !projectUser.displayName.includes('@')) {
            return projectUser.displayName;
        }
        if (projectUser?.email) {
            const emailName = projectUser.email.split('@')[0];
            return emailName
                .split(/[._-]/)
                .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ');
        }
        return 'Team Member';
    };

    const resolvePhotoURL = (userId: string): string => {
        const photo = getUserPhotoURL(userId);
        if (photo) return photo;
        const projectUser = projectUserLookup.get(userId);
        return projectUser?.photoURL || '';
    };

    // Determine effective projects list for global mode
    const effectiveProjects = useMemo(() => {
        if (focusedProject) return [focusedProject];
        let list = projects.filter(p => !p.isDeleted);
        if (showMyProjectsOnly && currentUserId) {
            list = list.filter(
                p =>
                    p.ownerId === currentUserId ||
                    p.memberUids?.includes(currentUserId) ||
                    p.team?.members?.some(m => m.uid === currentUserId)
            );
        }
        return list;
    }, [projects, focusedProject, showMyProjectsOnly, currentUserId]);

    const effectiveProjectId = useMemo(() => {
        if (focusedProject) return focusedProject.id;
        return selectedProjectFilter !== 'all' ? selectedProjectFilter : undefined;
    }, [focusedProject, selectedProjectFilter]);

    // Compute Hybrid Performance Analytics
    const analytics = useMemo(() => {
        return achievementService.computePerformanceAnalytics(effectiveProjects, achievements, {
            timeRange,
            projectId: effectiveProjectId,
            currentUserId,
            resolveDisplayName,
            resolvePhotoURL,
        });
    }, [effectiveProjects, achievements, timeRange, effectiveProjectId, currentUserId, getUserDisplayName]);

    const handleSendKudos = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!kudosTarget || sendingKudos) return;
        setSendingKudos(true);
        const senderName =
            currentUserName || (currentUserId ? resolveDisplayName(currentUserId) : 'A Teammate');
        const targetProjId = focusedProject?.id || (selectedProjectFilter !== 'all' ? selectedProjectFilter : undefined);
        const ok = await achievementService.sendKudos(
            kudosTarget.userId,
            { uid: currentUserId || 'anonymous', displayName: senderName },
            kudosMessage,
            targetProjId
        );
        setSendingKudos(false);
        if (ok) {
            showToast?.(`👏 Sent +5 XP Kudos to ${kudosTarget.displayName}!`);
            setKudosTarget(null);
            await loadAchievements();
        } else {
            showToast?.('Failed to send Kudos. Please try again.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-slate-400">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-secondary"></div>
            </div>
        );
    }

    const {
        members,
        mvpMember,
        currentUserMetrics,
        summary,
        habitRadarData,
        categoryBreakdownData,
        projectBarData,
        sectionBarData,
        barUserKeys,
        quickWins,
        activityFeed,
    } = analytics;

    const myTier = getRankTier(currentUserMetrics?.totalPoints || 0);
    const useSectionChart = isSingleProjectMode || Boolean(effectiveProjectId);
    const activeBarData = useSectionChart ? sectionBarData : projectBarData;
    const activeBarIndexKey = useSectionChart ? 'section' : 'project';

    return (
        <div className={`${isSingleProjectMode ? 'p-4 sm:p-6' : 'p-6 max-w-7xl mx-auto'} space-y-6`}>
            {/* ======== HEADER & CONTROLS BAR ======== */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className={`${isSingleProjectMode ? 'text-2xl' : 'text-3xl'} font-bold text-white flex items-center gap-2.5`}>
                            <TrophyIcon className="w-7 h-7 text-yellow-400" />
                            <span>
                                {focusedProject
                                    ? `${focusedProject.name} — Team Performance`
                                    : 'Performance & Engagement Hub'}
                            </span>
                        </h2>
                        <button
                            type="button"
                            onClick={() => setShowRubricGuide(prev => !prev)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 hover:bg-slate-700 text-brand-light border border-slate-700 transition-colors"
                            title="See how XP points and badges are earned"
                        >
                            <InfoIcon className="w-3.5 h-3.5" />
                            <span>{showRubricGuide ? 'Hide XP Rubric' : 'How XP Works'}</span>
                        </button>
                    </div>
                    <p className="text-slate-400 text-sm mt-1">
                        {focusedProject
                            ? 'Live execution velocity, habit radar, section breakdown, and team recognition for this project.'
                            : 'Live execution velocity, work-habit insights, and gamified incentives across your organization.'}
                    </p>
                </div>

                {/* Filters: All/My Projects + Project Dropdown + Time Range */}
                <div className="flex flex-wrap items-center gap-2.5">
                    {!isSingleProjectMode && (
                        <>
                            <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
                                <button
                                    type="button"
                                    onClick={() => setShowMyProjectsOnly(false)}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                                        !showMyProjectsOnly
                                            ? 'bg-brand-secondary text-white'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    All Projects
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowMyProjectsOnly(true)}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                                        showMyProjectsOnly
                                            ? 'bg-brand-secondary text-white'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    My Projects
                                </button>
                            </div>

                            <select
                                value={selectedProjectFilter}
                                onChange={e => setSelectedProjectFilter(e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg px-3 py-2 focus:ring-1 focus:ring-brand-secondary focus:border-brand-secondary"
                                aria-label="Filter by project"
                            >
                                <option value="all">All Visible Projects ({effectiveProjects.length})</option>
                                {effectiveProjects.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </>
                    )}

                    {/* Time Range Pills */}
                    <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
                        {(
                            [
                                { id: 'all', label: 'All Time' },
                                { id: 'month', label: 'This Month' },
                                { id: 'week', label: 'This Week' },
                            ] as { id: PerformanceTimeRange; label: string }[]
                        ).map(t => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTimeRange(t.id)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                                    timeRange === t.id
                                        ? 'bg-brand-secondary text-white shadow-xs'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ======== COLLAPSIBLE XP RUBRIC GUIDE ======== */}
            {showRubricGuide && (
                <div className="bg-slate-800/90 border border-brand-secondary/40 rounded-xl p-4 shadow-lg space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            <SparklesIcon className="w-4 h-4 text-brand-light" />
                            <span>How to Earn XP & Unlock Badges in VantageFlow</span>
                        </h4>
                        <button
                            type="button"
                            onClick={() => setShowRubricGuide(false)}
                            className="text-slate-400 hover:text-white p-1"
                        >
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-700/80">
                            <div className="font-bold text-sky-400 mb-1">🚀 Priority Execution</div>
                            <p className="text-slate-300">
                                Complete tasks to earn priority-weighted points: <strong>🔴 Critical (+25 XP)</strong>,{' '}
                                <strong>🟠 Important (+15 XP)</strong>, <strong>🔵 Enhancement (+10 XP)</strong>, and{' '}
                                <strong>Section 100% (+50 XP)</strong>.
                            </p>
                        </div>
                        <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-700/80">
                            <div className="font-bold text-emerald-400 mb-1">🎯 On-Time & Progress</div>
                            <p className="text-slate-300">
                                Finish on or before the due date for <strong>+10 XP On-Time Bonus</strong>. Update in-progress tasks (
                                <strong>25% = +3 XP</strong>, <strong>50% = +5 XP</strong>, <strong>75% = +8 XP</strong>) & attach proof (
                                <strong>+5 XP</strong>).
                            </p>
                        </div>
                        <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-700/80">
                            <div className="font-bold text-indigo-400 mb-1">💬 Communication & Unblocking</div>
                            <p className="text-slate-300">
                                Post Task Feedback Notes or @mentions (<strong>+3 XP each</strong>). Flag blockers early (
                                <strong>+2 XP</strong>) and resolve blockers (<strong>+10 XP</strong>).
                            </p>
                        </div>
                        <div className="bg-slate-900/70 p-3 rounded-lg border border-slate-700/80">
                            <div className="font-bold text-pink-400 mb-1">👏 Peer Kudos & Ranks</div>
                            <p className="text-slate-300">
                                Send or receive <strong>Peer Kudos (+5 XP)</strong> on the scorecard below. Climb from{' '}
                                <strong>⭐ Contributor</strong> to <strong>⭐⭐⭐⭐⭐ Vantage Legend (1000+ XP)</strong>!
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ======== MY RANK & XP PROGRESSION + MVP SPOTLIGHT BANNER ======== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left 2 cols: Current User Rank & Next Star Progress */}
                <div className="lg:col-span-2 bg-gradient-to-r from-slate-800/90 via-slate-800/75 to-slate-900/90 border border-slate-700 rounded-xl p-5 flex flex-col justify-between gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-xl bg-brand-secondary/20 border border-brand-secondary/40 flex items-center justify-center text-yellow-400 shadow-inner">
                                <StarIcon className="w-7 h-7 fill-yellow-400" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold uppercase tracking-wider text-brand-light">
                                        Your Standing
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                                        Lv {myTier.starRating} • {myTier.rankTitle}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-2xl font-extrabold text-white">
                                        {currentUserMetrics?.totalPoints || 0} XP
                                    </span>
                                    <div className="flex items-center">
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <StarIcon
                                                key={s}
                                                className={`w-4 h-4 ${
                                                    s <= myTier.starRating
                                                        ? 'text-yellow-400 fill-yellow-400'
                                                        : 'text-slate-600'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* User's Earned Specialty Badges */}
                        {currentUserMetrics && currentUserMetrics.badges.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {currentUserMetrics.badges.map(badge => (
                                    <span
                                        key={badge.id}
                                        title={badge.description}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.colorClass}`}
                                    >
                                        <span>{badge.icon}</span>
                                        <span>{badge.label}</span>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Progress bar to next star tier */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-300 font-medium">
                                {myTier.nextRankTitle
                                    ? `Progress to Lv ${myTier.starRating + 1}: ${myTier.nextRankTitle}`
                                    : 'Maximum Rank Achieved — Vantage Legend! 🏆'}
                            </span>
                            <span className="text-brand-light font-bold">
                                {myTier.nextRankTitle
                                    ? `${myTier.pointsToNextStar} XP to next star (${myTier.progressToNextStarPct}%)`
                                    : '100%'}
                            </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700/80">
                            <div
                                className="h-full bg-gradient-to-r from-brand-secondary via-sky-400 to-emerald-400 rounded-full transition-all duration-500"
                                style={{ width: `${Math.max(4, myTier.progressToNextStarPct)}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Right 1 col: MVP / Top Performer Spotlight */}
                <div className="bg-gradient-to-br from-yellow-500/15 via-amber-500/10 to-slate-800/90 border border-yellow-500/30 rounded-xl p-5 flex items-center justify-between gap-4">
                    {mvpMember ? (
                        <>
                            <div className="space-y-1 min-w-0">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-yellow-300">
                                    <TrophyIcon className="w-3.5 h-3.5" />
                                    {isSingleProjectMode ? 'Project MVP' : 'Top Performer'}
                                </span>
                                <p className="text-xl font-bold text-white truncate">{mvpMember.displayName}</p>
                                <p className="text-xs text-yellow-200/80 font-medium">
                                    {mvpMember.rankTitle} • {mvpMember.tasksCompleted} tasks delivered
                                </p>
                                <div className="pt-1 flex items-center gap-2">
                                    <span className="text-lg font-extrabold text-yellow-400">
                                        {mvpMember.totalPoints} XP
                                    </span>
                                    {mvpMember.userId !== currentUserId && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setKudosTarget(mvpMember);
                                                setKudosMessage(KUDOS_PRESETS[0]);
                                            }}
                                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-200 border border-yellow-500/40 transition-colors"
                                        >
                                            👏 Send Kudos
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="relative flex-shrink-0">
                                {mvpMember.photoURL ? (
                                    <img
                                        src={mvpMember.photoURL}
                                        alt={mvpMember.displayName}
                                        className="w-16 h-16 rounded-full object-cover border-2 border-yellow-400 shadow-lg"
                                    />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-yellow-500/20 border-2 border-yellow-400 flex items-center justify-center text-2xl font-bold text-yellow-300">
                                        {(mvpMember.displayName || 'U').charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <span className="absolute -bottom-1 -right-1 bg-yellow-400 text-slate-900 text-xs font-extrabold px-1.5 py-0.5 rounded-full shadow">
                                    #1
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className="text-slate-400 text-sm">
                            No points recorded yet in this period. Complete or update a task below to claim the #1 spot!
                        </div>
                    )}
                </div>
            </div>

            {/* ======== 4 EXECUTIVE KPI SUMMARY CARDS ======== */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
                        <span>Total Velocity Points</span>
                        <SparklesIcon className="w-4 h-4 text-sky-400" />
                    </div>
                    <div className="text-2xl font-extrabold text-white">{summary.totalPoints.toLocaleString()} XP</div>
                    <div className="text-xs text-slate-400 mt-1">
                        <span className="text-emerald-400 font-semibold">
                            {summary.activeMembersCount} of {summary.totalMembersCount}
                        </span>{' '}
                        team members active
                    </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
                        <span>Task Completion Rate</span>
                        <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-extrabold text-white">{summary.overallCompletionPct}%</div>
                    <div className="text-xs text-slate-400 mt-1">
                        <span className="text-white font-semibold">{summary.tasksCompletedTotal}</span> of{' '}
                        {summary.tasksAssignedTotal} assigned tasks done
                    </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
                        <span>On-Time Delivery</span>
                        <FireIcon className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-extrabold text-white">{summary.onTimeDeliveryPct}%</div>
                    <div className="text-xs text-slate-400 mt-1">
                        Tasks delivered on or before target end date (+10 XP bonus)
                    </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
                        <span>Collaboration & Unblocking</span>
                        <ChatBubbleBottomCenterTextIcon className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="text-2xl font-extrabold text-white">
                        {summary.totalFeedbackNotes + summary.totalBlockersResolved + summary.totalKudos}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                        <span className="text-indigo-300 font-semibold">{summary.totalFeedbackNotes}</span> notes •{' '}
                        <span className="text-purple-300 font-semibold">{summary.totalBlockersResolved}</span> unblocked •{' '}
                        <span className="text-pink-300 font-semibold">{summary.totalKudos}</span> kudos
                    </div>
                </div>
            </div>

            {/* ======== PERSONALIZED "EARN POINTS NOW / QUICK WINS" BOOSTER ======== */}
            {quickWins.length > 0 && (
                <div className="bg-gradient-to-r from-brand-secondary/15 via-slate-800/80 to-slate-800/90 border border-brand-secondary/35 rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-brand-secondary text-white text-xs font-bold uppercase tracking-wider">
                                ⚡ Boost Your Score
                            </span>
                            <h3 className="text-base font-bold text-white">
                                Quick Wins Available Right Now
                            </h3>
                        </div>
                        <span className="text-xs text-slate-400">
                            Take action on these tasks to keep the project accurate and earn instant XP
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {quickWins.slice(0, 3).map((qw: QuickWinOpportunity) => (
                            <div
                                key={qw.id}
                                className="bg-slate-900/85 border border-slate-700/80 hover:border-brand-secondary/60 rounded-lg p-3.5 flex flex-col justify-between gap-3 transition-all"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-semibold text-slate-400 truncate">
                                            {isSingleProjectMode ? qw.phaseName : `${qw.projectName} • ${qw.phaseName}`}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex-shrink-0">
                                            +{qw.xpReward} XP
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-white line-clamp-1" title={qw.taskName}>
                                        {qw.taskName}
                                    </p>
                                    <p className="text-xs text-slate-400 line-clamp-2">{qw.reason}</p>
                                </div>
                                {onJumpToTask && (
                                    <button
                                        type="button"
                                        onClick={() => onJumpToTask(qw.projectId, qw.taskId, qw.phaseId)}
                                        className="w-full py-1.5 px-3 rounded-lg bg-brand-secondary/20 hover:bg-brand-secondary text-brand-light hover:text-white border border-brand-secondary/40 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                                    >
                                        <span>🎯 {qw.actionLabel}</span>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ======== VISUAL INSIGHTS ROW: STACKED BAR + HABIT RADAR / DONUT ======== */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left 3 cols: Points by Section (Project Mode) or Points by Project (Global Mode) */}
                <div className="lg:col-span-3 bg-slate-800/50 rounded-xl border border-slate-700 p-5 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <ChartBarIcon className="w-5 h-5 text-brand-light" />
                                <span>
                                    {useSectionChart ? 'Points by Section / Phase' : 'Points by Project'}
                                </span>
                            </h3>
                            <p className="text-xs text-slate-400">
                                {useSectionChart
                                    ? 'Stacked team member contributions across each section of this project'
                                    : 'Stacked team member contributions across active projects'}
                            </p>
                        </div>
                    </div>

                    <div className="flex-grow min-h-[310px]">
                        {activeBarData.length > 0 && barUserKeys.length > 0 ? (
                            <ResponsiveBar
                                data={activeBarData}
                                keys={barUserKeys}
                                indexBy={activeBarIndexKey}
                                margin={{ top: 20, right: 130, bottom: 60, left: 55 }}
                                padding={0.32}
                                valueScale={{ type: 'linear' }}
                                indexScale={{ type: 'band', round: true }}
                                colors={{ scheme: 'nivo' }}
                                theme={{
                                    text: { fill: '#94a3b8' },
                                    axis: {
                                        ticks: { text: { fill: '#94a3b8', fontSize: 11 } },
                                        legend: { text: { fill: '#94a3b8', fontSize: 12 } },
                                    },
                                    grid: { line: { stroke: '#334155' } },
                                    legends: { text: { fill: '#94a3b8', fontSize: 11 } },
                                    tooltip: {
                                        container: {
                                            background: '#0f172a',
                                            color: '#f8fafc',
                                            borderRadius: '8px',
                                            border: '1px solid #334155',
                                        },
                                    },
                                }}
                                borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
                                axisTop={null}
                                axisRight={null}
                                axisBottom={{
                                    tickSize: 5,
                                    tickPadding: 5,
                                    tickRotation: activeBarData.length > 4 ? -18 : 0,
                                    legend: useSectionChart ? 'Project Section' : 'Project',
                                    legendPosition: 'middle',
                                    legendOffset: 46,
                                    format: v =>
                                        typeof v === 'string' && v.length > 18 ? `${v.slice(0, 16)}…` : v,
                                }}
                                axisLeft={{
                                    tickSize: 5,
                                    tickPadding: 5,
                                    tickRotation: 0,
                                    legend: 'XP Points',
                                    legendPosition: 'middle',
                                    legendOffset: -42,
                                }}
                                legends={[
                                    {
                                        dataFrom: 'keys',
                                        anchor: 'bottom-right',
                                        direction: 'column',
                                        justify: false,
                                        translateX: 120,
                                        translateY: 0,
                                        itemsSpacing: 4,
                                        itemWidth: 105,
                                        itemHeight: 18,
                                        itemDirection: 'left-to-right',
                                        itemOpacity: 0.9,
                                        symbolSize: 14,
                                    },
                                ]}
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                                No point activity recorded for this filter yet.
                            </div>
                        )}
                    </div>
                </div>

                {/* Right 2 cols: 5-Dimension Work-Habit Radar & Category Donut Toggle */}
                <div className="lg:col-span-2 bg-slate-800/50 rounded-xl border border-slate-700 p-5 flex flex-col">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <div>
                            <h3 className="text-lg font-bold text-white">Team Work-Habit Profile</h3>
                            <p className="text-xs text-slate-400">
                                Balance of execution, timeliness, updates & collaboration
                            </p>
                        </div>
                        <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-700 text-xs">
                            <button
                                type="button"
                                onClick={() => setChartTab('habits')}
                                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                                    chartTab === 'habits'
                                        ? 'bg-brand-secondary text-white'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Radar
                            </button>
                            <button
                                type="button"
                                onClick={() => setChartTab('categories')}
                                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                                    chartTab === 'categories'
                                        ? 'bg-brand-secondary text-white'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Breakdown
                            </button>
                        </div>
                    </div>

                    <div className="flex-grow min-h-[260px]">
                        {chartTab === 'habits' ? (
                            <ResponsiveRadar
                                data={habitRadarData}
                                keys={['score']}
                                indexBy="habit"
                                maxValue={100}
                                margin={{ top: 35, right: 65, bottom: 35, left: 65 }}
                                curve="linearClosed"
                                borderWidth={2}
                                borderColor="#38bdf8"
                                gridLevels={4}
                                gridShape="circular"
                                gridLabelOffset={14}
                                enableDots={true}
                                dotSize={8}
                                dotColor="#0f172a"
                                dotBorderWidth={2}
                                dotBorderColor="#38bdf8"
                                colors={['rgba(56, 189, 248, 0.35)']}
                                fillOpacity={0.45}
                                blendMode="normal"
                                theme={{
                                    text: { fill: '#cbd5e1', fontSize: 11 },
                                    grid: { line: { stroke: '#334155' } },
                                    tooltip: {
                                        container: {
                                            background: '#0f172a',
                                            color: '#f8fafc',
                                            borderRadius: '8px',
                                            border: '1px solid #334155',
                                        },
                                    },
                                }}
                            />
                        ) : categoryBreakdownData.length > 0 ? (
                            <ResponsivePie
                                data={categoryBreakdownData}
                                margin={{ top: 20, right: 40, bottom: 40, left: 40 }}
                                innerRadius={0.55}
                                padAngle={1.5}
                                cornerRadius={4}
                                activeOuterRadiusOffset={6}
                                colors={{ datum: 'data.color' }}
                                borderWidth={1}
                                borderColor={{ from: 'color', modifiers: [['darker', 0.4]] }}
                                arcLinkLabelsSkipAngle={10}
                                arcLinkLabelsTextColor="#cbd5e1"
                                arcLinkLabelsThickness={1.5}
                                arcLinkLabelsColor={{ from: 'color' }}
                                arcLabelsSkipAngle={15}
                                arcLabelsTextColor="#0f172a"
                                theme={{
                                    tooltip: {
                                        container: {
                                            background: '#0f172a',
                                            color: '#f8fafc',
                                            borderRadius: '8px',
                                            border: '1px solid #334155',
                                        },
                                    },
                                }}
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                                No category points recorded yet.
                            </div>
                        )}
                    </div>

                    {/* Dimension Legend Pills */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-700/60 text-[11px]">
                        {habitRadarData.map(h => (
                            <div
                                key={h.habit}
                                className="bg-slate-900/50 px-2.5 py-1.5 rounded-lg border border-slate-700/50 flex items-center justify-between"
                                title={h.description}
                            >
                                <span className="text-slate-300 font-medium truncate">{h.habit}</span>
                                <span className="text-brand-light font-bold ml-1.5">{h.rawPoints} XP</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ======== TEAM SCORECARD & LEADERBOARD + ACTIVITY STREAM ======== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 cols: Comprehensive Member Scorecard */}
                <div className="lg:col-span-2 bg-slate-800/50 rounded-xl border border-slate-700 p-5 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <StarIcon className="w-5 h-5 text-yellow-400" />
                                <span>Team Member Scorecard & Recognition</span>
                            </h3>
                            <p className="text-xs text-slate-400">
                                Complete breakdown of delivery, timeliness, communication & engagement across all assigned members
                            </p>
                        </div>
                        <span className="text-xs text-slate-400 font-medium">
                            {members.length} {members.length === 1 ? 'Member' : 'Members'}
                        </span>
                    </div>

                    <div className="space-y-3">
                        {members.map((member, idx) => {
                            const isTop3 = idx < 3 && member.totalPoints > 0;
                            const isMe = currentUserId === member.userId;

                            return (
                                <div
                                    key={member.userId}
                                    className={`p-4 rounded-xl border transition-all ${
                                        member.needsEngagement
                                            ? 'bg-slate-900/50 border-amber-500/30'
                                            : isTop3
                                            ? 'bg-slate-800/90 border-slate-600 shadow-sm'
                                            : 'bg-slate-900/40 border-slate-700/60'
                                    }`}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        {/* Rank + Avatar + Name + Badges */}
                                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                                            <div
                                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                                                    member.needsEngagement
                                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                                        : idx === 0
                                                        ? 'bg-yellow-500 text-slate-900'
                                                        : idx === 1
                                                        ? 'bg-slate-300 text-slate-900'
                                                        : idx === 2
                                                        ? 'bg-amber-700 text-white'
                                                        : 'bg-slate-700 text-slate-300'
                                                }`}
                                            >
                                                {member.needsEngagement ? '!' : idx + 1}
                                            </div>

                                            <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden flex-shrink-0 border border-slate-600">
                                                {member.photoURL ? (
                                                    <img
                                                        src={member.photoURL}
                                                        alt={member.displayName}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white">
                                                        {(member.displayName || 'U').charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="min-w-0 space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-white text-sm truncate">
                                                        {member.displayName}
                                                        {isMe && (
                                                            <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand-secondary/30 text-brand-light">
                                                                You
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="text-xs text-slate-400 font-medium">
                                                        • {member.rankTitle}
                                                    </span>
                                                    {member.needsEngagement && (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                                            Needs Engagement
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Specialty Badges */}
                                                {member.badges.length > 0 ? (
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {member.badges.map(b => (
                                                            <span
                                                                key={b.id}
                                                                title={b.description}
                                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${b.colorClass}`}
                                                            >
                                                                <span>{b.icon}</span>
                                                                <span>{b.label}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-slate-500">
                                                        Last active: {formatRelativeDate(member.lastActiveAt)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right Side: Points, Stars & Kudos Button */}
                                        <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                                            <div className="text-left sm:text-right">
                                                <div className="text-lg font-extrabold text-brand-light">
                                                    {member.totalPoints} XP
                                                </div>
                                                <div className="flex items-center sm:justify-end gap-0.5">
                                                    {[1, 2, 3, 4, 5].map(s => (
                                                        <StarIcon
                                                            key={s}
                                                            className={`w-3.5 h-3.5 ${
                                                                s <= member.starRating
                                                                    ? 'text-yellow-400 fill-yellow-400'
                                                                    : 'text-slate-700'
                                                            }`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>

                                            {!isMe && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setKudosTarget(member);
                                                        setKudosMessage(KUDOS_PRESETS[0]);
                                                    }}
                                                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-pink-500/20 text-slate-300 hover:text-pink-200 border border-slate-700 hover:border-pink-500/40 transition-colors"
                                                    title={`Send +5 XP Peer Kudos to ${member.displayName}`}
                                                >
                                                    👏 Kudos
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Metrics Strip */}
                                    <div className="mt-3 pt-2.5 border-t border-slate-700/50 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                                        <div className="bg-slate-900/60 px-2.5 py-1.5 rounded-lg">
                                            <span className="text-slate-400 block text-[10px]">Tasks Done</span>
                                            <span className="font-bold text-white">
                                                {member.tasksCompleted}/{member.tasksAssigned}{' '}
                                                <span className="text-slate-400 font-normal">
                                                    ({member.completionRatePct}%)
                                                </span>
                                            </span>
                                        </div>
                                        <div className="bg-slate-900/60 px-2.5 py-1.5 rounded-lg">
                                            <span className="text-slate-400 block text-[10px]">On-Time Rate</span>
                                            <span className="font-bold text-emerald-400">
                                                {member.tasksCompleted > 0 ? `${member.onTimeRatePct}%` : '—'}
                                            </span>
                                        </div>
                                        <div className="bg-slate-900/60 px-2.5 py-1.5 rounded-lg">
                                            <span className="text-slate-400 block text-[10px]">Feedback Notes</span>
                                            <span className="font-bold text-indigo-300">
                                                {member.feedbackNotesCount} posted
                                            </span>
                                        </div>
                                        <div className="bg-slate-900/60 px-2.5 py-1.5 rounded-lg">
                                            <span className="text-slate-400 block text-[10px]">Blockers Solved</span>
                                            <span className="font-bold text-purple-300">
                                                {member.blockersResolvedCount} resolved
                                            </span>
                                        </div>
                                        <div className="bg-slate-900/60 px-2.5 py-1.5 rounded-lg col-span-2 sm:col-span-1">
                                            <span className="text-slate-400 block text-[10px]">Next Star</span>
                                            <span className="font-bold text-amber-300">
                                                {member.pointsToNextStar > 0
                                                    ? `${member.pointsToNextStar} XP away`
                                                    : 'Max Tier ⭐'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right 1 col: Live Activity, Achievements & Kudos Stream */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5 flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                        <SparklesIcon className="w-5 h-5 text-brand-light" />
                        <span>Recent XP & Kudos Feed</span>
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">
                        Live log of completions, updates, blocker resolutions & peer recognition
                    </p>

                    {activityFeed.length > 0 ? (
                        <div className="space-y-3 overflow-y-auto max-h-[540px] pr-1">
                            {activityFeed.map(item => (
                                <div
                                    key={item.id}
                                    className="p-3 rounded-lg bg-slate-900/70 border border-slate-700/60 space-y-1"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-bold text-white truncate">
                                            {item.userName || resolveDisplayName(item.userId)}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-brand-secondary/20 text-brand-light border border-brand-secondary/30 flex-shrink-0">
                                            +{item.points} XP
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-300 leading-relaxed">{item.description}</p>
                                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                                        <span className="truncate max-w-[160px]">{item.projectName || ''}</span>
                                        <span>{formatRelativeDate(item.timestamp)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex-grow flex items-center justify-center text-slate-500 text-sm text-center py-12">
                            No recent achievement events in this window. Update a task or send Kudos to start the stream!
                        </div>
                    )}
                </div>
            </div>

            {/* ======== PEER KUDOS MODAL ======== */}
            {kudosTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <span>👏 Send Peer Kudos (+5 XP)</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setKudosTarget(null)}
                                className="text-slate-400 hover:text-white p-1"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-xs text-slate-300">
                            Recognize <strong className="text-white">{kudosTarget.displayName}</strong> for great
                            execution, helpfulness, or proactive communication. They will immediately receive{' '}
                            <strong className="text-emerald-400">+5 XP</strong> on the leaderboard!
                        </p>

                        <form onSubmit={handleSendKudos} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    Quick Presets
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                    {KUDOS_PRESETS.map(preset => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => setKudosMessage(preset)}
                                            className={`text-left text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                                                kudosMessage === preset
                                                    ? 'bg-pink-500/20 text-pink-200 border-pink-500/50'
                                                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                                            }`}
                                        >
                                            {preset}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    Shoutout Message
                                </label>
                                <textarea
                                    rows={3}
                                    value={kudosMessage}
                                    onChange={e => setKudosMessage(e.target.value)}
                                    placeholder="Write a short shoutout message..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-brand-secondary focus:border-brand-secondary"
                                    required
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setKudosTarget(null)}
                                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={sendingKudos}
                                    className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white shadow-md disabled:opacity-50"
                                >
                                    {sendingKudos ? 'Sending...' : '👏 Award +5 XP Kudos'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectPerformanceView;

