import React, { useState, useEffect } from 'react';
import { UserIcon, ShieldCheckIcon, TrashIcon, EnvelopeIcon, PlusCircleIcon } from './icons';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { UserRole } from '../types';

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

interface UserAdministrationPageProps {
  currentUserEmail: string;
  showToast: (message: string) => void;
}

const UserAdministrationPage: React.FC<UserAdministrationPageProps> = ({ 
  currentUserEmail,
  showToast 
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'permissions' | 'invite'>('users');
  
  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'member'>('member');
  const [inviting, setInviting] = useState(false);
  
  // Default permission configurations
  const [permissions, setPermissions] = useState<RolePermissions>({
    admin: { create: true, read: true, update: true, delete: true },
    manager: { create: true, read: true, update: true, delete: false },
    member: { create: false, read: true, update: false, delete: false },
  });

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

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
        setError('Cloud Functions not deployed. Please deploy functions first.');
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
      showToast(`User role updated to ${newRole} successfully!`);
    } catch (err: any) {
      console.error('Error updating role:', err);
      showToast(`Failed to update role: ${err.message}`);
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
      showToast('User deleted successfully!');
    } catch (err: any) {
      console.error('Error deleting user:', err);
      showToast(`Failed to delete user: ${err.message}`);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteEmail.trim()) {
      showToast('Please enter an email address');
      return;
    }

    setInviting(true);
    try {
      const functions = getFunctions();
      const inviteUserFunction = httpsCallable(functions, 'inviteUser');
      await inviteUserFunction({ email: inviteEmail, role: inviteRole });
      
      showToast(`Invitation sent to ${inviteEmail}!`);
      setInviteEmail('');
      setInviteRole('member');
      
      // Refresh user list
      fetchUsers();
    } catch (err: any) {
      console.error('Error inviting user:', err);
      showToast(`Failed to invite user: ${err.message}`);
    } finally {
      setInviting(false);
    }
  };

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
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold text-white flex items-center space-x-3">
          <ShieldCheckIcon className="w-8 h-8 text-brand-secondary" />
          <span>User Administration</span>
        </h2>
        <p className="text-slate-400 mt-2">Manage users, roles, and permissions across your organization.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-700">
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
            onClick={() => setActiveTab('invite')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'invite'
                ? 'border-brand-secondary text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Invite Users
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
      <div>
        {activeTab === 'users' && (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
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
                    <p className="text-slate-300">{error}</p>
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
          </div>
        )}

        {activeTab === 'invite' && (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-brand-secondary/20 rounded-full flex items-center justify-center">
                  <EnvelopeIcon className="w-6 h-6 text-brand-secondary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Invite New User</h3>
                  <p className="text-sm text-slate-400">Send an email invitation to join VantageFlow</p>
                </div>
              </div>

              <form onSubmit={handleInviteUser} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand-secondary transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Initial Role
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                      inviteRole === 'member'
                        ? 'border-brand-secondary bg-brand-secondary/10'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}>
                      <input
                        type="radio"
                        value="member"
                        checked={inviteRole === 'member'}
                        onChange={(e) => setInviteRole(e.target.value as 'manager' | 'member')}
                        className="text-brand-secondary focus:ring-brand-secondary"
                      />
                      <div>
                        <p className="text-white font-medium">Member</p>
                        <p className="text-xs text-slate-400">View-only access</p>
                      </div>
                    </label>
                    <label className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                      inviteRole === 'manager'
                        ? 'border-brand-secondary bg-brand-secondary/10'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}>
                      <input
                        type="radio"
                        value="manager"
                        checked={inviteRole === 'manager'}
                        onChange={(e) => setInviteRole(e.target.value as 'manager' | 'member')}
                        className="text-brand-secondary focus:ring-brand-secondary"
                      />
                      <div>
                        <p className="text-white font-medium">Manager</p>
                        <p className="text-xs text-slate-400">Can create & edit projects</p>
                      </div>
                    </label>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    ⚠️ Admin role can only be assigned from the Users & Roles tab after signup
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={inviting}
                  className="w-full flex items-center justify-center space-x-2 bg-brand-secondary hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Sending Invitation...</span>
                    </>
                  ) : (
                    <>
                      <PlusCircleIcon className="w-5 h-5" />
                      <span>Send Invitation</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-sm text-blue-300">
                  <strong>Note:</strong> The invited user will receive an email with instructions to create their account. 
                  Their role will be automatically assigned upon signup.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'permissions' && (
          <div className="space-y-6">
            <p className="text-slate-400">
              Configure what actions each role can perform on projects. Changes are for reference only and require updating firestore.rules to enforce.
            </p>
            
            {Object.entries(permissions).map(([role, perms]) => {
              const rolePerms = perms as PermissionConfig;
              return (
                <div key={role} className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
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
    </div>
  );
};

export default UserAdministrationPage;
