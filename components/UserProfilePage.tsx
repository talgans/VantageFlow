import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Project } from '../types';
import { UserIcon, PencilIcon, CameraIcon, XMarkIcon, CheckIcon } from './icons';
import { updateUserProfile, getInitials } from '../services/userService';
import { uploadProfilePhoto } from '../services/storageService';
import UserAchievementBadge from './UserAchievementBadge';
import UserAnalytics from './UserAnalytics';

interface UserProfilePageProps {
    projects: Project[];
    onSelectProject: (project: Project) => void;
    showToast: (message: string) => void;
}

const UserProfilePage: React.FC<UserProfilePageProps> = ({
    projects,
    onSelectProject,
    showToast,
}) => {
    const { user, refreshUserRole } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [editDisplayName, setEditDisplayName] = useState(user?.displayName || '');
    const [saving, setSaving] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Filter projects owned by current user
    const ownedProjects = useMemo(() => {
        if (!user) return [];
        return projects.filter(p => p.ownerId === user.uid);
    }, [projects, user]);

    // Filter projects where user is a team member (but not owner)
    const memberProjects = useMemo(() => {
        if (!user) return [];
        return projects.filter(p => {
            // Exclude owned projects
            if (p.ownerId === user.uid) return false;
            // Check if user is a team member
            return p.team?.members?.some(m => m.uid === user.uid);
        });
    }, [projects, user]);

    const handleSaveProfile = async () => {
        if (!editDisplayName.trim()) {
            showToast('Display name cannot be empty');
            return;
        }

        setSaving(true);
        try {
            await updateUserProfile(editDisplayName.trim());
            await refreshUserRole(); // Refresh to get updated user data
            setIsEditing(false);
            showToast('Profile updated successfully!');
        } catch (error: any) {
            showToast(error.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setEditDisplayName(user?.displayName || '');
        setIsEditing(false);
    };

    const handlePhotoClick = () => {
        if (fileInputRef.current && !uploadingPhoto) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user) return;

        // Basic validation
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            showToast('File size must be less than 5MB');
            return;
        }

        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file');
            return;
        }

        setUploadingPhoto(true);
        try {
            const photoURL = await uploadProfilePhoto(user.uid, file);
            await updateUserProfile(undefined, photoURL);
            await refreshUserRole();
            showToast('Profile photo updated successfully!');
        } catch (error: any) {
            console.error('Error uploading photo:', error);
            showToast('Failed to upload photo. Please try again.');
        } finally {
            setUploadingPhoto(false);
            // Reset input
            if (event.target) {
                event.target.value = '';
            }
        }
    };

    const getRoleBadgeColor = (role: string) => {
        if (role.includes('Admin')) return 'bg-red-500/20 text-red-300 border-red-500/30';
        if (role.includes('Manager')) return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    };

    const ProjectCard: React.FC<{ project: Project; isOwned?: boolean }> = ({ project, isOwned }) => {
        const completedTasks = project.phases.flatMap(p => p.tasks).filter(t => t.status === '100%').length;
        const totalTasks = project.phases.flatMap(p => p.tasks).length;
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        return (
            <div
                onClick={() => onSelectProject(project)}
                className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:bg-slate-800 hover:border-slate-600 transition-all cursor-pointer group"
            >
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-grow min-w-0">
                        <h4 className="text-white font-semibold truncate group-hover:text-brand-light transition-colors">
                            {project.name}
                        </h4>
                        <p className="text-sm text-slate-400 truncate">{project.coreSystem}</p>
                    </div>
                    {isOwned && (
                        <span className="ml-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded flex-shrink-0">
                            Owner
                        </span>
                    )}
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-400">Progress</span>
                        <span className="text-slate-300">{progress}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-brand-secondary to-blue-400 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Team size */}
                <div className="mt-3 flex items-center text-xs text-slate-400">
                    <UserIcon className="w-3.5 h-3.5 mr-1" />
                    <span>{project.team?.members?.length || 0} member{(project.team?.members?.length || 0) !== 1 ? 's' : ''}</span>
                </div>
            </div>
        );
    };

    if (!user) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-400">Please sign in to view your profile.</p>
            </div>
        );
    }

    const initials = getInitials(user.displayName, user.email);

    return (
        <div className="space-y-8">
            {/* Profile Header */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    {/* Avatar */}
                    <div className="relative group">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            className="hidden"
                        />
                        {user.photoURL ? (
                            <img
                                src={user.photoURL}
                                alt={user.displayName || 'User'}
                                className="w-24 h-24 rounded-full object-cover border-4 border-slate-700"
                            />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-secondary to-blue-600 flex items-center justify-center border-4 border-slate-700">
                                <span className="text-3xl font-bold text-white">{initials}</span>
                            </div>
                        )}
                        {/* Photo upload overlay */}
                        <div
                            onClick={handlePhotoClick}
                            className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                        >
                            {uploadingPhoto ? (
                                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <CameraIcon className="w-8 h-8 text-white" />
                            )}
                        </div>
                    </div>

                    {/* User Info */}
                    <div className="flex-grow">
                        {isEditing ? (
                            <div className="flex items-center gap-3 mb-2">
                                <input
                                    type="text"
                                    value={editDisplayName}
                                    onChange={(e) => setEditDisplayName(e.target.value)}
                                    className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-xl font-bold focus:outline-none focus:border-brand-secondary"
                                    placeholder="Enter your name"
                                    autoFocus
                                />
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={saving}
                                    className="p-2 bg-green-600 hover:bg-green-500 rounded-lg text-white transition-colors disabled:opacity-50"
                                    title="Save"
                                >
                                    {saving ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <CheckIcon className="w-5 h-5" />
                                    )}
                                </button>
                                <button
                                    onClick={handleCancelEdit}
                                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
                                    title="Cancel"
                                >
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 mb-2">
                                <h2 className="text-2xl font-bold text-white">
                                    {user.displayName || 'Set your name'}
                                </h2>
                                <button
                                    onClick={() => {
                                        setEditDisplayName(user.displayName || '');
                                        setIsEditing(true);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                    title="Edit name"
                                >
                                    <PencilIcon className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        <p className="text-slate-400 mb-3">{user.email}</p>

                        <span className={`inline-block px-3 py-1 rounded-lg text-sm font-semibold border ${getRoleBadgeColor(user.role)}`}>
                            {user.role}
                        </span>
                        <div className="mt-3">
                            <UserAchievementBadge userId={user.uid} showPoints={true} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Projects Owned */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">
                        Projects Owned
                        <span className="ml-2 text-sm font-normal text-slate-400">({ownedProjects.length})</span>
                    </h3>
                </div>

                {ownedProjects.length === 0 ? (
                    <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-8 text-center">
                        <p className="text-slate-400">You don't own any projects yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {ownedProjects.map(project => (
                            <ProjectCard key={project.id} project={project} isOwned />
                        ))}
                    </div>
                )}
            </div>

            {/* Projects as Team Member */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">
                        Team Member On
                        <span className="ml-2 text-sm font-normal text-slate-400">({memberProjects.length})</span>
                    </h3>
                </div>

                {memberProjects.length === 0 ? (
                    <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-8 text-center">
                        <p className="text-slate-400">You're not a member of any other projects.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {memberProjects.map(project => (
                            <ProjectCard key={project.id} project={project} />
                        ))}
                    </div>
                )}
            </div>


            {/* Analytics Section */}
            <div>
                <h3 className="text-xl font-bold text-white mb-4">Achievement Analytics</h3>
                <UserAnalytics userId={user.uid} />
            </div>

        </div >
    );
};

export default UserProfilePage;
