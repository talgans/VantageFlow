import React, { useState, useEffect, useMemo } from 'react';
import { TeamMember } from '../types';
import { XMarkIcon, UserIcon, MagnifyingGlassIcon, StarIcon } from './icons';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface User {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
    role: string;
}

interface TeamMemberSelectorProps {
    selectedMembers: TeamMember[];
    onChange: (members: TeamMember[]) => void;
    projectOwnerId?: string; // The project owner is auto-set as primary lead
    disabled?: boolean;
}

const TeamMemberSelector: React.FC<TeamMemberSelectorProps> = ({
    selectedMembers,
    onChange,
    projectOwnerId,
    disabled = false,
}) => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);

        try {
            const functions = getFunctions();
            const listUsersFunction = httpsCallable(functions, 'listUsers');
            const result = await listUsersFunction();
            const data = result.data as { users: User[] };
            setUsers(data.users);
        } catch (err: any) {
            console.error('Error fetching users:', err);
            setError('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = useMemo(() => {
        if (!searchQuery.trim()) return users;
        const query = searchQuery.toLowerCase();
        return users.filter(
            (user) =>
                user.email.toLowerCase().includes(query) ||
                (user.displayName && user.displayName.toLowerCase().includes(query))
        );
    }, [users, searchQuery]);

    const isSelected = (uid: string) => selectedMembers.some((m) => m.uid === uid);
    const getSelectedMember = (uid: string) => selectedMembers.find((m) => m.uid === uid);
    const isPrimaryLead = (uid: string) => uid === projectOwnerId;

    const handleToggleMember = (user: User) => {
        if (disabled) return;
        // Cannot remove the project owner
        if (isSelected(user.uid) && isPrimaryLead(user.uid)) return;

        if (isSelected(user.uid)) {
            onChange(selectedMembers.filter((m) => m.uid !== user.uid));
        } else {
            onChange([
                ...selectedMembers,
                {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    leadRole: undefined, // Regular member by default
                },
            ]);
        }
    };

    const handleCycleLeadRole = (uid: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (disabled) return;
        // Cannot change role of primary lead (project owner)
        if (isPrimaryLead(uid)) return;

        const member = getSelectedMember(uid);
        if (!member) return;

        // Cycle: undefined -> secondary -> undefined
        const newRole = member.leadRole === 'secondary' ? undefined : 'secondary';

        onChange(
            selectedMembers.map((m) =>
                m.uid === uid ? { ...m, leadRole: newRole } : m
            )
        );
    };

    const handleRemoveMember = (uid: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (disabled) return;
        // Cannot remove the project owner
        if (isPrimaryLead(uid)) return;
        onChange(selectedMembers.filter((m) => m.uid !== uid));
    };

    const primaryLeads = selectedMembers.filter((m) => m.leadRole === 'primary');
    const secondaryLeads = selectedMembers.filter((m) => m.leadRole === 'secondary');
    const totalLeads = primaryLeads.length + secondaryLeads.length;

    const getLeadBadgeStyle = (member: TeamMember) => {
        if (member.leadRole === 'primary') {
            return 'bg-blue-500/20 border-blue-500/40 text-blue-300';
        }
        if (member.leadRole === 'secondary') {
            return 'bg-amber-500/20 border-amber-500/40 text-amber-300';
        }
        return 'bg-slate-700 border-slate-600 text-slate-300';
    };

    const getLeadLabel = (member: TeamMember) => {
        if (member.leadRole === 'primary') return 'Primary Lead';
        if (member.leadRole === 'secondary') return 'Secondary Lead';
        return null;
    };

    return (
        <div className="space-y-3">
            {/* Selected Members Display */}
            {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {selectedMembers.map((member) => (
                        <div
                            key={member.uid}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border ${getLeadBadgeStyle(member)}`}
                        >
                            {member.leadRole && <StarIcon className="w-3.5 h-3.5" />}
                            <span className="truncate max-w-[120px]">
                                {member.displayName || member.email}
                            </span>
                            {member.leadRole && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${member.leadRole === 'primary' ? 'bg-blue-500/30' : 'bg-amber-500/30'
                                    }`}>
                                    {member.leadRole === 'primary' ? 'Primary' : 'Secondary'}
                                </span>
                            )}
                            {!disabled && !isPrimaryLead(member.uid) && (
                                <button
                                    type="button"
                                    onClick={(e) => handleRemoveMember(member.uid, e)}
                                    className="text-slate-400 hover:text-red-400 transition-colors"
                                >
                                    <XMarkIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Summary */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                    {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
                    {totalLeads > 0 && (
                        <span className="ml-2">
                            {primaryLeads.length > 0 && <span className="text-blue-400">• {primaryLeads.length} primary</span>}
                            {secondaryLeads.length > 0 && <span className="text-amber-400 ml-1">• {secondaryLeads.length} secondary</span>}
                        </span>
                    )}
                </p>
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    disabled={disabled}
                    className="text-sm text-brand-light hover:text-white transition-colors disabled:opacity-50"
                >
                    {isExpanded ? 'Hide' : 'Select Members'}
                </button>
            </div>

            {/* User Selection Panel */}
            {isExpanded && (
                <div className="bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden">
                    {/* Search */}
                    <div className="p-3 border-b border-slate-700">
                        <div className="relative">
                            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search users by name or email..."
                                className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-brand-secondary focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* User List */}
                    <div className="max-h-64 overflow-y-auto">
                        {loading ? (
                            <div className="p-6 text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-secondary mx-auto"></div>
                                <p className="text-slate-400 mt-2 text-sm">Loading users...</p>
                            </div>
                        ) : error ? (
                            <div className="p-4 text-center text-red-400 text-sm">{error}</div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="p-4 text-center text-slate-400 text-sm">
                                {searchQuery ? 'No users match your search' : 'No users available'}
                            </div>
                        ) : (
                            filteredUsers.map((user) => {
                                const selected = isSelected(user.uid);
                                const member = getSelectedMember(user.uid);
                                const isOwner = isPrimaryLead(user.uid);
                                return (
                                    <div
                                        key={user.uid}
                                        onClick={() => handleToggleMember(user)}
                                        className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${selected
                                            ? 'bg-brand-secondary/10 border-l-2 border-brand-secondary'
                                            : 'hover:bg-slate-800 border-l-2 border-transparent'
                                            } ${isOwner && selected ? 'opacity-80' : ''}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`w-8 h-8 rounded-full flex items-center justify-center ${isOwner ? 'bg-blue-500/30' : selected ? 'bg-brand-secondary/30' : 'bg-slate-700'
                                                    }`}
                                            >
                                                <UserIcon className="w-4 h-4 text-slate-300" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-white flex items-center gap-2">
                                                    {user.displayName || user.email}
                                                    {isOwner && (
                                                        <span className="text-xs bg-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded">
                                                            Project Owner
                                                        </span>
                                                    )}
                                                </p>
                                                {user.displayName && (
                                                    <p className="text-xs text-slate-400">{user.email}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {selected && !isOwner && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleCycleLeadRole(user.uid, e)}
                                                    className={`p-1.5 rounded transition-colors ${member?.leadRole === 'secondary'
                                                        ? 'bg-amber-500/20 text-amber-400'
                                                        : 'text-slate-500 hover:text-amber-400 hover:bg-slate-700'
                                                        }`}
                                                    title={member?.leadRole === 'secondary' ? 'Remove as Secondary Lead' : 'Set as Secondary Lead'}
                                                >
                                                    <StarIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            {isOwner && selected && (
                                                <span className="text-xs text-blue-400 bg-blue-500/20 px-2 py-1 rounded">
                                                    Primary Lead
                                                </span>
                                            )}
                                            {!isOwner && (
                                                <input
                                                    type="checkbox"
                                                    checked={selected}
                                                    onChange={() => { }}
                                                    className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-brand-secondary focus:ring-brand-secondary"
                                                />
                                            )}
                                        </div>
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

export default TeamMemberSelector;
