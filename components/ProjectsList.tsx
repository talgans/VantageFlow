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
    canModify: boolean;
}

const ProjectsList: React.FC<ProjectsListProps> = ({
    projects,
    onSelectProject,
    onShowCreateModal,
    onShowPasteModal,
    onEditProject,
    onDeleteProject,
    canModify
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

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-white">Projects</h2>
                <p className="text-slate-400 mt-1">Manage and track your projects.</p>
            </div>

            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-6 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-slate-300">All Projects</h3>
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
                {projects.length === 0 ? (
                    <div className="p-12 text-center">
                        <p className="text-slate-400 text-lg mb-4">No projects yet</p>
                        {canModify && (
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
                        {projects.map(project => (
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
                                        <div className="flex items-center space-x-3 mb-1">
                                            <p className="font-semibold text-white group-hover:text-brand-light">{project.name}</p>
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

                                            {/* Member count chart */}
                                            {getMemberCount(project) > 0 && (
                                                <MemberCountChart count={getMemberCount(project)} size={32} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 ml-4">
                                    {canModify ? (
                                        <>
                                            <button onClick={(e) => { e.stopPropagation(); onEditProject(project); }} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-700 transition-colors">
                                                <PencilIcon className="w-5 h-5" />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); onDeleteProject(project); }} className="p-2 text-slate-400 hover:text-red-500 rounded-full hover:bg-slate-700 transition-colors">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
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
