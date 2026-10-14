import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getFirestore, collection, query, where, orderBy, onSnapshot, updateDoc, doc, limit } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { Notification, Project, Task, TaskStatus } from '../types';
import { BellIcon, SparklesIcon, FlagIcon, ChevronDownIcon, CheckCircleIcon } from './icons';

interface NotificationCenterProps {
    projects?: Project[];
    onSelectTask?: (projectId: string, taskId: string) => void;
}

type FilterTab = 'all' | 'assigned' | 'comments' | 'blockers';

interface HeadsUpNotificationItem {
    id: string;
    notificationId?: string;
    projectId: string;
    projectName: string;
    phaseName?: string;
    taskId?: string;
    taskName: string;
    status?: TaskStatus | string;
    hasBlocker: boolean;
    blockerDescription?: string;
    type: 'assigned' | 'mention' | 'comment' | 'blocker' | 'blocker_cleared' | 'completed';
    badgeLabel: string;
    badgeStyle: string;
    contextText?: string;
    authorName?: string;
    createdAt: Date;
    read: boolean;
    link?: string;
}

const formatRelativeTime = (dateInput: Date | string | null | undefined): string => {
    if (!dateInput) return '';
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 0) return 'Just now';
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const extractTaskId = (link?: string): string => {
    if (!link) return '';
    try {
        const url = new URL(link, 'http://localhost');
        return url.searchParams.get('taskId') || '';
    } catch {
        const match = link.match(/[?&]taskId=([^&]+)/);
        return match ? decodeURIComponent(match[1]) : '';
    }
};

const extractTaskName = (message: string): string => {
    const match = message.match(/"([^"]+)"/);
    if (match) return match[1];
    const onMatch = message.match(/on ([^:]+):/);
    if (onMatch) return onMatch[1].replace(/["']/g, '');
    return '';
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ projects = [], onSelectTask }) => {
    const [rawNotifications, setRawNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
    const dropdownRef = useRef<HTMLDivElement>(null);
    const auth = getAuth();
    const db = getFirestore();
    const navigate = useNavigate();

    const currentUser = auth.currentUser;

    // Helper map to quickly find tasks in projects prop
    const taskLookup = useMemo(() => {
        const map = new Map<string, { task: Task; phaseName: string; projectName: string; projectId: string }>();
        projects.forEach(p => {
            (p.phases || []).forEach(ph => {
                const scan = (tasks: Task[]) => {
                    tasks.forEach(t => {
                        map.set(t.id, { task: t, phaseName: ph.name, projectName: p.name, projectId: p.id });
                        if (t.subTasks) scan(t.subTasks);
                    });
                };
                scan(ph.tasks || []);
            });
        });
        return map;
    }, [projects]);

    // Listen for Firestore in-app notifications
    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid),
            orderBy('createdAt', 'desc'),
            limit(40)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs: Notification[] = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data() as Omit<Notification, 'id'>;
                msgs.push({ ...data, id: docSnap.id });
            });
            setRawNotifications(msgs);
        });

        return () => unsubscribe();
    }, [currentUser]);

    // Handle outside click to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Transform and filter items so ONLY user's assigned and commented to items appear, excluding self-actions
    const headsUpItems = useMemo<HeadsUpNotificationItem[]>(() => {
        if (!currentUser) return [];

        const currentUid = currentUser.uid;
        const currentEmail = (currentUser.email || '').toLowerCase();
        const currentName = (currentUser.displayName || currentEmail.split('@')[0] || '').toLowerCase();

        const items: HeadsUpNotificationItem[] = [];
        const seenKeys = new Set<string>();

        // 1. Process Firestore notifications
        rawNotifications.forEach(n => {
            const rawMsg = n.message || '';
            const lowerMsg = rawMsg.toLowerCase();

            // Self-Action exclusion: if the user performed this action themself, skip it!
            if (
                lowerMsg.includes(`${currentName} completed task`) ||
                (n.type === 'task_completed' && lowerMsg.startsWith(`🎉 ${currentName}`)) ||
                (n.type === 'task_feedback_added' && lowerMsg.startsWith(`💬 ${currentName}`)) ||
                (n.type === 'task_impediment_reported' && lowerMsg.includes(`${currentName} flagged`))
            ) {
                return;
            }

            const tId = n.taskId || extractTaskId(n.link);
            const liveMatch = tId ? taskLookup.get(tId) : undefined;
            const taskName = n.taskName || liveMatch?.task.name || extractTaskName(rawMsg) || 'Task Activity';
            const phaseName = n.phaseName || liveMatch?.phaseName || '';
            const projectName = n.projectName || liveMatch?.projectName || 'Project';
            const projectId = n.projectId || liveMatch?.projectId || '';

            // Classify item type & badge
            let type: HeadsUpNotificationItem['type'] = 'comment';
            let badgeLabel = 'Note';
            let badgeStyle = 'bg-blue-500/20 text-blue-300 border-blue-500/30';

            if (n.type === 'task_feedback_mention' || lowerMsg.includes('mentioned you') || lowerMsg.includes('@')) {
                type = 'mention';
                badgeLabel = '@Mention';
                badgeStyle = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
            } else if (n.type === 'responsibility_assigned' || lowerMsg.includes('assigned to')) {
                type = 'assigned';
                badgeLabel = 'Assigned';
                badgeStyle = 'bg-brand-secondary/20 text-brand-light border-brand-secondary/35';
            } else if (n.type === 'task_impediment_reported' || lowerMsg.includes('blocker') || lowerMsg.includes('impediment')) {
                type = 'blocker';
                badgeLabel = 'Blocked';
                badgeStyle = 'bg-red-500/20 text-red-300 border-red-500/40';
            } else if (n.type === 'task_impediment_resolved' || lowerMsg.includes('resolved')) {
                type = 'blocker_cleared';
                badgeLabel = 'Resolved';
                badgeStyle = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
            } else if (n.type === 'task_completed') {
                type = 'completed';
                badgeLabel = 'Done';
                badgeStyle = 'bg-green-500/20 text-green-300 border-green-500/30';
            }

            // Clean context text
            let contextText = rawMsg;
            if (rawMsg.includes(': ')) {
                contextText = rawMsg.split(': ').slice(1).join(': ');
            }

            const createdDate = (n.createdAt as any)?.toDate ? (n.createdAt as any).toDate() : new Date(n.createdAt || Date.now());

            const itemKey = `notif_${n.id}`;
            seenKeys.add(itemKey);

            items.push({
                id: itemKey,
                notificationId: n.id,
                projectId,
                projectName,
                phaseName,
                taskId: tId,
                taskName,
                status: liveMatch?.task.status,
                hasBlocker: Boolean(liveMatch?.task.impediment && !liveMatch?.task.impediment.resolved) || type === 'blocker',
                blockerDescription: liveMatch?.task.impediment?.description,
                type,
                badgeLabel,
                badgeStyle,
                contextText,
                authorName: n.authorName,
                createdAt: createdDate,
                read: n.read ?? false,
                link: n.link,
            });
        });

        // 2. Also incorporate active user-assigned tasks and tasks with mentions from projects that might not be in notifications collection
        projects.forEach(project => {
            if (project.isDeleted || project.isArchived) return;

            (project.phases || []).forEach(phase => {
                const inspect = (tasks: Task[]) => {
                    tasks.forEach(task => {
                        const isAssigned = Boolean(
                            task.assignees?.some(a => a.uid === currentUid || (currentEmail && a.email?.toLowerCase() === currentEmail))
                        );

                        // Check for recent comments directed or mentioning user
                        const userMentions = (task.feedbackNotes || []).filter(note => {
                            if (note.author?.uid === currentUid) return false;
                            const msg = (note.message || '').toLowerCase();
                            return (
                                note.mentionedUids?.includes(currentUid) ||
                                (currentName && msg.includes(`@${currentName}`)) ||
                                (currentEmail && msg.includes(`@${currentEmail}`))
                            );
                        });

                        const latestMentionNote = userMentions.length > 0 ? userMentions[userMentions.length - 1] : null;

                        // Only add if user is assigned or directly commented/mentioned
                        if (isAssigned || latestMentionNote) {
                            const dedupeKey = `proj_${project.id}_${task.id}`;
                            // If we already have a recent unread notification for this task, avoid duplicating
                            const alreadyNotified = items.some(i => i.taskId === task.id && !i.read);
                            if (!alreadyNotified && !seenKeys.has(dedupeKey)) {
                                seenKeys.add(dedupeKey);

                                const hasBlocker = Boolean(task.impediment && !task.impediment.resolved);
                                const noteDate = latestMentionNote
                                    ? new Date(latestMentionNote.createdAt)
                                    : (task.statusUpdatedAt || task.updatedAt ? new Date(task.statusUpdatedAt || task.updatedAt!) : new Date(task.startDate || Date.now()));

                                if (latestMentionNote) {
                                    items.push({
                                        id: dedupeKey,
                                        projectId: project.id,
                                        projectName: project.name,
                                        phaseName: phase.name,
                                        taskId: task.id,
                                        taskName: task.name,
                                        status: task.status,
                                        hasBlocker,
                                        type: 'mention',
                                        badgeLabel: '@Mention',
                                        badgeStyle: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
                                        contextText: latestMentionNote.message,
                                        authorName: latestMentionNote.author?.displayName || latestMentionNote.author?.email?.split('@')[0],
                                        createdAt: noteDate,
                                        read: true,
                                    });
                                } else if (hasBlocker) {
                                    items.push({
                                        id: dedupeKey,
                                        projectId: project.id,
                                        projectName: project.name,
                                        phaseName: phase.name,
                                        taskId: task.id,
                                        taskName: task.name,
                                        status: task.status,
                                        hasBlocker: true,
                                        blockerDescription: task.impediment?.description,
                                        type: 'blocker',
                                        badgeLabel: 'Blocked',
                                        badgeStyle: 'bg-red-500/20 text-red-300 border-red-500/40',
                                        contextText: task.impediment?.description,
                                        createdAt: task.impediment?.reportedAt ? new Date(task.impediment.reportedAt) : noteDate,
                                        read: true,
                                    });
                                }
                            }
                        }

                        if (task.subTasks) inspect(task.subTasks);
                    });
                };
                inspect(phase.tasks || []);
            });
        });

        // Sort: Unread first, then by date descending
        items.sort((a, b) => {
            if (!a.read && b.read) return -1;
            if (a.read && !b.read) return 1;
            return b.createdAt.getTime() - a.createdAt.getTime();
        });

        return items;
    }, [rawNotifications, projects, taskLookup, currentUser]);

    // Unread count
    const unreadCount = useMemo(() => {
        return headsUpItems.filter(i => !i.read).length;
    }, [headsUpItems]);

    // Filter items based on active tab
    const filteredItems = useMemo(() => {
        switch (activeTab) {
            case 'assigned':
                return headsUpItems.filter(i => i.type === 'assigned');
            case 'comments':
                return headsUpItems.filter(i => i.type === 'comment' || i.type === 'mention');
            case 'blockers':
                return headsUpItems.filter(i => i.hasBlocker || i.type === 'blocker');
            case 'all':
            default:
                return headsUpItems;
        }
    }, [headsUpItems, activeTab]);

    // Group items by project for clear organization
    const groupedByProject = useMemo(() => {
        const map = new Map<string, { projectName: string; projectId: string; items: HeadsUpNotificationItem[] }>();

        filteredItems.forEach(item => {
            const key = item.projectId || '_general';
            if (!map.has(key)) {
                map.set(key, {
                    projectName: item.projectName || 'General',
                    projectId: item.projectId || '',
                    items: [],
                });
            }
            map.get(key)!.items.push(item);
        });

        return Array.from(map.values());
    }, [filteredItems]);

    const toggleProjectCollapse = (projectId: string) => {
        setCollapsedProjects(prev => {
            const next = new Set(prev);
            if (next.has(projectId)) next.delete(projectId);
            else next.add(projectId);
            return next;
        });
    };

    const markAsRead = async (notificationId?: string) => {
        if (!notificationId) return;
        try {
            await updateDoc(doc(db, 'notifications', notificationId), { read: true });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        const unreadNotifs = headsUpItems.filter(i => !i.read && i.notificationId);
        if (unreadNotifs.length === 0) return;

        try {
            await Promise.all(
                unreadNotifs.map(i => updateDoc(doc(db, 'notifications', i.notificationId!), { read: true }))
            );
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const handleItemClick = (item: HeadsUpNotificationItem) => {
        if (!item.read && item.notificationId) {
            markAsRead(item.notificationId);
        }

        if (item.projectId && item.taskId && onSelectTask) {
            onSelectTask(item.projectId, item.taskId);
            setIsOpen(false);
            return;
        }

        if (item.link) {
            try {
                const url = new URL(item.link);
                if (url.hostname.includes('vantageflow') || url.hostname.includes('localhost')) {
                    navigate(url.pathname + url.search);
                } else {
                    window.open(item.link, '_blank');
                }
            } catch {
                navigate(item.link);
            }
            setIsOpen(false);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell trigger button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2 text-slate-300 hover:text-white transition-all rounded-full hover:bg-slate-800 border ${
                    isOpen ? 'bg-slate-800 border-brand-secondary/60 text-white shadow-md shadow-brand-secondary/10' : 'border-slate-700/60'
                }`}
                title="Heads-Up & Notifications"
                aria-label="Heads-Up & Notifications"
            >
                <BellIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-slate-900 shadow-xs animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Heads-Up Style Dropdown Panel */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-[340px] sm:w-[420px] bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-brand-secondary/35 z-50 overflow-hidden flex flex-col max-h-[85vh] animate-fade-in text-slate-200">
                    {/* Header */}
                    <div className="p-3.5 border-b border-slate-800 bg-slate-800/80 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-secondary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-secondary"></span>
                            </span>
                            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                                <span>⚡ Heads-Up & Activity</span>
                            </h3>
                            {unreadCount > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                                    {unreadCount} unread
                                </span>
                            )}
                        </div>

                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-brand-light hover:text-white transition-colors flex items-center gap-1 font-medium"
                                title="Mark all items as read"
                            >
                                <CheckCircleIcon className="w-3.5 h-3.5" />
                                <span>Mark read</span>
                            </button>
                        )}
                    </div>

                    {/* Filter Quick Chips (Heads-Up Style) */}
                    <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/70 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        {[
                            { id: 'all', label: 'All Items' },
                            { id: 'assigned', label: '👤 Assigned' },
                            { id: 'comments', label: '💬 Comments & @' },
                            { id: 'blockers', label: '⚠️ Blockers' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as FilterTab)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                                    activeTab === tab.id
                                        ? 'bg-brand-secondary text-white border-brand-secondary shadow-sm shadow-brand-secondary/20'
                                        : 'bg-slate-800/80 text-slate-400 border-slate-700/70 hover:bg-slate-700/60 hover:text-slate-200'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Items List */}
                    <div className="flex-1 overflow-y-auto p-2.5 space-y-3 custom-scrollbar">
                        {filteredItems.length === 0 ? (
                            <div className="p-8 text-center space-y-2">
                                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                                    <SparklesIcon className="w-5 h-5 text-brand-light" />
                                </div>
                                <p className="text-xs font-semibold text-slate-300">
                                    {activeTab === 'all'
                                        ? "You're all caught up!"
                                        : `No ${activeTab} items for you right now.`}
                                </p>
                                <p className="text-[11px] text-slate-500 max-w-[240px] mx-auto">
                                    Tasks assigned to you and comments or @mentions directed to you will appear here.
                                </p>
                            </div>
                        ) : (
                            groupedByProject.map((group, groupIdx) => {
                                const isCollapsed = collapsedProjects.has(group.projectId);
                                return (
                                    <div key={group.projectId || groupIdx} className="space-y-1.5">
                                        {/* Project Folder Header */}
                                        <button
                                            type="button"
                                            onClick={() => toggleProjectCollapse(group.projectId)}
                                            className="w-full flex items-center justify-between px-2 py-1 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 text-left transition-colors border border-slate-700/40"
                                        >
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <svg className="w-3.5 h-3.5 text-brand-secondary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                                </svg>
                                                <span className="text-xs font-bold text-slate-200 truncate">
                                                    {group.projectName}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-700 text-slate-300 font-semibold">
                                                    {group.items.length}
                                                </span>
                                                <ChevronDownIcon className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                            </div>
                                        </button>

                                        {/* Task Cards */}
                                        {!isCollapsed && (
                                            <div className="space-y-1.5 pl-1">
                                                {group.items.map(item => {
                                                    return (
                                                        <div
                                                            key={item.id}
                                                            onClick={() => handleItemClick(item)}
                                                            className={`group relative p-2.5 rounded-xl border transition-all cursor-pointer text-left shadow-xs ${
                                                                !item.read
                                                                    ? 'bg-slate-800/90 hover:bg-slate-700/80 border-brand-secondary/45 shadow-sm shadow-brand-secondary/5'
                                                                    : 'bg-slate-900/80 hover:bg-slate-800/70 border-slate-700/50 hover:border-slate-600'
                                                            }`}
                                                        >
                                                            {/* Unread Accent Pill */}
                                                            {!item.read && (
                                                                <span className="absolute left-1 top-3 bottom-3 w-1 bg-brand-secondary rounded-full" />
                                                            )}

                                                            <div className="pl-1 space-y-1">
                                                                {/* Top Row: Phase + Badges + Relative Time */}
                                                                <div className="flex items-center justify-between gap-1 text-[10px]">
                                                                    <div className="flex items-center gap-1.5 truncate">
                                                                        {item.phaseName && (
                                                                            <span className="text-slate-400 truncate max-w-[120px]">
                                                                                {item.phaseName}
                                                                            </span>
                                                                        )}
                                                                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border uppercase tracking-wider flex-shrink-0 ${item.badgeStyle}`}>
                                                                            {item.badgeLabel}
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-slate-400 font-mono text-[10px] flex-shrink-0">
                                                                        {formatRelativeTime(item.createdAt)}
                                                                    </span>
                                                                </div>

                                                                {/* Middle Row: Task Name */}
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <p className="text-xs font-bold text-white group-hover:text-brand-light transition-colors line-clamp-2 leading-snug">
                                                                        {item.taskName}
                                                                    </p>
                                                                    {item.hasBlocker && (
                                                                        <span className="flex-shrink-0 text-red-400" title="Active Blocker">
                                                                            <FlagIcon className="w-3.5 h-3.5 fill-red-400" />
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Context Message (Note, Mention, or Blocker) */}
                                                                {item.contextText && (
                                                                    <p className="text-[11px] text-slate-300 bg-slate-950/40 p-1.5 rounded-lg border border-slate-800/80 line-clamp-2 leading-relaxed">
                                                                        {item.authorName && (
                                                                            <span className="font-semibold text-brand-light mr-1">
                                                                                {item.authorName}:
                                                                            </span>
                                                                        )}
                                                                        {item.contextText}
                                                                    </p>
                                                                )}

                                                                {/* Action Footer */}
                                                                <div className="flex items-center justify-between pt-1">
                                                                    <span className="text-[10px] font-medium text-brand-secondary group-hover:text-blue-400 transition-colors flex items-center gap-1">
                                                                        <span>🎯 Jump to Task</span>
                                                                        <span>➔</span>
                                                                    </span>
                                                                    {!item.read && item.notificationId && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                markAsRead(item.notificationId);
                                                                            }}
                                                                            className="text-[10px] text-slate-500 hover:text-slate-300"
                                                                        >
                                                                            Mark read
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;
