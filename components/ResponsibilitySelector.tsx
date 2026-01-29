import React, { useState, useMemo } from 'react';
import { TeamMember } from '../types';
import { UserIcon, MagnifyingGlassIcon } from './icons';
import ConfirmationModal from './ConfirmationModal';
import UserAchievementBadge from './UserAchievementBadge';
import { useUserLookup } from '../hooks/useUserLookup';

interface ResponsibilitySelectorProps {
    teamMembers: TeamMember[];
    assignedMembers: TeamMember[];
    onSave: (members: TeamMember[], notify: boolean, propagate: boolean) => void;
    onCancel: () => void;
    title?: string;
    showPropagateOption?: boolean;
    hasExistingChildren?: boolean;
}

const ResponsibilitySelector: React.FC<ResponsibilitySelectorProps> = ({
    teamMembers,
    assignedMembers,
    onSave,
    onCancel,
    title = 'Assign Responsibility',
    showPropagateOption = false,
    hasExistingChildren = false
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(
        new Set(assignedMembers.map(m => m.uid))
    );
    const [searchQuery, setSearchQuery] = useState('');
    const [notify, setNotify] = useState(true);
    const [propagate, setPropagate] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    // Use the user lookup hook for dynamic data
    const { getUserById, hasUserLoggedIn, loading: usersLoading } = useUserLookup();

    // Filter members: exclude those who haven't logged in (pending invitation)
    const activatedMembers = useMemo(() => {
        return teamMembers.filter(member => hasUserLoggedIn(member.uid, member.email));
    }, [teamMembers, hasUserLoggedIn]);

    // Filter members by search
    const filteredMembers = useMemo(() => {
        if (!searchQuery.trim()) return activatedMembers;
        const query = searchQuery.toLowerCase();
        return activatedMembers.filter(member =>
        (member.displayName?.toLowerCase().includes(query) ||
            member.email.toLowerCase().includes(query))
        );
    }, [activatedMembers, searchQuery]);

    const toggleMember = (uid: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(uid)) {
            newSelected.delete(uid);
        } else {
            newSelected.add(uid);
        }
        setSelectedIds(newSelected);
    };

    const handleSaveClick = () => {
        // If notify is checked, we might want to confirm? 
        // The user requirement was "Ask for send confirmation".
        // If we have a checkbox, that IS the user choice. 
        // But maybe they want a pop-up to be absolutely sure?
        // "Ask for send confirmation" implies a modal.
        if (notify && selectedIds.size > 0) {
            setShowConfirmation(true);
        } else {
            finalizeSave();
        }
    };

    const finalizeSave = () => {
        // Enrich members with fresh user data (including photoURL) before saving
        const finalMembers = teamMembers
            .filter(m => selectedIds.has(m.uid))
            .map(member => {
                const cachedUser = getUserById(member.uid, member.email);
                return {
                    ...member,
                    displayName: cachedUser?.displayName || member.displayName,
                    photoURL: cachedUser?.photoURL || member.photoURL,
                };
            });
        onSave(finalMembers, notify, propagate);
    };

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <button onClick={onCancel} className="text-slate-400 hover:text-white">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-slate-700 bg-slate-800/50">
                <div className="relative">
                    <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search members..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-brand-secondary focus:border-transparent outline-none"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2">
                {filteredMembers.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        No members found
                    </div>
                ) : (
                    <div className="space-y-1">
                        {filteredMembers.map(member => {
                            const isSelected = selectedIds.has(member.uid);
                            // Get fresh user data from cache
                            const cachedUser = getUserById(member.uid, member.email);
                            const displayName = cachedUser?.displayName || member.displayName;
                            const photoURL = cachedUser?.photoURL || member.photoURL;

                            // Derive a nice name
                            let name = displayName;
                            if (!name || name.includes('@')) {
                                name = member.email.split('@')[0];
                                name = name.charAt(0).toUpperCase() + name.slice(1);
                            }

                            return (
                                <div
                                    key={member.uid}
                                    onClick={() => toggleMember(member.uid)}
                                    className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-brand-secondary/10 border border-brand-secondary/30' : 'hover:bg-slate-700 border border-transparent'
                                        }`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${isSelected ? 'bg-brand-secondary/20 text-brand-secondary' : 'bg-slate-700 text-slate-400'
                                        }`}>
                                        {photoURL ? (
                                            <img src={photoURL} alt="" className="w-8 h-8 rounded-full" />
                                        ) : (
                                            <UserIcon className="w-4 h-4" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className={`text-sm font-medium ${isSelected ? 'text-brand-light' : 'text-slate-300'}`}>
                                                {name}
                                            </p>
                                            <UserAchievementBadge userId={member.uid} />
                                        </div>
                                        <p className="text-xs text-slate-500 truncate">{member.email}</p>
                                    </div>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ml-2 ${isSelected ? 'bg-brand-secondary border-brand-secondary' : 'border-slate-600'
                                        }`}>
                                        {isSelected && (
                                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-700 bg-slate-800/50">
                <div className="space-y-3 mb-4">
                    <label className="flex items-center cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={notify}
                            onChange={(e) => setNotify(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-brand-secondary focus:ring-brand-secondary mr-2"
                        />
                        <span className="text-sm text-slate-300">Notify new assignees via email</span>
                    </label>
                    {showPropagateOption && (
                        <label className="flex items-center cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={propagate}
                                onChange={(e) => setPropagate(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-brand-secondary focus:ring-brand-secondary mr-2"
                            />
                            <span className="text-sm text-slate-300">
                                Apply to all sub-items
                                {hasExistingChildren && <span className="text-slate-500 ml-1">(existing assignments retained)</span>}
                            </span>
                        </label>
                    )}
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSaveClick}
                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-lg hover:bg-brand-primary/90 transition-colors"
                    >
                        Save Assignment
                    </button>
                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={showConfirmation}
                onClose={() => setShowConfirmation(false)}
                onConfirm={finalizeSave}
                title="Confirm Notification"
                message={
                    <p>
                        You are about to send email notifications to
                        <span className="font-bold text-white mx-1">{selectedIds.size}</span>
                        assignee{selectedIds.size !== 1 ? 's' : ''}.
                        Continue?
                    </p>
                }
            />
        </div>
    );
};

export default ResponsibilitySelector;
