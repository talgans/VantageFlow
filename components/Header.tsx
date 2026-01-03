
import React from 'react';
import { UserRole } from '../types';
import { UsersIcon, Bars3Icon } from './icons';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  currentUserRole: UserRole;
  onSignOut: () => void;
  onSignInClick: () => void;
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentUserRole, onSignOut, onSignInClick, onMenuClick }) => {
  const { user } = useAuth();

  return (
    <header className="bg-slate-900/70 backdrop-blur-sm sticky top-0 z-10 p-4 border-b border-slate-700 flex justify-between items-center">
      <div className="flex items-center space-x-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-slate-400 hover:text-white transition-colors p-2"
        >
          <Bars3Icon className="w-6 h-6" />
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          VantageFlow
        </h1>
      </div>
      <div className="flex items-center space-x-4">
        {user ? (
          <>
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700">
              <UsersIcon className="w-4 h-4 text-slate-400" />
              <div className="text-sm">
                <p className="text-white font-medium">{user.email}</p>
                <p className="text-slate-400 text-xs">{currentUserRole}</p>
              </div>
            </div>
            <button
              onClick={onSignOut}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
            >
              Sign Out
            </button>
          </>
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
