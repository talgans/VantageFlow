import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UserPresence } from '../types';
import { UsersIcon, UserIcon, XMarkIcon, MagnifyingGlassIcon } from './icons';

interface OnlineUsersPanelProps {
  users: UserPresence[];
  currentUserId?: string;
  title?: string;
  alignPopover?: 'left' | 'right';
  maxAvatars?: number;
  currentProjectId?: string;
  compact?: boolean;
}

const OnlineUsersPanel: React.FC<OnlineUsersPanelProps> = ({
  users,
  currentUserId,
  title = 'Online Now',
  alignPopover = 'right',
  maxAvatars = 3,
  currentProjectId,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Sort: current user first, then alphabetical by displayName
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (a.uid === currentUserId) return -1;
      if (b.uid === currentUserId) return 1;
      return (a.displayName || a.email).localeCompare(b.displayName || b.email);
    });
  }, [users, currentUserId]);

  const visibleAvatars = sortedUsers.slice(0, maxAvatars);
  const overflowCount = Math.max(0, sortedUsers.length - maxAvatars);

  // Filtered users for popover search
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return sortedUsers;
    const q = searchQuery.toLowerCase();
    return sortedUsers.filter(
      (u) =>
        u.displayName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
    );
  }, [sortedUsers, searchQuery]);

  const getRoleBadgeClass = (role?: string) => {
    switch (role) {
      case 'SuperAdmin':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'Admin':
        return 'bg-pink-500/20 text-pink-300 border-pink-500/30';
      case 'Project Manager':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default:
        return 'bg-slate-700/60 text-slate-300 border-slate-600/40';
    }
  };

  return (
    <div className="relative inline-block" ref={panelRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={`${sortedUsers.length} online member${sortedUsers.length === 1 ? '' : 's'}`}
        className={`group flex items-center space-x-2 py-1 px-2.5 sm:px-3 rounded-full transition-all duration-200 border cursor-pointer ${
          isOpen
            ? 'bg-slate-800 border-emerald-500/50 ring-2 ring-emerald-500/20 shadow-lg shadow-emerald-500/10'
            : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 hover:border-emerald-500/40'
        }`}
      >
        {/* Pulsing live dot */}
        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>

        {/* Avatar Stack */}
        {sortedUsers.length > 0 ? (
          <div className="flex items-center -space-x-2 overflow-hidden py-0.5">
            {visibleAvatars.map((u) => (
              <div
                key={u.uid}
                className="relative inline-block rounded-full ring-2 ring-slate-900 group-hover:scale-105 transition-transform"
              >
                {u.photoURL ? (
                  <img
                    src={u.photoURL}
                    alt={u.displayName || 'User'}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-[10px] font-semibold text-white">
                    {(u.displayName || u.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            ))}

            {overflowCount > 0 && (
              <div className="w-6 h-6 rounded-full bg-slate-700 ring-2 ring-slate-900 flex items-center justify-center text-[10px] font-semibold text-emerald-300">
                +{overflowCount}
              </div>
            )}
          </div>
        ) : (
          <UsersIcon className="w-4 h-4 text-slate-400" />
        )}

        {/* Count Pill / Label */}
        {!compact && (
          <div className="flex items-center space-x-1 pl-0.5">
            <span className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors">
              {sortedUsers.length}
            </span>
            <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
              online
            </span>
          </div>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className={`absolute ${
            alignPopover === 'left' ? 'left-0' : 'right-0'
          } mt-2 w-72 sm:w-80 bg-slate-800/95 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-2xl z-50 overflow-hidden transform transition-all duration-150 animate-in fade-in zoom-in-95`}
        >
          {/* Popover Header */}
          <div className="p-3.5 border-b border-slate-700/70 flex items-center justify-between bg-slate-900/40">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <h4 className="text-sm font-semibold text-white tracking-wide">
                {title}
              </h4>
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {sortedUsers.length}
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/60 transition-colors"
              title="Close"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Search filter if more than 4 users */}
          {sortedUsers.length > 4 && (
            <div className="p-2 border-b border-slate-700/50 bg-slate-900/20">
              <div className="relative">
                <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Filter online members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900/60 text-xs text-white placeholder-slate-500 pl-8 pr-3 py-1.5 rounded-lg border border-slate-700/60 focus:outline-none focus:border-emerald-500/60 transition-colors"
                />
              </div>
            </div>
          )}

          {/* User List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-700/40 p-1">
            {filteredUsers.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                {sortedUsers.length === 0
                  ? 'No members currently online'
                  : 'No matching online members'}
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isCurrent = u.uid === currentUserId;
                const isViewingCurrentProject =
                  currentProjectId && u.currentProjectId === currentProjectId;

                return (
                  <div
                    key={u.uid}
                    className="p-2 rounded-xl flex items-center space-x-3 hover:bg-slate-700/40 transition-colors"
                  >
                    {/* User Avatar with Green Indicator */}
                    <div className="relative flex-shrink-0">
                      {u.photoURL ? (
                        <img
                          src={u.photoURL}
                          alt={u.displayName}
                          className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-700"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-xs font-semibold text-white ring-1 ring-slate-700">
                          {(u.displayName || u.email || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-slate-800"></span>
                    </div>

                    {/* User Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-medium text-white truncate">
                          {u.displayName || u.email}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.2 text-[9px] font-semibold bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                            You
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 mt-0.5">
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded border font-medium truncate ${getRoleBadgeClass(
                            u.role
                          )}`}
                        >
                          {u.role || 'Member'}
                        </span>

                        {isViewingCurrentProject ? (
                          <span className="text-[10px] text-emerald-400 font-medium flex items-center space-x-0.5">
                            <span>In this project</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-3.5 py-2 bg-slate-900/60 border-t border-slate-700/70 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Presence auto-refreshes</span>
            <span className="text-emerald-400 font-medium">Live</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnlineUsersPanel;
