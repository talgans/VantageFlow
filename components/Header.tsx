
import React from 'react';
import { UserRole } from '../types';
import { UsersIcon } from './icons';

interface HeaderProps {
  currentUserRole: UserRole;
  setCurrentUserRole: (role: UserRole) => void;
}

const Header: React.FC<HeaderProps> = ({ currentUserRole, setCurrentUserRole }) => {
  return (
    <header className="bg-slate-900/70 backdrop-blur-sm sticky top-0 z-10 p-4 border-b border-slate-700 flex justify-between items-center">
      <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
        KPI Dashboard
      </h1>
      <div className="flex items-center space-x-2">
        <UsersIcon className="w-5 h-5 text-slate-400" />
        <select
          value={currentUserRole}
          onChange={(e) => setCurrentUserRole(e.target.value as UserRole)}
          className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
        >
          {Object.values(UserRole).map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
};

export default Header;
