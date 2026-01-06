import React, { useState, useEffect, useRef } from 'react';
import { UserIcon, ShieldCheckIcon, TrashIcon, EnvelopeIcon, PlusCircleIcon, XMarkIcon, PencilIcon, CheckIcon, CameraIcon } from './icons';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../services/firebaseConfig';
import { UserRole } from '../types';
import {
  getPermissions,
  savePermissions,
  addRole,
  deleteRole,
  permissionsEqual,
  getDefaultPermissions,
  RolePermissions,
  PermissionConfig
} from '../services/permissionsService';
import { uploadProfilePhoto } from '../services/storageService';

interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: string;
  createdAt: string;
  lastSignIn?: string;
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
  const [inviteRole, setInviteRole] = useState<string>('member');
  const [inviting, setInviting] = useState(false);

  // Permission configurations
  const [permissions, setPermissions] = useState<RolePermissions>(getDefaultPermissions());
  const [originalPermissions, setOriginalPermissions] = useState<RolePermissions>(getDefaultPermissions());
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Add Role Modal state
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');

  // Edit User Profile Modal state
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPhotoURL, setEditPhotoURL] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'permissions') {
      fetchPermissions();
    }
  }, [activeTab]);

  // Track changes to permissions
  useEffect(() => {
    setHasChanges(!permissionsEqual(permissions, originalPermissions));
  }, [permissions, originalPermissions]);

  const fetchPermissions = async () => {
    setPermissionsLoading(true);
    try {
      const loadedPermissions = await getPermissions();
      setPermissions(loadedPermissions);
      setOriginalPermissions(loadedPermissions);
    } catch (err: any) {
      console.error('Error fetching permissions:', err);
      showToast('Failed to load permissions');
    } finally {
      setPermissionsLoading(false);
    }
  };

  const handleSavePermissions = async () => {
    setSavingPermissions(true);
    try {
      await savePermissions(permissions, currentUserEmail);
      setOriginalPermissions(permissions);
      showToast('Permissions saved successfully!');
    } catch (err: any) {
      console.error('Error saving permissions:', err);
      showToast(`Failed to save permissions: ${err.message}`);
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleAddRole = () => {
    try {
      const updatedPermissions = addRole(permissions, newRoleName, newRoleDescription);
      setPermissions(updatedPermissions);
      setShowAddRoleModal(false);
      setNewRoleName('');
      setNewRoleDescription('');
      showToast(`Role "${newRoleName}" added. Don't forget to save!`);
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleDeleteRole = (roleName: string) => {
    if (!confirm(`Are you sure you want to delete the "${roleName}" role? This cannot be undone.`)) {
      return;
    }
    try {
      const updatedPermissions = deleteRole(permissions, roleName);
      setPermissions(updatedPermissions);
      showToast(`Role "${roleName}" removed. Don't forget to save!`);
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const functions = getFunctions(app, 'us-central1');
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
      const functions = getFunctions(app, 'us-central1');
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
      const functions = getFunctions(app, 'us-central1');
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

  const handleEditProfile = (user: User) => {
    setEditingUser(user);
    setEditDisplayName(user.displayName || '');
    setEditPhotoURL(user.photoURL || ''); // Pre-fill with existing photo
    setShowEditProfileModal(true);
  };

  const handleSaveUserProfile = async () => {
    if (!editingUser) return;

    setSavingProfile(true);
    try {
      const functions = getFunctions(app, 'us-central1');
      const updateUserProfileFunction = httpsCallable(functions, 'updateUserProfile');

      const updateData: { uid: string; displayName?: string; photoURL?: string } = {
        uid: editingUser.uid,
        displayName: editDisplayName.trim(),
      };

      // Only include photoURL if it was changed
      if (editPhotoURL.trim()) {
        updateData.photoURL = editPhotoURL.trim();
      }

      await updateUserProfileFunction(updateData);

      // Update local state
      setUsers(users.map(u => u.uid === editingUser.uid ? {
        ...u,
        displayName: editDisplayName.trim(),
        ...(editPhotoURL.trim() ? { photoURL: editPhotoURL.trim() } : {})
      } : u));
      setShowEditProfileModal(false);
      setEditingUser(null);
      showToast('User profile updated successfully!');
    } catch (err: any) {
      console.error('Error updating user profile:', err);
      showToast(`Failed to update profile: ${err.message}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePhotoClick = () => {
    if (fileInputRef.current && !uploadingPhoto) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editingUser) return;

    // Basic validation
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      showToast('File size must be less than 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file');
      return;
    }

    setUploadingPhoto(true);
    try {
      const photoURL = await uploadProfilePhoto(editingUser.uid, file);
      setEditPhotoURL(photoURL);
      showToast('Photo uploaded successfully! Save changes to apply.');
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      showToast('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
      // Reset input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleRemindUser = async (user: User) => {
    if (!confirm(`Send a reminder email to ${user.email}?`)) {
      return;
    }

    // Set a loading state locally if needed, or just show toast
    showToast(`Sending reminder to ${user.email}...`);

    try {
      const functions = getFunctions(app, 'us-central1');
      const sendReminderEmailFunction = httpsCallable(functions, 'sendReminderEmail');

      await sendReminderEmailFunction({ email: user.email });

      showToast(`Reminder sent to ${user.email}!`);
    } catch (err: any) {
      console.error('Error sending reminder:', err);
      showToast(`Failed to send reminder: ${err.message}`);
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
      // Debug: Check if user is authenticated
      const { auth } = await import('../services/firebaseConfig');
      const currentUser = auth.currentUser;
      console.log('Current user:', currentUser?.email);
      console.log('Auth token available:', !!currentUser);

      if (!currentUser) {
        throw new Error('You must be signed in to invite users. Please refresh the page and sign in again.');
      }

      // Force token refresh to ensure it's valid
      await currentUser.getIdToken(true);

      const functions = getFunctions(app, 'us-central1');
      const inviteUserFunction = httpsCallable(functions, 'inviteUser');
      const result = await inviteUserFunction({ email: inviteEmail, role: inviteRole });

      console.log('Invite result:', result);
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
        <div className={`w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-brand-secondary' : 'bg-slate-600'
          }`}>
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'
            }`}></div>
        </div>
      </div>
      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{label}</span>
    </label>
  );

  // Get available roles for dropdowns
  const availableRoles = Object.keys(permissions);

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
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'users'
              ? 'border-brand-secondary text-white'
              : 'border-transparent text-slate-400 hover:text-white'
              }`}
          >
            Users & Roles
          </button>
          <button
            onClick={() => setActiveTab('invite')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'invite'
              ? 'border-brand-secondary text-white'
              : 'border-transparent text-slate-400 hover:text-white'
              }`}
          >
            Invite Users
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'permissions'
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
                          <div className="w-12 h-12 bg-brand-secondary/20 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt={user.displayName || user.email} className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon className="w-6 h-6 text-brand-secondary" />
                            )}
                          </div>
                          <div className="flex-grow min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <p className="text-white font-medium truncate">
                                {user.displayName || user.email}
                              </p>
                              {user.email === currentUserEmail && (
                                <span className="text-xs bg-brand-secondary/20 text-brand-light px-2 py-0.5 rounded">You</span>
                              )}
                            </div>
                            {user.displayName && (
                              <p className="text-xs text-slate-400 truncate mb-0.5">{user.email}</p>
                            )}
                            <p className="text-xs text-slate-500">
                              {user.lastSignIn
                                ? `Joined ${new Date(user.createdAt).toLocaleDateString()} • Last sign in ${new Date(user.lastSignIn).toLocaleDateString()}`
                                : `Invited ${new Date(user.createdAt).toLocaleDateString()}`
                              }
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3 ml-4">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.uid, e.target.value)}
                            disabled={updatingUserId === user.uid || user.email === currentUserEmail}
                            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${getRoleBadgeColor(user.role)
                              } bg-slate-800 cursor-pointer hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {availableRoles.map(role => (
                              <option key={role} value={role}>
                                {role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, ' ')}
                              </option>
                            ))}
                          </select>
                          {user.email !== currentUserEmail && (
                            <>
                              {!user.lastSignIn && (
                                <button
                                  onClick={() => handleRemindUser(user)}
                                  className="p-2 text-slate-400 hover:text-yellow-400 rounded-lg hover:bg-slate-800 transition-colors"
                                  title="Send reminder email"
                                >
                                  <EnvelopeIcon className="w-5 h-5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleEditProfile(user)}
                                className="p-2 text-slate-400 hover:text-brand-secondary rounded-lg hover:bg-slate-800 transition-colors"
                                title="Edit profile"
                              >
                                <PencilIcon className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.uid, user.email)}
                                className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-800 transition-colors"
                                title="Delete user"
                              >
                                <TrashIcon className="w-5 h-5" />
                              </button>
                            </>
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
                    {availableRoles.filter(r => r !== 'admin').map(role => (
                      <label key={role} className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${inviteRole === role
                        ? 'border-brand-secondary bg-brand-secondary/10'
                        : 'border-slate-700 hover:border-slate-600'
                        }`}>
                        <input
                          type="radio"
                          value={role}
                          checked={inviteRole === role}
                          onChange={(e) => setInviteRole(e.target.value)}
                          className="text-brand-secondary focus:ring-brand-secondary"
                        />
                        <div>
                          <p className="text-white font-medium">{role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, ' ')}</p>
                          <p className="text-xs text-slate-400">{permissions[role]?.description || 'Custom role'}</p>
                        </div>
                      </label>
                    ))}
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
            {/* Header with Add Role button */}
            <div className="flex items-center justify-between">
              <p className="text-slate-400">
                Configure what actions each role can perform on projects.
              </p>
              <div className="flex items-center space-x-3">
                {hasChanges && (
                  <button
                    onClick={handleSavePermissions}
                    disabled={savingPermissions}
                    className="flex items-center space-x-2 bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {savingPermissions ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Permissions</span>
                    )}
                  </button>
                )}
                <button
                  onClick={() => setShowAddRoleModal(true)}
                  className="flex items-center space-x-2 bg-brand-secondary hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  <PlusCircleIcon className="w-5 h-5" />
                  <span>Add Role</span>
                </button>
              </div>
            </div>

            {permissionsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-secondary mx-auto"></div>
                <p className="text-slate-400 mt-4">Loading permissions...</p>
              </div>
            ) : (
              <>
                {Object.entries(permissions).map(([role, perms]) => {
                  const rolePerms = perms as PermissionConfig;
                  return (
                    <div key={role} className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <span className={`px-3 py-1 rounded-lg text-sm font-semibold border ${getRoleBadgeColor(role)}`}>
                            {role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, ' ')}
                          </span>
                          <span className="text-slate-400 text-sm">
                            {rolePerms.description}
                          </span>
                          {rolePerms.isSystem && (
                            <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded">System</span>
                          )}
                        </div>
                        {!rolePerms.isSystem && (
                          <button
                            onClick={() => handleDeleteRole(role)}
                            className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-800 transition-colors"
                            title="Delete role"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        )}
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

                {hasChanges && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <p className="text-sm text-yellow-300">
                      <strong>Unsaved changes:</strong> You have modified permissions. Click "Save Permissions" to apply your changes.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Add Role Modal */}
      {showAddRoleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Add New Role</h3>
              <button
                onClick={() => setShowAddRoleModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Role Name
                </label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g., team_lead"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand-secondary transition-colors"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Use lowercase letters, numbers, and underscores only
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  placeholder="e.g., Can manage team projects"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand-secondary transition-colors"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowAddRoleModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddRole}
                  disabled={!newRoleName.trim()}
                  className="flex-1 px-4 py-2 bg-brand-secondary hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Role
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Profile Modal */}
      {showEditProfileModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Edit User Profile</h3>
              <button
                onClick={() => {
                  setShowEditProfileModal(false);
                  setEditingUser(null);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email
                </label>
                <p className="text-white bg-slate-900 px-4 py-3 rounded-lg border border-slate-700">
                  {editingUser.email}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Enter display name"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand-secondary transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Photo URL
                </label>
                <div className="flex space-x-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <input
                    type="text"
                    value={editPhotoURL}
                    onChange={(e) => setEditPhotoURL(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand-secondary transition-colors"
                  />
                  <div
                    onClick={handlePhotoClick}
                    className="w-12 h-12 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:border-brand-secondary transition-colors relative group"
                  >
                    {uploadingPhoto ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : editPhotoURL ? (
                      <>
                        <img src={editPhotoURL} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <CameraIcon className="w-4 h-4 text-white" />
                        </div>
                      </>
                    ) : (
                      <CameraIcon className="w-5 h-5 text-slate-400 group-hover:text-white" />
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Enter a URL or click the icon to upload a photo
                </p>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowEditProfileModal(false);
                    setEditingUser(null);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveUserProfile}
                  disabled={savingProfile}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-brand-secondary hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingProfile ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckIcon className="w-5 h-5" />
                      <span>Save</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAdministrationPage;
