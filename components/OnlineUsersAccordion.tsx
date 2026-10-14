import React, { useState, useMemo, useEffect } from 'react';
import { UserPresence, Project } from '../types';

interface OnlineUsersAccordionProps {
  users: UserPresence[];
  currentUserId?: string;
  projects?: Project[];
  maxVisible?: number;
}

export const OnlineUsersAccordion: React.FC<OnlineUsersAccordionProps> = ({
  users = [],
  currentUserId,
  projects = [],
  maxVisible = 6,
}) => {
  // Sort users: current user first, then by displayName
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (a.uid === currentUserId) return -1;
      if (b.uid === currentUserId) return 1;
      const nameA = a.displayName || a.email || '';
      const nameB = b.displayName || b.email || '';
      return nameA.localeCompare(nameB);
    });
  }, [users, currentUserId]);

  // Active user ID (defaults to current user or first user)
  const [activeUid, setActiveUid] = useState<string | null>(null);

  useEffect(() => {
    if (sortedUsers.length > 0) {
      if (!activeUid || !sortedUsers.some((u) => u.uid === activeUid)) {
        setActiveUid(sortedUsers[0].uid);
      }
    } else {
      setActiveUid(null);
    }
  }, [sortedUsers, activeUid]);

  // If no users are online, return null
  if (sortedUsers.length === 0) {
    return null;
  }

  const activeUser = sortedUsers.find((u) => u.uid === activeUid) || sortedUsers[0];
  const otherUsers = sortedUsers.filter((u) => u.uid !== activeUser.uid);
  const visibleOthers = otherUsers.slice(0, maxVisible - 1);
  const overflowCount = Math.max(0, otherUsers.length - (maxVisible - 1));

  // Helper to get formatted name
  const getUserName = (u: UserPresence) => {
    if (u.displayName && !u.displayName.includes('@')) {
      return u.displayName;
    }
    const handle = (u.email || 'User').split('@')[0];
    return handle.charAt(0).toUpperCase() + handle.slice(1);
  };

  // Helper to get user initials
  const getInitials = (u: UserPresence) => {
    const name = getUserName(u);
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Helper for role badge styling & icon
  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'SuperAdmin':
        return {
          bg: 'bg-purple-600 text-white',
          label: 'Super Admin',
          icon: '👑',
        };
      case 'Admin':
        return {
          bg: 'bg-rose-500 text-white',
          label: 'Admin',
          icon: '⚡',
        };
      case 'Project Manager':
        return {
          bg: 'bg-amber-500 text-white',
          label: 'Project Manager',
          icon: '📊',
        };
      default:
        return {
          bg: 'bg-emerald-500 text-white',
          label: role || 'Member',
          icon: '🌱',
        };
    }
  };

  // Resolve current project context for active user
  const getActiveUserActivity = (u: UserPresence) => {
    if (u.currentProjectId) {
      const p = projects.find((proj) => proj.id === u.currentProjectId);
      if (p) {
        return `Working on ${p.name}`;
      }
    }
    const role = u.role || 'Member';
    return `Active in VantageFlow workspace • ${role}`;
  };

  const activeRoleBadge = getRoleBadge(activeUser.role);
  const activeName = getUserName(activeUser);
  const activeInitials = getInitials(activeUser);
  const activeActivity = getActiveUserActivity(activeUser);

  return (
    <div className="relative flex items-center select-none">
      {/* Desktop Horizontal Accordion Layout */}
      <div className="hidden sm:flex items-center">
        {/* Numbers Online Pellet (Big enough for all characters to fit, merged with accordion style) */}
        <div
          className="relative flex-shrink-0 flex items-center gap-1.5 pl-3 pr-4 h-8 rounded-l-full bg-slate-800 ring-2 ring-white shadow-md -mr-2.5 z-0 cursor-default"
          title={`${sortedUsers.length} online member${sortedUsers.length === 1 ? '' : 's'}`}
        >
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-bold text-emerald-400 leading-none">{sortedUsers.length}</span>
          <span className="text-[11px] font-semibold text-slate-200 tracking-tight leading-none">Online</span>
        </div>

        {/* Expanded Active User Card (Reduced by 30%) */}
        <div
          className="flex items-center bg-white text-slate-800 rounded-full shadow-md border border-white/90 py-0.5 pl-1 pr-3 transition-all duration-300 ease-out z-10 hover:shadow-lg"
          title={`${activeName} (${activeUser.role || 'Member'})`}
        >
          {/* Avatar with Badge */}
          <div className="relative flex-shrink-0">
            {activeUser.photoURL ? (
              <img
                src={activeUser.photoURL}
                alt={activeName}
                className="w-7 h-7 rounded-full object-cover ring-1.5 ring-white shadow-xs"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-slate-800 to-indigo-700 text-white font-bold flex items-center justify-center text-[10px] shadow-xs ring-1.5 ring-white">
                {activeInitials}
              </div>
            )}
            {/* Overlapping Badge at bottom right */}
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] shadow border border-white ${activeRoleBadge.bg}`}
              title={activeRoleBadge.label}
            >
              <span>{activeRoleBadge.icon}</span>
            </div>
          </div>

          {/* User Details Block */}
          <div className="ml-2 text-left min-w-[80px] max-w-[125px] lg:max-w-[160px]">
            <div className="flex items-center gap-1 leading-tight">
              <span className="font-bold text-slate-900 text-[11px] truncate">
                {activeName}
              </span>
              {activeUser.uid === currentUserId ? (
                <span className="text-[8px] font-bold uppercase px-1 py-0 bg-emerald-100 text-emerald-800 rounded-full">
                  You
                </span>
              ) : (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
              )}
            </div>

            <p className="text-[9px] font-semibold text-slate-500 truncate leading-none mt-0.5">
              {activeUser.role || 'Member'} at VantageFlow
            </p>

            <p className="text-[8.5px] text-slate-600 truncate leading-tight mt-0.5" title={activeActivity}>
              {activeActivity}
            </p>
          </div>
        </div>

        {/* Collapsed Overlapping Circular Avatars */}
        {visibleOthers.length > 0 && (
          <div className="flex items-center -space-x-2 pl-0.5 z-0">
            {visibleOthers.map((u) => {
              const uName = getUserName(u);
              const uInitials = getInitials(u);
              const uBadge = getRoleBadge(u.role);

              return (
                <button
                  key={u.uid}
                  type="button"
                  onClick={() => setActiveUid(u.uid)}
                  onMouseEnter={() => setActiveUid(u.uid)}
                  className="group relative flex-shrink-0 transition-all duration-200 hover:scale-110 hover:z-30 cursor-pointer focus:outline-none"
                  title={`${uName} (${u.role || 'Member'}) - Click to view`}
                  aria-label={`View online status for ${uName}`}
                >
                  {u.photoURL ? (
                    <img
                      src={u.photoURL}
                      alt={uName}
                      className="w-7 h-7 rounded-full object-cover ring-2 ring-white shadow-sm group-hover:ring-brand-light transition-all"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-slate-700 to-slate-800 text-white font-semibold flex items-center justify-center text-[10px] shadow-sm ring-2 ring-white group-hover:ring-brand-light transition-all">
                      {uInitials}
                    </div>
                  )}

                  {/* Role Badge on collapsed avatar */}
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] shadow border border-white ${uBadge.bg}`}
                    title={uBadge.label}
                  >
                    <span>{uBadge.icon}</span>
                  </div>
                </button>
              );
            })}

            {/* Overflow Counter if more than max visible */}
            {overflowCount > 0 && (
              <div
                className="w-6 h-6 rounded-full bg-slate-800 ring-2 ring-white text-emerald-400 font-bold text-[9px] flex items-center justify-center shadow-sm z-10"
                title={`${overflowCount} more online`}
              >
                +{overflowCount}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile-Friendly Compact View (< 640px) */}
      <div className="flex sm:hidden items-center bg-slate-800/80 rounded-full border border-slate-700/80 p-0.5 pr-2 space-x-1.5">
        <div className="relative flex-shrink-0">
          {activeUser.photoURL ? (
            <img
              src={activeUser.photoURL}
              alt={activeName}
              className="w-6 h-6 rounded-full object-cover ring-1 ring-white"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-slate-700 text-white font-bold flex items-center justify-center text-[9px] ring-1 ring-white">
              {activeInitials}
            </div>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-slate-900" />
        </div>
        <div className="text-[10px] font-medium text-slate-200 flex items-center gap-1">
          <span className="text-emerald-400 font-semibold">{sortedUsers.length}</span>
          <span className="text-slate-400">online</span>
        </div>
      </div>
    </div>
  );
};

export default OnlineUsersAccordion;
