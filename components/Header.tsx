
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UserRole, Project, TaskStatus } from '../types';
import { UsersIcon, Bars3Icon, UserIcon, ChevronDownIcon } from './icons';
import { useAuth } from '../contexts/AuthContext';
import { useUserLookup } from '../hooks/useUserLookup';
import { usePresence } from '../hooks/usePresence';
import UserAchievementBadge from './UserAchievementBadge';
import OnlineUsersAccordion from './OnlineUsersAccordion';
import NotificationCenter from './NotificationCenter';

interface HeaderProps {
  currentUserRole: UserRole;
  onSignOut: () => void;
  onSignInClick: () => void;
  onMenuClick: () => void;
  onNavigateToProfile?: () => void;
  projects?: Project[];
  selectedProject?: Project | null;
  onSelectTask?: (projectId: string, taskId: string) => void;
}

const Header: React.FC<HeaderProps> = ({
  currentUserRole,
  onSignOut,
  onSignInClick,
  onMenuClick,
  onNavigateToProfile,
  projects = [],
  selectedProject,
  onSelectTask,
}) => {
  const { user } = useAuth();
  const { getUserById } = useUserLookup();
  const { onlineUsers } = usePresence();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get dynamic user info with fallback to formatted email
  const getUserDisplayInfo = () => {
    if (!user) return { name: '', photo: null };

    const cachedUser = getUserById(user.uid, user.email || undefined);
    let name = user.displayName || cachedUser?.displayName;

    // If no name or name looks like email, format the email handle
    if (!name || name.includes('@')) {
      const emailHandle = (user.email || '').split('@')[0];
      name = emailHandle.charAt(0).toUpperCase() + emailHandle.slice(1);
    }

    return { name, photo: user.photoURL || cachedUser?.photoURL };
  };

  const { name: displayName, photo: photoURL } = getUserDisplayInfo();

  // Calculate project stats for the current user
  const userStats = useMemo(() => {
    if (!user) return { total: 0, completed: 0, running: 0 };

    // Get projects where user is owner or member
    const userProjects = projects.filter(p => {
      const isOwner = p.ownerId === user.uid;
      const isMember = p.team?.members?.some(m => m.uid === user.uid);
      return isOwner || isMember;
    });

    // Check completion status
    let completed = 0;
    let running = 0;

    userProjects.forEach(p => {
      const allTasks = p.phases.flatMap(ph => ph.tasks);
      const isComplete = allTasks.length > 0 && allTasks.every(t => t.status === TaskStatus.Hundred || t.status === 'Completed');

      if (isComplete) completed++;
      else running++;
    });

    return { total: userProjects.length, completed, running };
  }, [projects, user]);

  // Helper to check if current user is an owner or member of a project
  const isMemberOfProject = (project: Project, uid?: string, email?: string): boolean => {
    if (!uid && !email) return false;
    const normalizedEmail = email?.toLowerCase();

    // Owner check
    if (uid && project.ownerId === uid) return true;
    if (normalizedEmail && project.ownerEmail && project.ownerEmail.toLowerCase() === normalizedEmail) return true;

    // memberUids array
    if (uid && project.memberUids && project.memberUids.includes(uid)) return true;

    // team.members array
    if (project.team?.members) {
      return project.team.members.some(m =>
        (uid && m.uid === uid) ||
        (normalizedEmail && m.email && m.email.toLowerCase() === normalizedEmail)
      );
    }

    return false;
  };

  // Determine all projects where current user is an owner or member
  const memberProjects = useMemo(() => {
    if (!user) return [];
    return projects.filter(p => isMemberOfProject(p, user.uid, user.email || undefined));
  }, [projects, user]);

  // Scope: if viewing a specific project, verify membership in that project;
  // otherwise, use all projects where the user is a member.
  const activeProjectScope = useMemo(() => {
    if (!user) return { isEligible: false, relevantProjects: [] as Project[] };

    if (selectedProject) {
      const isMember = isMemberOfProject(selectedProject, user.uid, user.email || undefined);
      // Only show for projects user is a member
      if (!isMember) {
        return { isEligible: false, relevantProjects: [] as Project[] };
      }
      return { isEligible: true, relevantProjects: [selectedProject] };
    }

    // On dashboard / global views, only show if user is a member of at least one project
    if (memberProjects.length === 0) {
      return { isEligible: false, relevantProjects: [] as Project[] };
    }

    return { isEligible: true, relevantProjects: memberProjects };
  }, [selectedProject, memberProjects, user]);

  // Collect teammate UIDs and emails from the relevant projects
  const teammateKeys = useMemo(() => {
    const uids = new Set<string>();
    const emails = new Set<string>();

    if (user?.uid) uids.add(user.uid);
    if (user?.email) emails.add(user.email.toLowerCase());

    activeProjectScope.relevantProjects.forEach(p => {
      if (p.ownerId) uids.add(p.ownerId);
      if (p.ownerEmail) emails.add(p.ownerEmail.toLowerCase());
      if (p.memberUids) {
        p.memberUids.forEach(uid => uids.add(uid));
      }
      if (p.team?.members) {
        p.team.members.forEach(m => {
          if (m.uid) uids.add(m.uid);
          if (m.email) emails.add(m.email.toLowerCase());
        });
      }
    });

    return { uids, emails };
  }, [activeProjectScope.relevantProjects, user]);

  // Filter online users: only show users from projects where user is a member
  const scopedOnlineUsers = useMemo(() => {
    if (!activeProjectScope.isEligible || !user) return [];

    return onlineUsers.filter(u => {
      if (u.uid === user.uid) return true;
      if (teammateKeys.uids.has(u.uid)) return true;
      if (u.email && teammateKeys.emails.has(u.email.toLowerCase())) return true;
      return false;
    });
  }, [onlineUsers, user, activeProjectScope.isEligible, teammateKeys]);

  return (
    <header className="flex-shrink-0 bg-slate-900/70 backdrop-blur-sm sticky top-0 z-10 p-4 border-b border-slate-700 flex justify-between items-center gap-4">
      <div className="flex items-center space-x-3 sm:space-x-5 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-slate-400 hover:text-white transition-colors p-2 flex-shrink-0"
        >
          <Bars3Icon className="w-6 h-6" />
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex-shrink-0">
          VantageFlow
        </h1>
        {user && activeProjectScope.isEligible && scopedOnlineUsers.length > 0 && (
          <OnlineUsersAccordion
            users={scopedOnlineUsers}
            currentUserId={user.uid}
            projects={activeProjectScope.relevantProjects}
          />
        )}
      </div>
      <div className="flex items-center space-x-3 sm:space-x-4 flex-shrink-0">
        {user && (
          <NotificationCenter
            projects={projects}
            onSelectTask={onSelectTask}
          />
        )}
        {user ? (
          <div className="relative" ref={dropdownRef}>
            <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors">
              <button
                type="button"
                onClick={() => {
                  onNavigateToProfile?.();
                  setIsUserMenuOpen(false);
                }}
                className="flex items-center space-x-2 pl-3 pr-2 py-1.5 hover:bg-slate-700/70 rounded-l-lg transition-colors cursor-pointer group text-left"
                title="Go to My Profile"
              >
                {photoURL ? (
                  <img src={photoURL} alt="" className="w-8 h-8 rounded-md object-cover group-hover:ring-1 group-hover:ring-brand-secondary transition-all" />
                ) : (
                  <div className="w-8 h-8 rounded-md bg-slate-700 flex items-center justify-center group-hover:bg-slate-600 transition-colors">
                    <UsersIcon className="w-5 h-5 text-slate-400 group-hover:text-white" />
                  </div>
                )}
                <div className="text-sm text-left">
                  <p className="text-white font-medium group-hover:text-brand-light transition-colors">{displayName}</p>
                  <div className="flex items-center gap-1">
                    <p className="text-slate-400 text-xs">{currentUserRole}</p>
                    <span className="text-slate-600">|</span>
                    <UserAchievementBadge userId={user.uid} showPoints={false} />
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="px-2 py-3 hover:bg-slate-700/70 rounded-r-lg border-l border-slate-700/60 transition-colors cursor-pointer text-slate-400 hover:text-white"
                title="Open user menu"
                aria-label="Open user menu"
              >
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-800 rounded-lg border border-slate-700 shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700">
                  <p className="text-xs text-slate-400 uppercase font-semibold mb-1">My Stats</p>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Projects Running:</span>
                    <span className="text-white font-medium">{userStats.running}</span>
                  </div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-300">Projects Completed:</span>
                    <span className="text-green-400 font-medium">{userStats.completed}</span>
                  </div>
                  <div className="pt-1 border-t border-slate-700/50 flex justify-center">
                    <UserAchievementBadge userId={user.uid} showPoints={true} />
                  </div>
                </div>
                <button
                  onClick={() => {
                    onNavigateToProfile?.();
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  <UserIcon className="w-4 h-4" />
                  My Profile
                </button>
                <div className="border-t border-slate-700" />
                <button
                  onClick={() => {
                    onSignOut();
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-slate-700 hover:text-red-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onSignInClick}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-secondary hover:bg-blue-500 rounded-lg transition-colors"
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
