import React, { useState, useMemo } from 'react';
import { Project, TeamMember, TaskStatus } from '../types';
import {
  ChevronRightIcon,
  PlusCircleIcon,
  PencilIcon,
  TrashIcon,
  UsersIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ChevronDownIcon
} from './icons';
import NotificationCenter from './NotificationCenter';
import { useUserLookup } from '../hooks/useUserLookup';
import DashboardStatsCards from './dashboard/DashboardStatsCards';
import ProjectAnalysis from './dashboard/ProjectAnalysis';
import RecommendationsPanel from './dashboard/RecommendationsPanel';
import CircularProgress from './CircularProgress';
import TeamActivityHeatmap from './TeamActivityHeatmap';

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
  const { getUserDisplayName } = useUserLookup();

  // Filter States
  const [filterTitle, setFilterTitle] = useState('');
  const [filterMemberId, setFilterMemberId] = useState('all');

  // State for expanded analysis dropdown
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Extract all unique team members
  const allMembers = useMemo(() => {
    const membersMap = new Map<string, TeamMember>();
    const emailMap = new Set<string>();

    projects.forEach(p => {
      p.team?.members?.forEach(m => {
        if (!membersMap.has(m.uid) && !emailMap.has(m.email.toLowerCase())) {
          membersMap.set(m.uid, m);
          emailMap.add(m.email.toLowerCase());
        }
      });
      if (p.ownerId && !membersMap.has(p.ownerId) && p.ownerEmail && !emailMap.has(p.ownerEmail.toLowerCase())) {
        membersMap.set(p.ownerId, { uid: p.ownerId, email: p.ownerEmail || '', displayName: p.ownerName, photoURL: p.ownerPhotoURL } as TeamMember);
        emailMap.add(p.ownerEmail.toLowerCase());
      }
    });
    return Array.from(membersMap.values()).sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (filterTitle && !p.name.toLowerCase().includes(filterTitle.toLowerCase())) return false;
      if (filterMemberId !== 'all') {
        const isMember = p.team?.members?.some(m => m.uid === filterMemberId);
        const isOwner = p.ownerId === filterMemberId;
        if (!isMember && !isOwner) return false;
      }
      return true;
    });
  }, [projects, filterTitle, filterMemberId]);

  const clearFilters = () => {
    setFilterTitle('');
    setFilterMemberId('all');
  };

  // --- Data Prep for Future Tasks (upcoming task deadlines) ---
  const futureTasksData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    interface TaskInfo {
      projectName: string;
      sectionName: string;
      taskName: string;
      assignees: string[];
    }

    const tasksByDate: Record<string, { count: number; tasks: TaskInfo[] }> = {};

    filteredProjects.forEach(project => {
      project.phases?.forEach(phase => {
        phase.tasks?.forEach(task => {
          let endDate: Date;
          if ((task.endDate as any)?.toDate) {
            endDate = (task.endDate as any).toDate();
          } else if (task.endDate) {
            endDate = new Date(task.endDate);
          } else {
            return;
          }

          endDate.setHours(0, 0, 0, 0);

          if (endDate > today && task.status !== '100%') {
            const dayKey = endDate.toISOString().split('T')[0];
            if (!tasksByDate[dayKey]) {
              tasksByDate[dayKey] = { count: 0, tasks: [] };
            }
            tasksByDate[dayKey].count += 1;
            tasksByDate[dayKey].tasks.push({
              projectName: project.name || 'Unknown Project',
              sectionName: phase.name || 'Unknown Section',
              taskName: task.name || 'Unnamed Task',
              assignees: task.assignees?.map(a => a.displayName || a.email || 'Unknown') || [],
            });
          }
        });
      });
    });

    return Object.keys(tasksByDate).map(day => ({
      day,
      value: tasksByDate[day].count,
      tasks: tasksByDate[day].tasks,
    }));
  }, [filteredProjects]);

  // --- Data Prep for Overdue Tasks (incomplete past tasks) ---
  const overdueTasksData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    interface TaskInfo {
      projectName: string;
      sectionName: string;
      taskName: string;
      assignees: string[];
    }

    const tasksByDate: Record<string, { count: number; tasks: TaskInfo[] }> = {};

    filteredProjects.forEach(project => {
      project.phases?.forEach(phase => {
        phase.tasks?.forEach(task => {
          let endDate: Date;
          if ((task.endDate as any)?.toDate) {
            endDate = (task.endDate as any).toDate();
          } else if (task.endDate) {
            endDate = new Date(task.endDate);
          } else {
            return;
          }

          endDate.setHours(0, 0, 0, 0);

          if (endDate < today && task.status !== '100%') {
            const dayKey = endDate.toISOString().split('T')[0];
            if (!tasksByDate[dayKey]) {
              tasksByDate[dayKey] = { count: 0, tasks: [] };
            }
            tasksByDate[dayKey].count += 1;
            tasksByDate[dayKey].tasks.push({
              projectName: project.name || 'Unknown Project',
              sectionName: phase.name || 'Unknown Section',
              taskName: task.name || 'Unnamed Task',
              assignees: task.assignees?.map(a => a.displayName || a.email || 'Unknown') || [],
            });
          }
        });
      });
    });

    return Object.keys(tasksByDate).map(day => ({
      day,
      value: tasksByDate[day].count,
      tasks: tasksByDate[day].tasks,
    }));
  }, [filteredProjects]);

  const toggleProjectAnalysis = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedProjectId(expandedProjectId === projectId ? null : projectId);
  };

  const getProjectCompletionPercentage = (project: Project) => {
    const allProjectTasks = project.phases.flatMap(ph =>
      ph.tasks.flatMap(t => t.subTasks ? [t, ...t.subTasks] : [t])
    );
    if (allProjectTasks.length === 0) return 0;
    const completed = allProjectTasks.filter(t => t.status === TaskStatus.Hundred || (t.status as string) === 'Completed').length;
    return Math.round((completed / allProjectTasks.length) * 100);
  }

  const getProjectStatusSummary = (project: Project) => {
    const tasks = project.phases.flatMap(ph => ph.tasks);
    if (tasks.length === 0) return 'No tasks yet';
    const completed = tasks.filter(t => t.status === TaskStatus.Hundred || (t.status as string) === 'Completed').length;
    const total = tasks.length;
    return `${completed} / ${total} tasks completed`;
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-white">Dashboard</h2>
          <p className="text-slate-400 mt-1">
            Overview of all projects, performance, and recommendations.
          </p>
        </div>
        <NotificationCenter />
      </div>

      {/* Stats Cards */}
      <DashboardStatsCards projects={filteredProjects} />

      {/* Team Activity Heatmap - Full Width */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
        <TeamActivityHeatmap
          data={[]}
          futureData={futureTasksData}
          overdueData={overdueTasksData}
          view="month"
          showStats={true}
        />
      </div>

      {/* Main Content Grid - 2 Column Layout (70/30 ratio) */}
      <div className="grid grid-cols-1 lg:grid-cols-[70fr_30fr] gap-6">

        {/* Left Column: Projects List & Filter */}
        <div className="space-y-6">

          {/* Filters */}
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex flex-wrap gap-4 items-center">
            <div className="relative flex-grow min-w-[150px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg focus:ring-brand-primary focus:border-brand-primary block w-full pl-9 p-2.5"
                placeholder="Search projects..."
                value={filterTitle}
                onChange={(e) => setFilterTitle(e.target.value)}
              />
            </div>

            <div className="relative min-w-[150px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UsersIcon className="h-4 w-4 text-slate-400" />
              </div>
              <select
                className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg focus:ring-brand-primary focus:border-brand-primary block w-full pl-9 p-2.5"
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

            <button
              onClick={clearFilters}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Clear Filters"
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Project List */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center">
              <h3 className="font-semibold text-slate-200">Projects ({filteredProjects.length})</h3>
              {canModify && (
                <div className="flex space-x-2">
                  <button onClick={onShowPasteModal} className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors" title="Paste Project">
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button onClick={onShowCreateModal} className="flex items-center space-x-1 bg-brand-secondary hover:bg-blue-500 text-white py-1.5 px-3 rounded-lg transition-colors text-xs font-semibold">
                    <PlusCircleIcon className="w-4 h-4" />
                    <span>New</span>
                  </button>
                </div>
              )}
            </div>

            <div className="divide-y divide-slate-700">
              {filteredProjects.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No projects found.
                </div>
              ) : (
                filteredProjects.map(project => (
                  <div key={project.id}>
                    <div className="p-4 hover:bg-slate-800 transition-colors">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-4 flex-grow">
                          <CircularProgress percentage={getProjectCompletionPercentage(project)} size={48} strokeWidth={4} />
                          <div className="flex-grow">
                            <h4 className="font-semibold text-white">{project.name}</h4>
                            <p className="text-xs text-slate-400 mt-1">{getProjectStatusSummary(project)}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => toggleProjectAnalysis(project.id, e)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${expandedProjectId === project.id
                              ? 'bg-brand-primary/20 text-brand-light'
                              : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300'
                              }`}
                          >
                            <span>Analysis</span>
                            <ChevronDownIcon className={`w-3 h-3 transition-transform ${expandedProjectId === project.id ? 'rotate-180' : ''}`} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onSelectProject(project); }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-xs text-brand-light font-medium transition-colors"
                          >
                            <span>Details</span>
                            <ChevronRightIcon className="w-3 h-3" />
                          </button>
                          {canModify && (
                            <div className="flex items-center space-x-1">
                              <button onClick={(e) => { e.stopPropagation(); onEditProject(project); }} className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors">
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); onDeleteProject(project); }} className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-slate-700 transition-colors">
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Analysis Section */}
                    {expandedProjectId === project.id && (
                      <div className="border-t border-slate-700/50 bg-slate-900/50 overflow-hidden animate-slideDown">
                        <ProjectAnalysis project={project} />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Recommendations */}
        <div>
          <RecommendationsPanel projects={filteredProjects} />
        </div>
      </div>
    </div>
  );
};

export default MasterDashboard;
