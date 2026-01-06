import React from 'react';
import { UserRole } from '../types';
import {
  HomeIcon,
  ShieldCheckIcon,
  UsersIcon,
  ChartBarIcon,
  XMarkIcon,
  UserIcon
} from './icons';

interface SideNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
  userRole: UserRole;
}

const SideNav: React.FC<SideNavProps> = ({
  isOpen,
  onClose,
  currentPage,
  onNavigate,
  userRole
}) => {
  const isAdmin = userRole === UserRole.Admin;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: HomeIcon, adminOnly: false },
    { id: 'projects', label: 'Projects', icon: ChartBarIcon, adminOnly: false },
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
        className={`fixed top-0 left-0 h-full w-64 bg-slate-800 border-r border-slate-700 z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0 lg:static`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-brand-secondary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">VF</span>
              </div>
              <span className="text-white font-semibold">VantageFlow</span>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden text-slate-400 hover:text-white transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-grow p-4 space-y-2">
            {navItems.map(item => {
              if (item.adminOnly && !isAdmin) return null;

              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive
                    ? 'bg-brand-secondary text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-slate-700">
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
