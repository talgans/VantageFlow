import React, { useState, useEffect, useMemo } from 'react';
import { TeamMember, Phase } from '../types';
import { XMarkIcon, UserIcon, MagnifyingGlassIcon, StarIcon, EnvelopeIcon, PlusCircleIcon } from './icons';
import { getFunctions, httpsCallable } from 'firebase/functions';
import UserAchievementBadge from './UserAchievementBadge';
import { inviteUserByEmail, sendUserReminderEmail, ProjectInviteContext } from '../services/userService';

interface User {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
    role: string;
    createdAt?: string;
    lastSignIn?: string;
}

interface TeamMemberSelectorProps {
    selectedMembers: TeamMember[];
    onChange: (members: TeamMember[]) => void;
    projectOwnerId?: string; // The project owner is auto-set as primary lead
    disabled?: boolean;
    phases?: Phase[];
    formerMembers?: TeamMember[];
    onMemberRemovedWithChoice?: (member: TeamMember, choice: 'former' | 'clear') => void;
    onRestoreFormerMember?: (member: TeamMember) => void;
    canInviteUsers?: boolean;
    canTransferOwnership?: boolean;
    onTransferOwnership?: (newOwner: TeamMember) => void;
    projectContext?: ProjectInviteContext;
    onRequireProjectContext?: () => void;
    onUserInvited?: (member: TeamMember) => void;
    showToast?: (message: string) => void;
    defaultExpanded?: boolean;
}

const TeamMemberSelector: React.FC<TeamMemberSelectorProps> = ({
    selectedMembers,
    onChange,
    projectOwnerId,
    disabled = false,
    phases,
    formerMembers = [],
    onMemberRemovedWithChoice,
    onRestoreFormerMember,
    canInviteUsers = false,
    canTransferOwnership = false,
    onTransferOwnership,
    projectContext,
    onRequireProjectContext,
    onUserInvited,
    showToast,
    defaultExpanded = true,
}) => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [isFormerExpanded, setIsFormerExpanded] = useState(false);
    const [pendingRemoval, setPendingRemoval] = useState<{
        member: TeamMember;
        taskCount: number;
    } | null>(null);
    const [removalChoice, setRemovalChoice] = useState<'former' | 'clear'>('former');

    // Invite state (reusing shared inviteUserByEmail from userService)
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviting, setInviting] = useState(false);
    const [remindingEmail, setRemindingEmail] = useState<string | null>(null);

    // Ownership transfer state (1st Lead -> 2nd Lead)
    const [selectedTransferTargetUid, setSelectedTransferTargetUid] = useState<string>('');
    const [pendingOwnershipTransfer, setPendingOwnershipTransfer] = useState<TeamMember | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);

        try {
            const functions = getFunctions();
            let data: { users: User[] };
            try {
                const getDirectoryFunction = httpsCallable(functions, 'getPublicDirectory');
                const result = await getDirectoryFunction();
                data = result.data as { users: User[] };
            } catch {
                const listUsersFunction = httpsCallable(functions, 'listUsers');
                const result = await listUsersFunction();
                data = result.data as { users: User[] };
            }
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

    const getAssignedTaskCount = (uid: string) => {
        if (!phases) return 0;
        let count = 0;
        phases.forEach((phase) => {
            (phase.tasks || []).forEach((task) => {
                if (task.assignees?.some((a) => a.uid === uid) || task.ownerId === uid) {
                    count++;
                }
                (task.subTasks || []).forEach((sub) => {
                    if (sub.assignees?.some((a) => a.uid === uid) || sub.ownerId === uid) {
                        count++;
                    }
                });
            });
        });
        return count;
    };

    const initiateRemoveMember = (uid: string) => {
        if (disabled) return;
        if (isPrimaryLead(uid)) return;

        const member = getSelectedMember(uid);
        if (!member) return;

        const taskCount = getAssignedTaskCount(uid);
        if (taskCount > 0) {
            setPendingRemoval({ member, taskCount });
            setRemovalChoice('former');
        } else {
            // No tasks assigned, remove directly
            onChange(selectedMembers.filter((m) => m.uid !== uid));
            onMemberRemovedWithChoice?.(member, 'clear');
        }
    };

    const confirmRemoval = () => {
        if (!pendingRemoval) return;
        const { member } = pendingRemoval;
        onMemberRemovedWithChoice?.(member, removalChoice);
        onChange(selectedMembers.filter((m) => m.uid !== member.uid));
        setPendingRemoval(null);
    };

    const handleToggleMember = (user: User) => {
        if (disabled) return;
        // Cannot remove the project owner
        if (isSelected(user.uid) && isPrimaryLead(user.uid)) return;

        if (isSelected(user.uid)) {
            initiateRemoveMember(user.uid);
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
        initiateRemoveMember(uid);
    };

    const primaryLeads = selectedMembers.filter((m) => m.leadRole === 'primary');
    const secondaryLeads = selectedMembers.filter((m) => m.leadRole === 'secondary');
    const totalLeads = primaryLeads.length + secondaryLeads.length;

    // Keep selectedTransferTargetUid defaulted to the 2nd Lead (or first available 2nd Lead)
    useEffect(() => {
        if (secondaryLeads.length > 0) {
            if (!selectedTransferTargetUid || !secondaryLeads.some((m) => m.uid === selectedTransferTargetUid)) {
                setSelectedTransferTargetUid(secondaryLeads[0].uid);
            }
        } else {
            setSelectedTransferTargetUid('');
        }
    }, [secondaryLeads, selectedTransferTargetUid]);

    const notify = (msg: string) => {
        if (showToast) {
            showToast(msg);
        } else {
            alert(msg);
        }
    };

    const isUserPendingSetup = (uid?: string, email?: string): boolean => {
        if (loading || users.length === 0) return false;
        const found = users.find(
            (u) => (uid && u.uid === uid) || (email && u.email.toLowerCase() === email.toLowerCase())
        );
        if (!found) return false;
        return !found.lastSignIn;
    };

    const handleSendReminder = async (email: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!email || remindingEmail) return;
        if (!confirm(`Send an account setup reminder email to ${email}?`)) return;

        setRemindingEmail(email);
        try {
            await sendUserReminderEmail(email, projectContext);
            notify(`Reminder email sent to ${email}!`);
        } catch (err: any) {
            console.error('Error sending reminder:', err);
            notify(`Failed to send reminder: ${err.message}`);
        } finally {
            setRemindingEmail(null);
        }
    };

    const executeInviteEmail = async (rawEmail: string) => {
        const targetEmail = rawEmail.trim().toLowerCase();
        if (!targetEmail || !targetEmail.includes('@')) {
            notify('Please enter a valid email address');
            return;
        }

        // Require project name & description so the invitation email includes project context
        if (!projectContext?.projectName?.trim() || !projectContext?.projectDescription?.trim()) {
            notify('Please enter a Project Name and Description in the Overview tab before inviting users.');
            onRequireProjectContext?.();
            return;
        }

        // Check if this email already belongs to an existing user in the directory
        const existingUser = users.find((u) => u.email.toLowerCase() === targetEmail);
        if (existingUser) {
            if (isSelected(existingUser.uid)) {
                notify(`${existingUser.email} is already on this project team.`);
            } else {
                const newMember: TeamMember = {
                    uid: existingUser.uid,
                    email: existingUser.email,
                    displayName: existingUser.displayName,
                    photoURL: existingUser.photoURL,
                    leadRole: undefined,
                };
                onChange([...selectedMembers, newMember]);
                notify(`${existingUser.email} is already registered on VantageFlow and has been added to the team!`);
            }
            setInviteEmail('');
            setSearchQuery('');
            return;
        }

        setInviting(true);
        try {
            const result = await inviteUserByEmail(targetEmail, 'member', projectContext);
            const createdUser: User = result.user || {
                uid: `invited-${Date.now()}`,
                email: targetEmail,
                role: 'member',
                createdAt: new Date().toISOString(),
                lastSignIn: undefined,
            };

            setUsers((prev) => {
                if (prev.some((u) => u.email.toLowerCase() === targetEmail)) return prev;
                return [createdUser, ...prev];
            });

            const newMember: TeamMember = {
                uid: createdUser.uid,
                email: createdUser.email,
                displayName: createdUser.displayName,
                leadRole: undefined, // Regular Team Member by default
            };

            if (!selectedMembers.some((m) => m.email.toLowerCase() === targetEmail)) {
                onChange([...selectedMembers, newMember]);
            }
            onUserInvited?.(newMember);

            notify(`Invitation sent to ${targetEmail} with project details and added to the team!`);
            setInviteEmail('');
            setSearchQuery('');
        } catch (err: any) {
            console.error('Error inviting user from project modal:', err);
            notify(`Failed to invite user: ${err.message}`);
        } finally {
            setInviting(false);
        }
    };

    const handleConfirmOwnershipTransfer = () => {
        if (!pendingOwnershipTransfer) return;
        if (pendingOwnershipTransfer.leadRole !== 'secondary') {
            notify('Ownership can only be transferred to a 2nd Lead.');
            setPendingOwnershipTransfer(null);
            return;
        }

        const updatedMembers = selectedMembers.map((m) => {
            if (m.uid === pendingOwnershipTransfer.uid) {
                return { ...m, leadRole: 'primary' as const };
            }
            if (m.leadRole === 'primary' || isPrimaryLead(m.uid)) {
                return { ...m, leadRole: 'secondary' as const };
            }
            return m;
        });

        onChange(updatedMembers);
        onTransferOwnership?.({ ...pendingOwnershipTransfer, leadRole: 'primary' });
        notify(`Project ownership (1st Lead) transferred to ${pendingOwnershipTransfer.displayName || pendingOwnershipTransfer.email}.`);
        setPendingOwnershipTransfer(null);
    };

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
        if (member.leadRole === 'primary') return '1st Lead';
        if (member.leadRole === 'secondary') return '2nd Lead';
        return null;
    };

    // Sort members: 1st Lead first, then 2nd Lead, then regular members
    const sortedSelectedMembers = [...selectedMembers].sort((a, b) => {
        const order = { primary: 0, secondary: 1, undefined: 2 };
        return (order[a.leadRole as keyof typeof order] ?? 2) - (order[b.leadRole as keyof typeof order] ?? 2);
    });

    return (
        <div className="space-y-4">
            {/* Selected Members Display */}
            {sortedSelectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {sortedSelectedMembers.map((member) => {
                        const pendingSetup = isUserPendingSetup(member.uid, member.email);
                        return (
                            <div
                                key={member.uid}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border ${getLeadBadgeStyle(member)}`}
                            >
                                {member.leadRole && <StarIcon className="w-3.5 h-3.5" />}
                                <span className="truncate max-w-[140px]">
                                    {member.displayName || member.email}
                                </span>
                                {member.leadRole && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${member.leadRole === 'primary' ? 'bg-blue-500/30' : 'bg-amber-500/30'
                                        }`}>
                                        {member.leadRole === 'primary' ? '1st Lead' : '2nd Lead'}
                                    </span>
                                )}
                                {pendingSetup && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/30" title="User has not completed account setup yet">
                                        Pending
                                    </span>
                                )}
                                {canInviteUsers && pendingSetup && !disabled && (
                                    <button
                                        type="button"
                                        onClick={(e) => handleSendReminder(member.email, e)}
                                        disabled={remindingEmail === member.email}
                                        className="text-yellow-400 hover:text-yellow-200 transition-colors disabled:opacity-50"
                                        title={`Send setup reminder email to ${member.email}`}
                                    >
                                        <EnvelopeIcon className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {canTransferOwnership && !disabled && member.leadRole === 'secondary' && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPendingOwnershipTransfer(member);
                                        }}
                                        className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/25 hover:bg-blue-500/40 text-blue-200 border border-blue-400/30 transition-colors"
                                        title="Transfer 1st Lead (Project Ownership) to this 2nd Lead"
                                    >
                                        Make 1st Lead
                                    </button>
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
                        );
                    })}
                </div>
            )}

            {/* Project Lead / Ownership Transfer Section (Visible to 1st Lead / Admin) */}
            {canTransferOwnership && !disabled && (
                <div className="bg-slate-900/60 border border-slate-700/80 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                <StarIcon className="w-3.5 h-3.5 text-blue-400" />
                                Project Lead / Ownership Transfer
                            </h4>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {secondaryLeads.length > 0
                                    ? 'Transfer 1st Lead ownership to your 2nd Lead. You will remain on the project as a 2nd Lead.'
                                    : 'To transfer project ownership to another member, first set them as a 2nd Lead (click ⭐ next to their name below).'}
                            </p>
                        </div>
                        {secondaryLeads.length > 0 && (
                            <div className="flex items-center gap-2">
                                {secondaryLeads.length > 1 ? (
                                    <select
                                        value={selectedTransferTargetUid}
                                        onChange={(e) => setSelectedTransferTargetUid(e.target.value)}
                                        className="bg-slate-800 border border-slate-600 text-white text-xs rounded-lg px-2.5 py-1.5 focus:ring-brand-secondary focus:border-brand-secondary"
                                    >
                                        {secondaryLeads.map((sl) => (
                                            <option key={sl.uid} value={sl.uid}>
                                                {sl.displayName || sl.email} (2nd Lead)
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <span className="text-xs px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium">
                                        2nd Lead: {secondaryLeads[0].displayName || secondaryLeads[0].email}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const target = secondaryLeads.find((m) => m.uid === selectedTransferTargetUid) || secondaryLeads[0];
                                        if (target) setPendingOwnershipTransfer(target);
                                    }}
                                    className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shrink-0"
                                >
                                    Transfer 1st Lead
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Invite New Member by Email (Visible to Project Leads: 1st Lead, 2nd Lead, Admin/SuperAdmin) */}
            {canInviteUsers && !disabled && (
                <div className="bg-slate-900/60 border border-slate-700/80 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                            <EnvelopeIcon className="w-3.5 h-3.5 text-brand-secondary" />
                            Invite User by Email
                        </label>
                        <span className="text-[11px] text-slate-400">
                            Includes project description & timeline in email
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    executeInviteEmail(inviteEmail);
                                }
                            }}
                            placeholder="colleague@example.com"
                            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-brand-secondary focus:border-transparent"
                        />
                        <button
                            type="button"
                            disabled={inviting || !inviteEmail.trim()}
                            onClick={() => executeInviteEmail(inviteEmail)}
                            className="px-4 py-2 bg-brand-secondary hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
                        >
                            {inviting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Inviting...</span>
                                </>
                            ) : (
                                <>
                                    <PlusCircleIcon className="w-4 h-4" />
                                    <span>Send Invite</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Summary */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                    {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
                    {totalLeads > 0 && (
                        <span className="ml-2">
                            {primaryLeads.length > 0 && <span className="text-blue-400">• {primaryLeads.length} 1st lead</span>}
                            {secondaryLeads.length > 0 && <span className="text-amber-400 ml-1">• {secondaryLeads.length} 2nd lead</span>}
                        </span>
                    )}
                </p>
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    disabled={disabled}
                    className="text-sm text-brand-light hover:text-white transition-colors disabled:opacity-50"
                >
                    {isExpanded ? 'Hide Directory' : 'Select Members'}
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
                                placeholder="Search existing users by name or email..."
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
                            <div className="p-5 text-center space-y-3">
                                <p className="text-slate-400 text-sm">
                                    {searchQuery ? 'No existing users match your search' : 'No users available'}
                                </p>
                                {canInviteUsers && searchQuery.trim().includes('@') && (
                                    <button
                                        type="button"
                                        disabled={inviting}
                                        onClick={() => executeInviteEmail(searchQuery)}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-secondary hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        <EnvelopeIcon className="w-4 h-4" />
                                        <span>Invite "{searchQuery.trim()}" to Project</span>
                                    </button>
                                )}
                            </div>
                        ) : (
                            filteredUsers.map((user) => {
                                const selected = isSelected(user.uid);
                                const member = getSelectedMember(user.uid);
                                const isOwner = isPrimaryLead(user.uid);
                                const pendingSetup = !user.lastSignIn;
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
                                                    {(() => {
                                                        let name = user.displayName;
                                                        if (!name || name.includes('@')) {
                                                            name = user.email.split('@')[0];
                                                            name = name.charAt(0).toUpperCase() + name.slice(1);
                                                        }
                                                        return name;
                                                    })()}
                                                    {isOwner && (
                                                        <span className="text-xs bg-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded">
                                                            Project Owner
                                                        </span>
                                                    )}
                                                    {pendingSetup && (
                                                        <span className="text-[10px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-1.5 py-0.5 rounded">
                                                            Pending Setup
                                                        </span>
                                                    )}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs text-slate-400">{user.email}</p>
                                                    <UserAchievementBadge userId={user.uid} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {canInviteUsers && pendingSetup && !disabled && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleSendReminder(user.email, e)}
                                                    disabled={remindingEmail === user.email}
                                                    className="p-1.5 rounded text-yellow-400 hover:text-yellow-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
                                                    title={`Send reminder email to ${user.email}`}
                                                >
                                                    <EnvelopeIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            {selected && !isOwner && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleCycleLeadRole(user.uid, e)}
                                                    className={`p-1.5 rounded transition-colors ${member?.leadRole === 'secondary'
                                                        ? 'bg-amber-500/20 text-amber-400'
                                                        : 'text-slate-500 hover:text-amber-400 hover:bg-slate-700'
                                                        }`}
                                                    title={member?.leadRole === 'secondary' ? 'Remove as 2nd Lead' : 'Set as 2nd Lead'}
                                                >
                                                    <StarIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            {isOwner && selected && (
                                                <span className="text-xs text-blue-400 bg-blue-500/20 px-2 py-1 rounded">
                                                    1st Lead
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

            {/* Former Project Members (Retained for Historical Attribution) */}
            {formerMembers && formerMembers.length > 0 && (
                <div className="pt-2 border-t border-slate-700/60">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80"></span>
                            Former Project Members ({formerMembers.length})
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsFormerExpanded(!isFormerExpanded)}
                            className="text-xs text-brand-light hover:text-white transition-colors"
                        >
                            {isFormerExpanded ? 'Hide' : 'View'}
                        </button>
                    </div>
                    {isFormerExpanded && (
                        <div className="mt-2 space-y-1 bg-slate-900/40 border border-slate-700/60 rounded-lg p-2 max-h-40 overflow-y-auto">
                            {formerMembers.map((fm) => (
                                <div key={fm.uid} className="flex items-center justify-between p-2 rounded hover:bg-slate-800/60 text-xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-6 h-6 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center shrink-0 text-[10px] text-slate-300">
                                            {fm.photoURL ? <img src={fm.photoURL} className="w-6 h-6 rounded-full" alt="" /> : (fm.displayName?.[0] || fm.email[0]).toUpperCase()}
                                        </div>
                                        <div className="truncate">
                                            <span className="font-medium text-slate-300 truncate block">
                                                {fm.displayName || fm.email}
                                            </span>
                                            <span className="text-[10px] text-slate-500">Retained for task attribution</span>
                                        </div>
                                    </div>
                                    {onRestoreFormerMember && !disabled && (
                                        <button
                                            type="button"
                                            onClick={() => onRestoreFormerMember(fm)}
                                            className="px-2 py-1 text-[11px] font-medium bg-brand-secondary/20 hover:bg-brand-secondary/30 text-brand-light rounded border border-brand-secondary/30 transition-colors ml-2 shrink-0"
                                        >
                                            Re-add to Team
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Member Removal Confirmation Dialog */}
            {pendingRemoval && (
                <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={() => setPendingRemoval(null)}>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3 border-b border-slate-700 pb-3">
                            <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                                <UserIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-white">Remove Team Member</h3>
                                <p className="text-xs text-slate-400">
                                    {pendingRemoval.member.displayName || pendingRemoval.member.email}
                                </p>
                            </div>
                        </div>

                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200">
                            This member is currently assigned to <strong className="text-white">{pendingRemoval.taskCount} task(s)</strong> in this project.
                            Choose how to handle their assigned tasks:
                        </div>

                        <div className="space-y-3 pt-1">
                            <label className={`block p-3 rounded-lg border cursor-pointer transition-colors ${
                                removalChoice === 'former'
                                    ? 'bg-brand-secondary/10 border-brand-secondary text-white'
                                    : 'bg-slate-900/40 border-slate-700 text-slate-300 hover:bg-slate-700/40'
                            }`}>
                                <div className="flex items-start gap-3">
                                    <input
                                        type="radio"
                                        name="removalChoice"
                                        checked={removalChoice === 'former'}
                                        onChange={() => setRemovalChoice('former')}
                                        className="mt-1 text-brand-secondary focus:ring-brand-secondary"
                                    />
                                    <div>
                                        <p className="text-sm font-semibold flex items-center gap-2">
                                            Retain as Former Member
                                            <span className="text-[10px] bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded font-normal">Recommended</span>
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Preserves their name and avatar on past & existing tasks to keep historical records and deliverables intact. Their access to this project is immediately revoked.
                                        </p>
                                    </div>
                                </div>
                            </label>

                            <label className={`block p-3 rounded-lg border cursor-pointer transition-colors ${
                                removalChoice === 'clear'
                                    ? 'bg-red-500/10 border-red-500/50 text-white'
                                    : 'bg-slate-900/40 border-slate-700 text-slate-300 hover:bg-slate-700/40'
                            }`}>
                                <div className="flex items-start gap-3">
                                    <input
                                        type="radio"
                                        name="removalChoice"
                                        checked={removalChoice === 'clear'}
                                        onChange={() => setRemovalChoice('clear')}
                                        className="mt-1 text-red-500 focus:ring-red-500"
                                    />
                                    <div>
                                        <p className="text-sm font-semibold text-red-300">
                                            Unassign from All Tasks
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Completely removes them from all {pendingRemoval.taskCount} task(s) in this project.
                                        </p>
                                    </div>
                                </div>
                            </label>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setPendingRemoval(null)}
                                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmRemoval}
                                className="flex-1 px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Confirm Removal
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Ownership Transfer Confirmation Dialog */}
            {pendingOwnershipTransfer && (
                <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={() => setPendingOwnershipTransfer(null)}>
                    <div className="bg-slate-800 border border-blue-500/40 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3 border-b border-slate-700 pb-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0">
                                <StarIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-white">Transfer Project Ownership (1st Lead)</h3>
                                <p className="text-xs text-slate-400">
                                    New 1st Lead: {pendingOwnershipTransfer.displayName || pendingOwnershipTransfer.email}
                                </p>
                            </div>
                        </div>

                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-200 leading-relaxed">
                            You are about to transfer <strong className="text-white">1st Lead (Project Ownership)</strong> to{' '}
                            <strong className="text-white">{pendingOwnershipTransfer.displayName || pendingOwnershipTransfer.email}</strong> (currently a 2nd Lead).
                            <br /><br />
                            The previous 1st Lead will remain on the project as a <strong className="text-amber-300">2nd Lead</strong>. Remember to click <strong className="text-white">Save Changes</strong> to persist this ownership transfer.
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setPendingOwnershipTransfer(null)}
                                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmOwnershipTransfer}
                                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors"
                            >
                                Confirm Transfer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamMemberSelector;
