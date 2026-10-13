import React, { useMemo } from 'react';
import { UserRole, Project, Task, TaskStatus } from '../types';
import {
  HomeIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  XMarkIcon,
  UserIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SparklesIcon,
  FlagIcon,
} from './icons';

interface SideNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
  userRole: UserRole;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  projects?: Project[];
  currentUserId?: string;
  onSelectTask?: (projectId: string, taskId: string) => void;
}

interface RecentFollowUpItem {
  taskId: string;
  taskName: string;
  projectId: string;
  projectName: string;
  phaseName: string;
  status: TaskStatus;
  hasBlocker: boolean;
  blockerDescription?: string;
  timestamp: Date;
  isAssignedToUser: boolean;
}

const formatRelativeTime = (dateInput?: Date | string | null): string => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getStatusBadgeStyle = (status: TaskStatus, hasBlocker: boolean) => {
  if (hasBlocker) {
    return 'bg-red-500/20 text-red-300 border-red-500/40';
  }
  switch (status) {
    case TaskStatus.Hundred:
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case TaskStatus.SeventyFive:
      return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case TaskStatus.Fifty:
      return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    case TaskStatus.TwentyFive:
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case TaskStatus.AtRisk:
      return 'bg-red-500/20 text-red-300 border-red-500/30';
    case TaskStatus.Zero:
    default:
      return 'bg-slate-700/60 text-slate-400 border-slate-600/40';
  }
};

const SideNav: React.FC<SideNavProps> = ({
  isOpen,
  onClose,
  currentPage,
  onNavigate,
  userRole,
  isCollapsed,
  onToggleCollapse,
  projects,
  currentUserId,
  onSelectTask,
}) => {
  const isAdmin = userRole === UserRole.Admin || userRole === UserRole.SuperAdmin;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: HomeIcon, adminOnly: false },
    { id: 'projects', label: 'Projects', icon: ChartBarIcon, adminOnly: false },
    { id: 'performance', label: 'Performance', icon: UserIcon, adminOnly: false },
    { id: 'users', label: 'User Administration', icon: ShieldCheckIcon, adminOnly: true },
  ];

  const handleNavClick = (pageId: string) => {
    onNavigate(pageId);
    onClose();
  };

  // Extract recent / actionable tasks across active projects
  const recentFollowUps = useMemo<RecentFollowUpItem[]>(() => {
    if (!projects || projects.length === 0) return [];
    const items: RecentFollowUpItem[] = [];

    const activeProjects = projects.filter(p => !p.isDeleted && !p.isArchived);

    activeProjects.forEach(project => {
      (project.phases || []).forEach(phase => {
        const walkTasks = (tasks: Task[]) => {
          tasks.forEach(task => {
            const hasBlocker = Boolean(task.impediment && !task.impediment.resolved);
            const isAssigned = Boolean(
              currentUserId &&
              task.assignees?.some(a => a.uid === currentUserId)
            );

            // Determine best activity timestamp
            let activityTime = task.statusUpdatedAt || task.updatedAt || task.completedAt;
            if (!activityTime && task.feedbackNotes && task.feedbackNotes.length > 0) {
              const lastNote = task.feedbackNotes[task.feedbackNotes.length - 1];
              activityTime = new Date(lastNote.createdAt);
            }
            if (!activityTime && task.impediment?.reportedAt) {
              activityTime = new Date(task.impediment.reportedAt);
            }
            if (!activityTime) {
              activityTime = task.startDate ? new Date(task.startDate) : new Date(0);
            }

            items.push({
              taskId: task.id,
              taskName: task.name,
              projectId: project.id,
              projectName: project.name,
              phaseName: phase.name,
              status: task.status,
              hasBlocker,
              blockerDescription: task.impediment?.description,
              timestamp: activityTime instanceof Date ? activityTime : new Date(activityTime),
              isAssignedToUser: isAssigned,
            });

            if (task.subTasks && task.subTasks.length > 0) {
              walkTasks(task.subTasks);
            }
          });
        };

        walkTasks(phase.tasks || []);
      });
    });

    // Prioritize blockers first, then latest timestamp
    items.sort((a, b) => {
      if (a.hasBlocker && !b.hasBlocker) return -1;
      if (!a.hasBlocker && b.hasBlocker) return 1;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    return items.slice(0, 4);
  }, [projects, currentUserId]);

  const handleTaskClick = (projectId: string, taskId: string) => {
    if (onSelectTask) {
      onSelectTask(projectId, taskId);
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Side Navigation */}
      <aside
        className={`fixed top-0 left-0 h-full ${
          isCollapsed ? 'w-14' : 'w-56'
        } bg-slate-800/95 backdrop-blur-sm border-r border-slate-700/70 z-50 transform transition-all duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:h-full flex-shrink-0 flex flex-col`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Mobile Header (drawer close button & branding) */}
          <div className="p-3 border-b border-slate-700/70 flex items-center justify-between lg:hidden flex-shrink-0">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 bg-brand-secondary rounded-md flex items-center justify-center flex-shrink-0 shadow-sm shadow-brand-secondary/30">
                <span className="text-white font-bold text-xs">VF</span>
              </div>
              <span className="text-white font-semibold text-sm">VantageFlow</span>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-700/50"
              title="Close menu"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Desktop Sub-Header / Collapse Bar */}
          <div className="hidden lg:flex items-center justify-between px-3 py-2 border-b border-slate-700/60 min-h-[38px] flex-shrink-0">
            {!isCollapsed ? (
              <>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Menu
                </span>
                <button
                  onClick={onToggleCollapse}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
                  title="Collapse sidebar"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={onToggleCollapse}
                className="w-full flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
                title="Expand sidebar"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Navigation Items */}
          <nav className={`flex-shrink-0 ${isCollapsed ? 'p-1.5' : 'p-2'} space-y-1`}>
            {navItems.map(item => {
              if (item.adminOnly && !isAdmin) return null;

              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center ${
                    isCollapsed ? 'justify-center p-2' : 'space-x-2.5 px-3 py-2'
                  } rounded-lg text-sm transition-all duration-150 relative group ${
                    isActive
                      ? 'bg-brand-secondary text-white font-medium shadow-sm shadow-brand-secondary/25'
                      : 'text-slate-300 hover:bg-slate-700/60 hover:text-white font-normal'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="text-sm font-medium whitespace-nowrap text-left flex-1">
                      {item.label}
                    </span>
                  )}
                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-900 border border-slate-700 text-slate-200 text-xs font-medium rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 pointer-events-none">
                      {item.label}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Heads-Up & Follow-ups Panel (Below Menu) */}
          <div className="flex-1 min-h-0 flex flex-col border-t border-slate-700/60 overflow-hidden">
            {!isCollapsed ? (
              <div className="flex flex-col h-full p-2 overflow-hidden">
                <div className="flex items-center justify-between px-1.5 py-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-secondary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-secondary"></span>
                    </span>
                    <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                      Heads-Up
                    </span>
                  </div>
                  {recentFollowUps.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-700 text-slate-300 font-medium">
                      {recentFollowUps.length}
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar">
                  {recentFollowUps.length === 0 ? (
                    <div className="p-2 text-center text-xs text-slate-500 italic">
                      No recent task activity
                    </div>
                  ) : (
                    recentFollowUps.map(item => {
                      const badgeStyle = getStatusBadgeStyle(item.status, item.hasBlocker);
                      const timeStr = formatRelativeTime(item.timestamp);

                      return (
                        <div
                          key={`${item.projectId}-${item.taskId}`}
                          onClick={() => handleTaskClick(item.projectId, item.taskId)}
                          className="group p-2 rounded-lg bg-slate-900/60 hover:bg-slate-700/60 border border-slate-700/50 hover:border-slate-600 transition-all cursor-pointer text-left shadow-xs"
                          title={`Click to open ${item.taskName} in ${item.projectName}`}
                        >
                          <div className="flex items-start justify-between gap-1.5 mb-1">
                            <span className="text-xs font-medium text-slate-200 group-hover:text-white line-clamp-1 leading-snug">
                              {item.taskName}
                            </span>
                            {item.hasBlocker ? (
                              <span className="flex-shrink-0 text-red-400" title="Active Blocker">
                                <FlagIcon className="w-3.5 h-3.5 fill-red-400" />
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="truncate max-w-[90px]" title={item.projectName}>
                              {item.projectName}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border flex-shrink-0 ${badgeStyle}`}>
                              {item.hasBlocker ? 'Blocked' : item.status}
                            </span>
                          </div>

                          {timeStr && (
                            <div className="text-[9px] text-slate-500 mt-1 flex items-center justify-between">
                              <span className="truncate">{item.phaseName}</span>
                              <span className="flex-shrink-0 text-slate-400 font-mono">{timeStr}</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* Collapsed view indicator with popover */
              <div className="p-1.5 flex flex-col items-center group relative">
                <button
                  className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-brand-light hover:bg-slate-700/60 transition-colors relative"
                  title="Heads-Up & Recent Tasks"
                >
                  <SparklesIcon className="w-5 h-5" />
                  {recentFollowUps.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-secondary animate-pulse" />
                  )}
                </button>
                {/* Popover on hover in collapsed mode */}
                <div className="absolute left-full top-0 ml-2 w-60 p-2.5 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 pointer-events-auto">
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span>⚡ Heads-Up & Follow-ups</span>
                  </div>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {recentFollowUps.length === 0 ? (
                      <div className="text-slate-500 italic text-[11px]">No recent activity</div>
                    ) : (
                      recentFollowUps.map(item => (
                        <div
                          key={`${item.projectId}-${item.taskId}`}
                          onClick={() => handleTaskClick(item.projectId, item.taskId)}
                          className="p-1.5 rounded-md hover:bg-slate-800 cursor-pointer border border-transparent hover:border-slate-700 transition-colors"
                        >
                          <div className="font-medium text-white truncate text-[11px]">{item.taskName}</div>
                          <div className="flex justify-between items-center text-[10px] text-slate-400 mt-0.5">
                            <span className="truncate max-w-[100px]">{item.projectName}</span>
                            <span className="font-semibold text-brand-light">{item.hasBlocker ? 'Blocked' : item.status}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={`px-3 py-2 border-t border-slate-700/60 flex-shrink-0 ${isCollapsed ? 'hidden' : ''}`}>
            <div className="text-[11px] text-slate-400 text-center tracking-tight">
              VantageFlow v1.0
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default SideNav;
