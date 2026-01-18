import React from 'react';
import { UserRole } from '../types';
import {
  HomeIcon,
  ShieldCheckIcon,
  UsersIcon,
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
  const isAdmin = userRole === UserRole.Admin;

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
        className={`fixed top-0 left-0 h-full ${isCollapsed ? 'w-16' : 'w-64'} bg-slate-800 border-r border-slate-700 z-50 transform transition-all duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0 lg:static`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className={`p-4 border-b border-slate-700 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
            <div className={`flex items-center ${isCollapsed ? '' : 'space-x-2'}`}>
              <div className="w-8 h-8 bg-brand-secondary rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">VF</span>
              </div>
              {!isCollapsed && <span className="text-white font-semibold">VantageFlow</span>}
            </div>
            {/* Mobile close button */}
            <button
              onClick={onClose}
              className="lg:hidden text-slate-400 hover:text-white transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className={`flex-grow ${isCollapsed ? 'p-2' : 'p-4'} space-y-2`}>
            {navItems.map(item => {
              if (item.adminOnly && !isAdmin) return null;

              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-3 px-4'} py-3 rounded-lg transition-colors relative group ${isActive
                      ? 'bg-brand-secondary text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && <span className="font-medium">{item.label}</span>}
                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-slate-700 text-white text-sm rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                      {item.label}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Collapse Toggle Button (Desktop only) */}
          <div className="hidden lg:block p-2 border-t border-slate-700">
            <button
              onClick={onToggleCollapse}
              className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <ChevronRightIcon className="w-5 h-5" />
              ) : (
                <ChevronLeftIcon className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Footer */}
          <div className={`p-4 border-t border-slate-700 ${isCollapsed ? 'hidden' : ''}`}>
            <div className="text-xs text-slate-400 text-center">
              VantageFlow v1.0
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default SideNav;
