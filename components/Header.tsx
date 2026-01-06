
import React, { useState, useRef, useEffect } from 'react';
import { UserRole } from '../types';
import { UsersIcon, Bars3Icon, UserIcon, ChevronDownIcon } from './icons';
import { useAuth } from '../contexts/AuthContext';
import { useUserLookup } from '../hooks/useUserLookup';

interface HeaderProps {
  currentUserRole: UserRole;
  onSignOut: () => void;
  onSignInClick: () => void;
  onMenuClick: () => void;
  onNavigateToProfile?: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentUserRole, onSignOut, onSignInClick, onMenuClick, onNavigateToProfile }) => {
  const { user } = useAuth();
  const { getUserById } = useUserLookup();
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
    let name = cachedUser?.displayName || user.displayName;

    // If no name or name looks like email, format the email handle
    if (!name || name.includes('@')) {
      const emailHandle = (user.email || '').split('@')[0];
      name = emailHandle.charAt(0).toUpperCase() + emailHandle.slice(1);
    }

    return { name, photo: cachedUser?.photoURL || user.photoURL };
  };

  const { name: displayName, photo: photoURL } = getUserDisplayInfo();

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
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              {photoURL ? (
                <img src={photoURL} alt="" className="w-7 h-7 rounded-full" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center">
                  <UsersIcon className="w-4 h-4 text-slate-400" />
                </div>
              )}
              <div className="text-sm text-left">
                <p className="text-white font-medium">{displayName}</p>
                <p className="text-slate-400 text-xs">{currentUserRole}</p>
              </div>
              <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-lg border border-slate-700 shadow-xl z-50 overflow-hidden">
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
