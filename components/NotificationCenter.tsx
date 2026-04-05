import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getFirestore, collection, query, where, orderBy, onSnapshot, updateDoc, doc, limit } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { Notification } from '../types';
import { EnvelopeIcon, CheckCircleIcon, BellIcon } from './icons';

/** Group notifications by projectName, preserving order of first appearance */
interface ProjectGroup {
    projectName: string;
    projectId: string;
    notifications: Notification[];
    unreadCount: number;
}

const NotificationCenter: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const dropdownRef = useRef<HTMLDivElement>(null);
    const auth = getAuth();
    const db = getFirestore();
    const navigate = useNavigate();

    // Group notifications by project
    const groupedNotifications = useMemo<ProjectGroup[]>(() => {
        const groupMap = new Map<string, ProjectGroup>();

        for (const n of notifications) {
            const key = n.projectId || '_general';
            if (!groupMap.has(key)) {
                groupMap.set(key, {
                    projectName: n.projectName || 'General',
                    projectId: n.projectId || '',
                    notifications: [],
                    unreadCount: 0,
                });
            }
            const group = groupMap.get(key)!;
            group.notifications.push(n);
            if (!n.read) group.unreadCount++;
        }

        // Sort groups: groups with unread first, then by latest notification date
        return Array.from(groupMap.values()).sort((a, b) => {
            if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
            if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
            return 0; // Preserve original order (already sorted by createdAt desc from query)
        });
    }, [notifications]);

    const toggleGroupCollapse = (projectId: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(projectId)) {
                next.delete(projectId);
            } else {
                next.add(projectId);
            }
            return next;
        });
    };

    // Helper to handle notification link clicks - convert external VantageFlow links to internal navigation
    const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, link: string) => {
        e.preventDefault();
        setIsOpen(false); // Close dropdown

        // Extract path from VantageFlow URLs and use router navigation
        try {
            const url = new URL(link);
            if (url.hostname.includes('vantageflow')) {
                // Internal link - use router navigation
                navigate(url.pathname, { replace: false });
            } else {
                // External link - open in new tab
                window.open(link, '_blank');
            }
        } catch {
            // If not a valid URL, try to navigate directly
            navigate(link, { replace: false });
        }
    };

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        // Listen for notifications
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(20)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs: Notification[] = [];
            let unread = 0;
            snapshot.forEach((doc) => {
                const data = doc.data() as Omit<Notification, 'id'>;
                msgs.push({ ...data, id: doc.id });
                if (!data.read) unread++;
            });
            setNotifications(msgs);
            setUnreadCount(unread);
        });

        return () => unsubscribe();
    }, [auth.currentUser]);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const markAsRead = async (notificationId: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));

        try {
            await updateDoc(doc(db, 'notifications', notificationId), { read: true });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
        if (unreadIds.length === 0) return;

        // Optimistic
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);

        try {
            await Promise.all(unreadIds.map(id => updateDoc(doc(db, 'notifications', id), { read: true })));
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const formatDate = (date: any) => {
        if (!date) return '';
        // Handle Firestore Timestamp
        const d = date.toDate ? date.toDate() : new Date(date);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-700/50 outline-none focus:ring-2 focus:ring-brand-primary"
            >
                <BellIcon className="w-6 h-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-slate-800">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 z-50 overflow-hidden">
                    <div className="p-3 border-b border-slate-700 flex justify-between items-center bg-slate-800">
                        <h3 className="text-sm font-semibold text-white">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-brand-light hover:text-blue-300 transition-colors"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-sm">
                                No notifications yet
                            </div>
                        ) : (
                            <div>
                                {groupedNotifications.map((group, groupIndex) => {
                                    const isCollapsed = collapsedGroups.has(group.projectId || '_general');
                                    return (
                                        <div key={group.projectId || '_general'}>
                                            {/* Project group header */}
                                            <button
                                                onClick={() => toggleGroupCollapse(group.projectId || '_general')}
                                                className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-slate-700/20 ${groupIndex > 0 ? 'border-t border-slate-600/50' : ''}`}
                                                style={{ background: 'rgba(30, 41, 59, 0.6)' }}
                                            >
                                                {/* Folder icon */}
                                                <svg className="w-3.5 h-3.5 text-brand-secondary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                                </svg>
                                                <span className="text-sm font-bold text-white truncate flex-1">
                                                    {group.projectName}
                                                </span>
                                                {group.unreadCount > 0 && (
                                                    <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 bg-brand-secondary/20 text-brand-secondary text-[10px] font-bold rounded-full flex items-center justify-center">
                                                        {group.unreadCount}
                                                    </span>
                                                )}
                                                {/* Chevron */}
                                                <svg
                                                    className={`w-3 h-3 text-slate-500 transition-transform duration-200 flex-shrink-0 ${isCollapsed ? '-rotate-90' : ''}`}
                                                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>

                                            {/* Notification items within project group */}
                                            {!isCollapsed && (
                                                <ul className="divide-y divide-slate-700/30">
                                                    {group.notifications.map(notification => (
                                                        <li
                                                            key={notification.id}
                                                            className={`px-4 py-3 hover:bg-slate-700/30 transition-colors cursor-pointer ${!notification.read ? 'bg-slate-700/10' : ''}`}
                                                            onClick={() => !notification.read && markAsRead(notification.id)}
                                                        >
                                                            <div className="flex gap-3">
                                                                <div className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${!notification.read ? 'bg-brand-secondary' : 'bg-transparent'}`} />
                                                                <div className="flex-1 space-y-1">
                                                                    <p className="text-sm text-slate-300 leading-snug">
                                                                        {notification.message}
                                                                    </p>
                                                                    <div className="flex justify-between items-center pt-0.5">
                                                                        <span className="text-xs text-slate-500">{formatDate(notification.createdAt)}</span>
                                                                        {notification.link && (
                                                                            <a
                                                                                href={notification.link}
                                                                                onClick={(e) => handleLinkClick(e, notification.link!)}
                                                                                className="text-xs text-brand-secondary hover:text-blue-400 font-medium flex items-center"
                                                                            >
                                                                                View
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;

