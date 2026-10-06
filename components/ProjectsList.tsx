import React from 'react';
import { Project, TaskStatus, TeamMember } from '../types';
import CircularProgress from './CircularProgress';
import StatusBadge from './StatusBadge';
import { ChevronRightIcon, PlusCircleIcon, PencilIcon, TrashIcon } from './icons';
import { useUserLookup } from '../hooks/useUserLookup';
import MemberCountChart from './charts/MemberCountChart';

interface ProjectsListProps {
    projects: Project[];
    onSelectProject: (project: Project) => void;
    onShowCreateModal: () => void;
    onShowPasteModal: () => void;
    onEditProject: (project: Project) => void;
    onDeleteProject: (project: Project) => void;
    onRestoreProject?: (project: Project) => void;
    onPermanentDeleteProject?: (project: Project) => void;
    canModify: boolean;
    canDeleteProject?: (project: Project) => boolean;
    isProjectDeleteProtected?: (project: Project) => boolean;
}

const ProjectsList: React.FC<ProjectsListProps> = ({
    projects,
    onSelectProject,
    onShowCreateModal,
    onShowPasteModal,
    onEditProject,
    onDeleteProject,
    onRestoreProject,
    onPermanentDeleteProject,
    canModify,
    canDeleteProject,
    isProjectDeleteProtected
}) => {
    const { getUserDisplayName, getUserPhotoURL } = useUserLookup();

    // Get the project owner info
    const getOwnerInfo = (project: Project) => {
        const ownerMember = project.team?.members?.find(m => m.leadRole === 'primary');
        if (ownerMember) {
            return {
                name: getUserDisplayName(ownerMember.uid, ownerMember.email) || ownerMember.displayName || ownerMember.email || 'Owner',
                photoURL: getUserPhotoURL(ownerMember.uid, ownerMember.email) || ownerMember.photoURL,
            };
        }
        // Fallback to project-level owner info
        if (project.ownerId) {
            return {
                name: getUserDisplayName(project.ownerId, project.ownerEmail) || project.ownerName || project.ownerEmail || 'Owner',
                photoURL: getUserPhotoURL(project.ownerId, project.ownerEmail) || project.ownerPhotoURL,
            };
        }
        return { name: project.ownerEmail || 'Unassigned', photoURL: undefined };
    };

    // Get secondary leads
    const getSecondaryLeads = (project: Project): TeamMember[] => {
        return project.team?.members?.filter(m => m.leadRole === 'secondary') || [];
    };

    // Get total team member count
    const getMemberCount = (project: Project): number => {
        return project.team?.members?.length || 0;
    };

    const getProjectStatusSummary = (project: Project) => {
        const tasks = project.phases.flatMap(ph => ph.tasks);
        if (tasks.length === 0) return 'No tasks yet';
        const completed = tasks.filter(t => t.status === TaskStatus.Hundred || (t.status as string) === 'Completed').length;
        const total = tasks.length;
        return `${completed} / ${total} tasks completed`;
    }

    const getProjectCompletionPercentage = (project: Project) => {
        const allProjectTasks = project.phases.flatMap(ph =>
            ph.tasks.flatMap(t => t.subTasks ? [t, ...t.subTasks] : [t])
        );
        if (allProjectTasks.length === 0) return 0;
        const completed = allProjectTasks.filter(t => t.status === TaskStatus.Hundred || (t.status as string) === 'Completed').length;
        return Math.round((completed / allProjectTasks.length) * 100);
    }

    const getProjectOverallStatus = (project: Project): { status: TaskStatus; label: string } => {
        const allProjectTasks = project.phases.flatMap(ph =>
            ph.tasks.flatMap(t => t.subTasks ? [t, ...t.subTasks] : [t])
        );

        if (allProjectTasks.length === 0) {
            return { status: TaskStatus.Zero, label: 'Not Started' };
        }

        // Check if any task is at risk
        const hasAtRisk = allProjectTasks.some(t => t.status === TaskStatus.AtRisk);
        if (hasAtRisk) {
            return { status: TaskStatus.AtRisk, label: 'At Risk' };
        }

        // Use actual percentage and pick closest status
        const percentage = getProjectCompletionPercentage(project);
        if (percentage >= 88) return { status: TaskStatus.Hundred, label: '100%' };
        if (percentage >= 63) return { status: TaskStatus.SeventyFive, label: '75%' };
        if (percentage >= 38) return { status: TaskStatus.Fifty, label: '50%' };
        if (percentage >= 13) return { status: TaskStatus.TwentyFive, label: '25%' };
        return { status: TaskStatus.Zero, label: '0%' };
    }

    const [lifecycleFilter, setLifecycleFilter] = React.useState<'active' | 'archived' | 'trash'>('active');
    const [timeFilter, setTimeFilter] = React.useState<'all' | 'today' | 'week' | 'month' | 'quarter' | 'year'>('all');
    const [typeFilter, setTypeFilter] = React.useState<string>('all');
    const [searchQuery, setSearchQuery] = React.useState<string>('');

    const activeCount = React.useMemo(() => projects.filter(p => !p.isDeleted && !p.isArchived).length, [projects]);
    const archivedCount = React.useMemo(() => projects.filter(p => !p.isDeleted && p.isArchived).length, [projects]);
    const trashCount = React.useMemo(() => projects.filter(p => p.isDeleted).length, [projects]);

    // Get unique project types for filter (from non-deleted projects)
    const projectTypes = React.useMemo(() => {
        const types = new Set(projects.filter(p => !p.isDeleted).map(p => p.coreSystem).filter(Boolean));
        return Array.from(types).sort();
    }, [projects]);

    const filteredProjects = React.useMemo(() => {
        return projects.filter(project => {
            // Filter by Lifecycle (Active vs Archived vs Trash)
            if (lifecycleFilter === 'active') {
                if (project.isDeleted || project.isArchived) return false;
            } else if (lifecycleFilter === 'archived') {
                if (project.isDeleted || !project.isArchived) return false;
            } else if (lifecycleFilter === 'trash') {
                if (!project.isDeleted) return false;
            }

            // Filter by Search Query
            if (searchQuery && !project.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                !project.coreSystem.toLowerCase().includes(searchQuery.toLowerCase())) {
                return false;
            }

            // Filter by Type
            if (typeFilter !== 'all' && project.coreSystem !== typeFilter) {
                return false;
            }

            // Filter by Time
            if (timeFilter !== 'all' && project.createdAt) {
                const created = new Date(project.createdAt);
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const createdDay = new Date(created.getFullYear(), created.getMonth(), created.getDate());

                if (timeFilter === 'today') {
                    if (createdDay.getTime() !== today.getTime()) return false;
                } else if (timeFilter === 'week') {
                    const oneWeekAgo = new Date(today);
                    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                    if (created < oneWeekAgo) return false;
                } else if (timeFilter === 'month') {
                    const oneMonthAgo = new Date(today);
                    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                    if (created < oneMonthAgo) return false;
                } else if (timeFilter === 'quarter') {
                    const threeMonthsAgo = new Date(today);
                    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                    if (created < threeMonthsAgo) return false;
                } else if (timeFilter === 'year') {
                    const oneYearAgo = new Date(today);
                    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                    if (created < oneYearAgo) return false;
                }
            }

            return true;
        });
    }, [projects, timeFilter, typeFilter, searchQuery]);

    return (
        <div className="space-y-6">
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-slate-700/50 space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-white">Projects</h2>
                            <p className="text-slate-400 text-sm mt-1">Manage and track your projects.</p>
                        </div>
                        {canModify && (
                            <div className="flex space-x-2">
                                <button onClick={onShowPasteModal} className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm">
                                    <PencilIcon className="w-5 h-5" />
                                    <span>Paste Project</span>
                                </button>
                                <button onClick={onShowCreateModal} className="flex items-center space-x-2 bg-brand-secondary hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm">
                                    <PlusCircleIcon className="w-5 h-5" />
                                    <span>New Project</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Lifecycle Status Tabs */}
                    <div className="flex items-center gap-2 border-b border-slate-700/60 pb-3 flex-wrap">
                        <button
                            onClick={() => setLifecycleFilter('active')}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${lifecycleFilter === 'active'
                                ? 'bg-brand-secondary text-white shadow-sm'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                }`}
                        >
                            <span>Active Projects</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${lifecycleFilter === 'active' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                                }`}>
                                {activeCount}
                            </span>
                        </button>

                        <button
                            onClick={() => setLifecycleFilter('archived')}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${lifecycleFilter === 'archived'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                }`}
                        >
                            <span>Archived</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${lifecycleFilter === 'archived' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                                }`}>
                                {archivedCount}
                            </span>
                        </button>

                        <button
                            onClick={() => setLifecycleFilter('trash')}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${lifecycleFilter === 'trash'
                                ? 'bg-red-600/90 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                }`}
                        >
                            <span className="flex items-center gap-1">
                                <span>Trash</span>
                            </span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${trashCount > 0
                                ? (lifecycleFilter === 'trash' ? 'bg-white/20 text-white' : 'bg-red-500/20 text-red-400 font-bold')
                                : 'bg-slate-800 text-slate-400'
                                }`}>
                                {trashCount}
                            </span>
                        </button>
                    </div>

                    {/* Trash Information Banner */}
                    {lifecycleFilter === 'trash' && (
                        <div className="p-3.5 bg-red-950/20 border border-red-900/40 rounded-xl flex items-center justify-between text-xs text-red-200">
                            <div className="flex items-center gap-2.5">
                                <span className="text-base">🗑️</span>
                                <div>
                                    <strong className="text-red-300">Recycle Bin (Recently Deleted):</strong> Projects here are safe from active workflows. You can restore them anytime with a single click, or permanently delete them with typed confirmation.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Filters */}
                    <div className="flex flex-wrap gap-4 items-center pt-1">
                        {/* Search Input */}
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                className="bg-slate-900/50 border border-slate-700 text-slate-300 text-xs rounded-lg focus:ring-brand-secondary focus:border-brand-secondary block w-full pl-10 p-2.5 min-w-[200px]"
                                placeholder="Search projects..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Time Filter */}
                        <div className="flex items-center space-x-2 bg-slate-900/50 p-1 rounded-lg border border-slate-700">
                            {(['all', 'today', 'week', 'month', 'quarter', 'year'] as const).map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setTimeFilter(filter)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${timeFilter === filter
                                        ? 'bg-brand-secondary text-white'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                        }`}
                                >
                                    {filter === 'all' ? 'All Time' : filter}
                                </button>
                            ))}
                        </div>

                        {/* Type Filter */}
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="bg-slate-900/50 border border-slate-700 text-slate-300 text-xs rounded-lg focus:ring-brand-secondary focus:border-brand-secondary block p-2.5 min-w-[150px] max-w-[200px] truncate"
                        >
                            <option value="all">All Types</option>
                            {projectTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {filteredProjects.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-slate-400 text-lg mb-4">No projects found matching filters</p>
                        {projects.length === 0 && canModify && (
                            <div className="flex justify-center space-x-4">
                                <button
                                    onClick={onShowPasteModal}
                                    className="inline-flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                                >
                                    <PencilIcon className="w-5 h-5" />
                                    <span>Paste Project</span>
                                </button>
                                <button
                                    onClick={onShowCreateModal}
                                    className="inline-flex items-center space-x-2 bg-brand-secondary hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                                >
                                    <PlusCircleIcon className="w-5 h-5" />
                                    <span>Create Your First Project</span>
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-700">
                        {filteredProjects.map(project => (
                            <li
                                key={project.id}
                                className="p-6 hover:bg-slate-800 transition-colors flex justify-between items-center group"
                            >
                                <div className="flex items-center space-x-4 flex-grow">
                                    <CircularProgress percentage={getProjectCompletionPercentage(project)} size={60} />
                                    <div
                                        onClick={() => onSelectProject(project)}
                                        className="flex-grow cursor-pointer"
                                    >
                                        <div className="flex items-center space-x-3 mb-1 flex-wrap gap-y-1">
                                            <p className="font-semibold text-white group-hover:text-brand-light">{project.name}</p>
                                            {/* Privacy indicator */}
                                            {project.isPublic ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
                                                    <span className="mr-1">🌐</span> Public
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700/80 text-slate-400 border border-slate-600">
                                                    <span className="mr-1">🔒</span> Private
                                                </span>
                                            )}
                                            {/* Archived indicator */}
                                            {project.isArchived && !project.isDeleted && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                                    </svg>
                                                    Archived
                                                </span>
                                            )}
                                            {/* In Trash indicator */}
                                            {project.isDeleted && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30">
                                                    <span className="mr-1">🗑️</span> In Trash
                                                </span>
                                            )}
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${(() => {
                                                const pct = getProjectCompletionPercentage(project);
                                                if (pct >= 75) return 'bg-green-500/10 text-green-400';
                                                if (pct >= 50) return 'bg-blue-500/10 text-blue-400';
                                                if (pct >= 25) return 'bg-sky-500/10 text-sky-400';
                                                if (pct > 0) return 'bg-indigo-500/10 text-indigo-400';
                                                return 'bg-gray-500/10 text-gray-400';
                                            })()
                                                }`}>
                                                {getProjectCompletionPercentage(project)}%
                                            </span>
                                            {/* Project Type Badge */}
                                            {project.coreSystem && (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300 border border-slate-600">
                                                    {project.coreSystem}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-400">{getProjectStatusSummary(project)}</p>
                                        <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-2 text-xs text-slate-500">
                                            {/* Owner with avatar */}
                                            <div className="flex items-center space-x-1.5">
                                                {(() => {
                                                    const owner = getOwnerInfo(project);
                                                    return (
                                                        <>
                                                            {owner.photoURL ? (
                                                                <img
                                                                    src={owner.photoURL}
                                                                    alt={owner.name}
                                                                    className="w-5 h-5 rounded-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="w-5 h-5 rounded-full bg-brand-secondary/20 flex items-center justify-center">
                                                                    <span className="text-[10px] font-medium text-brand-light">
                                                                        {owner.name.charAt(0).toUpperCase()}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <span className="text-slate-400">
                                                                <span className="text-slate-500">Owner:</span> {owner.name}
                                                            </span>
                                                        </>
                                                    );
                                                })()}
                                            </div>

                                            <span className="text-slate-600">•</span>
                                            <span>Created: {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'N/A'}</span>

                                            {project.isDeleted && (
                                                <>
                                                    <span className="text-slate-600">•</span>
                                                    <span className="text-red-400 font-medium">
                                                        Deleted: {project.deletedAt ? new Date(project.deletedAt).toLocaleDateString() : 'Recently'}
                                                        {project.deletedByName ? ` by ${project.deletedByName}` : ''}
                                                    </span>
                                                </>
                                            )}

                                            {/* Member count chart */}
                                            {getMemberCount(project) > 0 && (
                                                <MemberCountChart count={getMemberCount(project)} size={32} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 ml-4">
                                    {project.isDeleted ? (
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onRestoreProject?.(project); }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg text-xs font-semibold border border-emerald-500/30 transition-all shadow-sm"
                                                title="Restore project to active list"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                                <span>Restore</span>
                                            </button>
                                            {canDeleteProject && canDeleteProject(project) ? (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onPermanentDeleteProject?.(project); }}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-xs font-medium border border-red-500/20 transition-all"
                                                    title="Permanently delete project"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                    <span>Delete</span>
                                                </button>
                                            ) : isProjectDeleteProtected && isProjectDeleteProtected(project) ? (
                                                <button
                                                    disabled
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="p-1.5 text-slate-600 rounded cursor-not-allowed opacity-40 hover:text-slate-600"
                                                    title="Protected: Projects created by primary SuperAdmin (talgans@gmail.com) cannot be deleted"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            ) : null}
                                        </div>
                                    ) : canModify ? (
                                        <>
                                            <button onClick={(e) => { e.stopPropagation(); onEditProject(project); }} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-700 transition-colors" title="Edit project">
                                                <PencilIcon className="w-5 h-5" />
                                            </button>
                                            {canDeleteProject && canDeleteProject(project) ? (
                                                <button onClick={(e) => { e.stopPropagation(); onDeleteProject(project); }} className="p-2 text-slate-400 hover:text-red-500 rounded-full hover:bg-slate-700 transition-colors" title="Delete project">
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            ) : isProjectDeleteProtected && isProjectDeleteProtected(project) ? (
                                                <button
                                                    disabled
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="p-2 text-slate-600 rounded-full cursor-not-allowed opacity-40 hover:text-slate-600"
                                                    title="Protected: Projects created by primary SuperAdmin (talgans@gmail.com) cannot be deleted"
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            ) : null}
                                        </>
                                    ) : (
                                        <ChevronRightIcon className="w-6 h-6 text-slate-500" />
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default ProjectsList;
