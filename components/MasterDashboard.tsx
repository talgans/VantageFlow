
import React, { useState, useMemo } from 'react';
import { Project, Task, TaskStatus, TeamMember } from '../types';
import { ChevronRightIcon, PlusCircleIcon, PencilIcon, TrashIcon, UsersIcon, MagnifyingGlassIcon, CalendarIcon, XMarkIcon, ArrowPathIcon } from './icons';
import ProjectStatusPieChart from './charts/ProjectStatusPieChart';
import CircularProgress from './CircularProgress';
import StatusBadge from './StatusBadge';
import NotificationCenter from './NotificationCenter';
import { useUserLookup } from '../hooks/useUserLookup';

interface MasterDashboardProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onShowCreateModal: () => void;
  onShowPasteModal: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  canModify: boolean;
}

const MasterDashboard: React.FC<MasterDashboardProps> = ({ projects, onSelectProject, onShowCreateModal, onShowPasteModal, onEditProject, onDeleteProject, canModify }) => {
  const { getUserDisplayName, getUserPhotoURL } = useUserLookup();

  // Filter States
  const [filterTitle, setFilterTitle] = useState('');
  const [filterMemberId, setFilterMemberId] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Extract all unique team members from all projects for the filter dropdown
  const allMembers = useMemo(() => {
    const membersMap = new Map<string, TeamMember>();
    projects.forEach(p => {
      p.team?.members?.forEach(m => {
        if (!membersMap.has(m.uid)) {
          membersMap.set(m.uid, m);
        }
      });
      // Also include owners if not in team list
      if (p.ownerId && !membersMap.has(p.ownerId)) {
        membersMap.set(p.ownerId, { uid: p.ownerId, email: p.ownerEmail || '', displayName: p.ownerName, photoURL: p.ownerPhotoURL } as TeamMember);
      }
    });
    return Array.from(membersMap.values()).sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      // 1. Title Filter
      if (filterTitle && !p.name.toLowerCase().includes(filterTitle.toLowerCase())) return false;

      // 2. Member Filter
      if (filterMemberId !== 'all') {
        const isMember = p.team?.members?.some(m => m.uid === filterMemberId);
        const isOwner = p.ownerId === filterMemberId;
        if (!isMember && !isOwner) return false;
      }

      // 3. Date Range Filter (CreatedAt)
      if (p.createdAt) {
        const pDate = new Date(p.createdAt);
        if (filterStartDate) {
          const start = new Date(filterStartDate);
          if (pDate < start) return false;
        }
        if (filterEndDate) {
          const end = new Date(filterEndDate);
          // Set end date to end of day
          end.setHours(23, 59, 59, 999);
          if (pDate > end) return false;
        }
      }

      return true;
    });
  }, [projects, filterTitle, filterMemberId, filterStartDate, filterEndDate]);

  const clearFilters = () => {
    setFilterTitle('');
    setFilterMemberId('all');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  // Determine if we are in "Single Project View" mode (exactly one project visible)
  const isSingleProjectView = filteredProjects.length === 1;
  const singleProject = isSingleProjectView ? filteredProjects[0] : null;

  const allTasks = filteredProjects.flatMap(p => p.phases.flatMap(ph => ph.tasks.flatMap(t => t.subTasks ? [t, ...t.subTasks] : [t])));

  const statusCounts = allTasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(statusCounts).map(([name, value]) => ({
    name: name as TaskStatus,
    value,
  }));

  const totalTasks = allTasks.length;
  const completedTasks = (statusCounts[TaskStatus.Hundred] || 0) + (statusCounts['Completed'] || 0);
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

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
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold text-white">Projects Overview</h2>
            <p className="text-slate-400 mt-1">
              {isSingleProjectView
                ? singleProject?.name
                : 'Summary of filtered initiatives.'}
            </p>
          </div>
          <NotificationCenter />
        </div>

        {/* Filter Bar */}
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex flex-wrap gap-4 items-center">
          {/* Search Title */}
          <div className="relative flex-grow min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-brand-primary focus:border-brand-primary block w-full pl-10 p-2.5"
              placeholder="Search by title..."
              value={filterTitle}
              onChange={(e) => setFilterTitle(e.target.value)}
            />
          </div>

          {/* Member Select */}
          <div className="relative min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <UsersIcon className="h-5 w-5 text-slate-400" />
            </div>
            <select
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-brand-primary focus:border-brand-primary block w-full pl-10 p-2.5"
              value={filterMemberId}
              onChange={(e) => setFilterMemberId(e.target.value)}
            >
              <option value="all">All Members</option>
              {allMembers.map(member => (
                <option key={member.uid} value={member.uid}>
                  {getUserDisplayName(member.uid, member.email) || member.displayName || member.email}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <CalendarIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="date"
                className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-brand-primary focus:border-brand-primary block w-full pl-10 p-2.5"
                placeholder="Start Date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
              />
            </div>
            <span className="text-slate-500">-</span>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <CalendarIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="date"
                className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-brand-primary focus:border-brand-primary block w-full pl-10 p-2.5"
                placeholder="End Date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Clear Filters */}
          <button
            onClick={clearFilters}
            className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            title="Clear Filters"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-slate-800/50 p-6 rounded-xl border border-slate-700 flex flex-col items-center justify-center">
          <h3 className="text-lg font-semibold text-slate-300 mb-4">Overall Task Status</h3>
          <ProjectStatusPieChart data={chartData} />
        </div>
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {!isSingleProjectView ? (
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
              <h3 className="text-slate-400 font-medium">Total Projects</h3>
              <p className="text-4xl font-bold text-white mt-2">{filteredProjects.length}</p>
            </div>
          ) : (
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <UsersIcon className="w-5 h-5 text-slate-400" />
                <h3 className="text-slate-400 font-medium">Team Members</h3>
              </div>
              <div className="space-y-4">
                {(() => {
                  const project = filteredProjects[0];
                  const members = project?.team?.members || [];
                  // Sort: 1st Lead (primary) -> 2nd Lead (secondary) -> Others
                  const sortedMembers = [...members].sort((a, b) => {
                    const order = { primary: 0, secondary: 1, undefined: 2 };
                    return (order[a.leadRole as keyof typeof order] ?? 2) - (order[b.leadRole as keyof typeof order] ?? 2);
                  });
                  const displayMembers = sortedMembers.slice(0, 4);
                  const remainingCount = Math.max(0, members.length - 4);

                  if (members.length === 0) {
                    return <p className="text-sm text-slate-500">No team members assigned</p>;
                  }

                  return (
                    <>
                      <div className="space-y-3">
                        {displayMembers.map(member => (
                          <div key={member.uid} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {(() => {
                                const photoURL = getUserPhotoURL(member.uid, member.email) || member.photoURL;
                                const displayName = getUserDisplayName(member.uid, member.email) || member.displayName || member.email;
                                return photoURL ? (
                                  <img src={photoURL} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white">
                                    {displayName?.charAt(0).toUpperCase()}
                                  </div>
                                );
                              })()}
                              <div>
                                <p className="text-sm font-medium text-white">
                                  {getUserDisplayName(member.uid, member.email) || member.displayName || member.email}
                                </p>
                              </div>
                            </div>
                            {member.leadRole && (
                              <span className={`text-xs px-2 py-0.5 rounded ${member.leadRole === 'primary' ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'
                                }`}>
                                {member.leadRole === 'primary' ? '1st Lead' : '2nd Lead'}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      {remainingCount > 0 && (
                        <p className="text-xs text-slate-500 pl-11">
                          +{remainingCount} more member{remainingCount !== 1 ? 's' : ''}
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <h3 className="text-slate-400 font-medium">Total Tasks</h3>
            <p className="text-4xl font-bold text-white mt-2">{totalTasks}</p>
          </div>
          <div className="col-span-1 sm:col-span-2 bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <h3 className="text-slate-400 font-medium">Overall Progress</h3>
            <div className="flex items-center mt-2">
              <div className="w-full bg-slate-700 rounded-full h-4">
                <div className="bg-brand-secondary h-4 rounded-full" style={{ width: `${overallProgress}%` }}></div>
              </div>
              <p className="text-xl font-bold text-white ml-4">{overallProgress}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-6 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-300">Project List {filteredProjects.length !== projects.length && '(Filtered)'}</h3>
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
        {filteredProjects.length === 0 ? (
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

export default MasterDashboard;
