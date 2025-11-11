import React, { useState, useEffect } from 'react';
import { UserIcon, ShieldCheckIcon, XMarkIcon, TrashIcon } from './icons';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface User {
  uid: string;
  email: string;
  displayName?: string;
  role: string;
  createdAt: string;
  lastSignIn?: string;
}

interface PermissionConfig {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

interface RolePermissions {
  [key: string]: PermissionConfig;
}

interface UserAdministrationProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail: string;
}

const UserAdministration: React.FC<UserAdministrationProps> = ({ isOpen, onClose, currentUserEmail }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'permissions'>('users');
  
  // Default permission configurations
  const [permissions, setPermissions] = useState<RolePermissions>({
    admin: { create: true, read: true, update: true, delete: true },
    manager: { create: true, read: true, update: true, delete: false },
    member: { create: false, read: true, update: false, delete: false },
  });

  useEffect(() => {
    if (isOpen && activeTab === 'users') {
      fetchUsers();
    }
  }, [isOpen, activeTab]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const functions = getFunctions();
      const listUsersFunction = httpsCallable(functions, 'listUsers');
      const result = await listUsersFunction();
      const data = result.data as { users: User[] };
      setUsers(data.users);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      if (err.code === 'functions/not-found') {
        setError('Cloud Functions not deployed. Please deploy functions first: cd functions && npm install && npm run deploy');
      } else {
        setError(err.message || 'Failed to load users. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (uid: string, newRole: string) => {
    setUpdatingUserId(uid);
    try {
      const functions = getFunctions();
      const setUserRoleFunction = httpsCallable(functions, 'setUserRole');
      await setUserRoleFunction({ uid, role: newRole });
      
      // Update local state
      setUsers(users.map(u => u.uid === uid ? { ...u, role: newRole } : u));
      
      // Show success message
      alert(`User role updated to ${newRole} successfully!`);
    } catch (err: any) {
      console.error('Error updating role:', err);
      alert(`Failed to update role: ${err.message}`);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeleteUser = async (uid: string, email: string) => {
    if (!confirm(`Are you sure you want to delete user ${email}? This action cannot be undone.`)) {
      return;
    }

    try {
      const functions = getFunctions();
      const deleteUserFunction = httpsCallable(functions, 'deleteUser');
      await deleteUserFunction({ uid });
      
      // Remove from local state
      setUsers(users.filter(u => u.uid !== uid));
      alert('User deleted successfully!');
    } catch (err: any) {
      console.error('Error deleting user:', err);
      alert(`Failed to delete user: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'manager': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  const PermissionToggle: React.FC<{ 
    enabled: boolean; 
    onChange: (enabled: boolean) => void;
    label: string;
  }> = ({ enabled, onChange, label }) => (
    <label className="flex items-center space-x-3 cursor-pointer group">
      <div className="relative">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-11 h-6 rounded-full transition-colors ${
          enabled ? 'bg-brand-secondary' : 'bg-slate-600'
        }`}>
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}></div>
        </div>
      </div>
      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{label}</span>
    </label>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-6xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ShieldCheckIcon className="w-6 h-6 text-brand-secondary" />
            <h2 className="text-2xl font-bold text-white">User Administration</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-700 px-6">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'users'
                  ? 'border-brand-secondary text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Users & Roles
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'permissions'
                  ? 'border-brand-secondary text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Role Permissions
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-grow">
          {activeTab === 'users' ? (
            // Users Tab
            <>
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-secondary mx-auto"></div>
                  <p className="text-slate-400 mt-4">Loading users...</p>
                </div>
              ) : error ? (
                <div className="bg-slate-900/50 border border-yellow-500/30 rounded-lg p-6">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
                      <span className="text-yellow-500 text-xl">⚠</span>
                    </div>
                    <div className="flex-grow">
                      <h3 className="text-lg font-semibold text-white mb-2">Setup Required</h3>
                      <p className="text-slate-300 mb-4">{error}</p>
                      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-2">
                        <p className="text-slate-200 font-semibold">To deploy Cloud Functions:</p>
                        <code className="block text-sm text-brand-light bg-slate-900 p-3 rounded">
                          cd functions<br/>
                          npm install<br/>
                          npm run deploy
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {users.length === 0 ? (
                    <p className="text-center text-slate-400 py-12">No users found</p>
                  ) : (
                    users.map(user => (
                      <div
                        key={user.uid}
                        className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 hover:bg-slate-900 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 flex-grow">
                            <div className="w-12 h-12 bg-brand-secondary/20 rounded-full flex items-center justify-center flex-shrink-0">
                              <UserIcon className="w-6 h-6 text-brand-secondary" />
                            </div>
                            <div className="flex-grow min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <p className="text-white font-medium truncate">{user.email}</p>
                                {user.email === currentUserEmail && (
                                  <span className="text-xs bg-brand-secondary/20 text-brand-light px-2 py-0.5 rounded">You</span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400">
                                Joined {new Date(user.createdAt).toLocaleDateString()}
                                {user.lastSignIn && ` • Last sign in ${new Date(user.lastSignIn).toLocaleDateString()}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3 ml-4">
                            <select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user.uid, e.target.value)}
                              disabled={updatingUserId === user.uid || user.email === currentUserEmail}
                              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                                getRoleBadgeColor(user.role)
                              } bg-slate-800 cursor-pointer hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              <option value="admin">Admin</option>
                              <option value="manager">Manager</option>
                              <option value="member">Member</option>
                            </select>
                            {user.email !== currentUserEmail && (
                              <button
                                onClick={() => handleDeleteUser(user.uid, user.email)}
                                className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-800 transition-colors"
                                title="Delete user"
                              >
                                <TrashIcon className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          ) : (
            // Permissions Tab
            <div className="space-y-6">
              <p className="text-slate-400 mb-6">
                Configure what actions each role can perform on projects. Changes are applied immediately.
              </p>
              
              {Object.entries(permissions).map(([role, perms]) => {
                const rolePerms = perms as PermissionConfig;
                return (
                <div key={role} className="bg-slate-900/50 border border-slate-700 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className={`px-3 py-1 rounded-lg text-sm font-semibold border ${getRoleBadgeColor(role)}`}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </span>
                      <span className="text-slate-400 text-sm">
                        {role === 'admin' && 'Full system access'}
                        {role === 'manager' && 'Can create and manage projects'}
                        {role === 'member' && 'View-only access'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <PermissionToggle
                      enabled={rolePerms.create}
                      onChange={(val) => setPermissions({
                        ...permissions,
                        [role]: { ...rolePerms, create: val }
                      })}
                      label="Create Projects"
                    />
                    <PermissionToggle
                      enabled={rolePerms.read}
                      onChange={(val) => setPermissions({
                        ...permissions,
                        [role]: { ...rolePerms, read: val }
                      })}
                      label="View Projects"
                    />
                    <PermissionToggle
                      enabled={rolePerms.update}
                      onChange={(val) => setPermissions({
                        ...permissions,
                        [role]: { ...rolePerms, update: val }
                      })}
                      label="Update Projects"
                    />
                    <PermissionToggle
                      enabled={rolePerms.delete}
                      onChange={(val) => setPermissions({
                        ...permissions,
                        [role]: { ...rolePerms, delete: val }
                      })}
                      label="Delete Projects"
                    />
                  </div>

                  {role === 'admin' && (
                    <p className="text-xs text-slate-500 mt-4">
                      * Admin permissions cannot be restricted
                    </p>
                  )}
                </div>
                );
              })}

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-sm text-blue-300">
                  <strong>Note:</strong> Permission changes here are for display reference only. 
                  Actual enforcement requires updating Firestore security rules in <code className="bg-slate-900 px-2 py-0.5 rounded">firestore.rules</code>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-700 flex justify-between items-center">
          <p className="text-sm text-slate-400">
            {activeTab === 'users' && !loading && !error && `${users.length} user${users.length !== 1 ? 's' : ''} total`}
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserAdministration;
