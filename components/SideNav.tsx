import React from 'react';
import { UserRole } from '../types';
import {
  HomeIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  XMarkIcon,
  UserIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from './icons';

interface SideNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
  userRole: UserRole;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const SideNav: React.FC<SideNavProps> = ({
  isOpen,
  onClose,
  currentPage,
  onNavigate,
  userRole,
  isCollapsed,
  onToggleCollapse
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
        <div className="flex flex-col h-full">
          {/* Mobile Header (drawer close button & branding) */}
          <div className="p-3 border-b border-slate-700/70 flex items-center justify-between lg:hidden">
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
          <div className="hidden lg:flex items-center justify-between px-3 py-2 border-b border-slate-700/60 min-h-[38px]">
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
          <nav className={`flex-grow overflow-y-auto ${isCollapsed ? 'p-1.5' : 'p-2'} space-y-1`}>
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

          {/* Footer */}
          <div className={`px-3 py-2 border-t border-slate-700/60 ${isCollapsed ? 'hidden' : ''}`}>
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
