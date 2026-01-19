import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, collection, query, where, orderBy, onSnapshot, updateDoc, doc, limit } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { Notification } from '../types';
import { EnvelopeIcon, CheckCircleIcon, BellIcon } from './icons';

const NotificationCenter: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const auth = getAuth();
    const db = getFirestore();
    const navigate = useNavigate();

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

        // Batch update? Or parallel promises
        // Firestore batch is better
        try {
            // Simple implementation: parallel updates
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
                            <ul className="divide-y divide-slate-700/50">
                                {notifications.map(notification => (
                                    <li
                                        key={notification.id}
                                        className={`p-4 hover:bg-slate-700/30 transition-colors ${!notification.read ? 'bg-slate-700/10' : ''}`}
                                        onClick={() => !notification.read && markAsRead(notification.id)}
                                    >
                                        <div className="flex gap-3">
                                            <div className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${!notification.read ? 'bg-brand-secondary' : 'bg-transparent'}`} />
                                            <div className="flex-1 space-y-1">
                                                <p className="text-sm text-slate-300 leading-snug">
                                                    {notification.message}
                                                </p>
                                                <div className="flex justify-between items-center pt-1">
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
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;
