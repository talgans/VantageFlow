import React from 'react';
import { Project, TaskStatus } from '../types';
import CircularProgress from './CircularProgress';
import StatusBadge from './StatusBadge';
import { ChevronRightIcon, PlusCircleIcon, PencilIcon, TrashIcon } from './icons';

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

        // Check completion percentage
        const percentage = getProjectCompletionPercentage(project);
        if (percentage === 100) {
            return { status: TaskStatus.Hundred, label: 'Completed' };
        }
        if (percentage > 0) {
            if (percentage >= 75) return { status: TaskStatus.SeventyFive, label: 'On Track' };
            if (percentage >= 50) return { status: TaskStatus.Fifty, label: 'In Progress' };
            return { status: TaskStatus.TwentyFive, label: 'Started' };
        }

        return { status: TaskStatus.Zero, label: 'Not Started' };
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
                                            <StatusBadge status={getProjectOverallStatus(project).status} />
                                        </div>
                                        <p className="text-sm text-slate-400">{getProjectStatusSummary(project)}</p>
                                        <div className="flex items-center space-x-4 mt-2 text-xs text-slate-500">
                                            <span>Owner: {project.ownerEmail || 'Unassigned'}</span>
                                            <span>•</span>
                                            <span>Created: {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'N/A'}</span>
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
