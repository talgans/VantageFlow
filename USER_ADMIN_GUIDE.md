# User Administration System - Setup Guide

## Overview

VantageFlow now includes a comprehensive user administration interface with:
- **User Management**: View all users, assign roles, delete users
- **Role Permissions**: Configure what each role can do (Create, Read, Update, Delete)
- **Real-time Updates**: Changes take effect immediately

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Administration UI                    │
│  (components/UserAdministration.tsx)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────┐    ┌─────────────────────────────┐ │
│  │  Users & Roles Tab │    │  Role Permissions Tab       │ │
│  │                    │    │                             │ │
│  │  • List all users  │    │  • Admin: Full CRUD         │ │
│  │  • Change roles    │    │  • Manager: CRU_            │ │
│  │  • Delete users    │    │  • Member: _R__             │ │
│  └────────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Firebase Cloud Functions                        │
│  (functions/src/index.ts)                                   │
├─────────────────────────────────────────────────────────────┤
│  • listUsers()      - Get all users with roles              │
│  • setUserRole()    - Update user's role                    │
│  • deleteUser()     - Remove user account                   │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│         Firebase Authentication + Custom Claims              │
│  • Stores user accounts                                     │
│  • Manages custom claims (role: admin|manager|member)       │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Step 1: Deploy Cloud Functions

```bash
# Navigate to functions directory
cd functions

# Install dependencies
npm install

# Deploy to Firebase
npm run deploy
```

**Expected Output:**
```
✔ functions[listUsers]: Successful create operation.
✔ functions[setUserRole]: Successful create operation.
✔ functions[deleteUser]: Successful create operation.
```

### Step 2: Access User Administration

1. Sign in as an admin user
2. Click the **"Admin"** button in the header (shield icon)
3. The User Administration modal opens

### Step 3: Manage Users

**To change a user's role:**
1. Go to "Users & Roles" tab
2. Find the user in the list
3. Click the role dropdown
4. Select new role (Admin/Manager/Member)
5. Changes apply immediately

**To delete a user:**
1. Click the trash icon next to the user
2. Confirm deletion
3. User is removed from Firebase Authentication

### Step 4: Configure Permissions

1. Go to "Role Permissions" tab
2. Toggle permissions for each role:
   - **Create Projects**: Can create new projects
   - **View Projects**: Can see project details
   - **Update Projects**: Can edit existing projects
   - **Delete Projects**: Can remove projects

**Note**: Permission UI is for reference. Actual enforcement requires updating `firestore.rules`.

## Features Breakdown

### 1. Users & Roles Tab

**What You See:**
- List of all users with email, join date, last sign-in
- Current role badge (color-coded)
- Role dropdown to change permissions
- Delete button (except for your own account)

**Actions:**
- **Change Role**: Select from Admin, Manager, or Member
- **Delete User**: Permanently remove user (requires confirmation)

**Role Colors:**
- 🔴 **Admin**: Red badge - Full system access
- 🔵 **Manager**: Blue badge - Can create and manage projects
- ⚪ **Member**: Gray badge - View-only access

### 2. Role Permissions Tab

Visual configuration of what each role can do:

| Role    | Create | Read | Update | Delete |
|---------|--------|------|--------|--------|
| Admin   | ✅     | ✅   | ✅     | ✅     |
| Manager | ✅     | ✅   | ✅     | ❌     |
| Member  | ❌     | ✅   | ❌     | ❌     |

Toggle switches allow you to customize permissions per role.

## How It Works

### Role Assignment Flow

1. **User signs up** → Defaults to `member` role
2. **Admin changes role** → Calls `setUserRole()` Cloud Function
3. **Custom claims updated** → Firebase stores role in user token
4. **User refreshes token** → Next API call gets new role
5. **UI updates** → User sees new permissions

### Permission Enforcement

**Client-Side (App.tsx):**
```typescript
const canEditProject = (project: Project): boolean => {
  // Admin can edit everything
  if (currentUserRole === UserRole.Admin) return true;
  // Owner can edit their own project
  if (user && project.ownerId === user.uid) return true;
  return false;
}
```

**Database-Side (firestore.rules):**
```javascript
function canEditProject(projectData) {
  return isAdmin() || isProjectOwner(projectData);
}

match /projects/{projectId} {
  allow update: if canEditProject(resource.data);
}
```

### Security

- **Authentication Required**: All functions check `context.auth`
- **Admin-Only Access**: Functions verify `customClaims.role === 'admin'`
- **Self-Protection**: Cannot delete your own admin account
- **Token Refresh**: Roles update automatically every 10 minutes

## Troubleshooting

### "functions/not-found" Error

**Problem**: Cloud Functions not deployed

**Solution**:
```bash
cd functions
npm install
npm run build
npm run deploy
```

### Changes Don't Apply

**Problem**: Token not refreshed

**Solution**:
1. Sign out
2. Sign back in
3. Role changes now active

### Permission Denied

**Problem**: Not signed in as admin

**Solution**:
```bash
# Set your account to admin via CLI
cd firestore-admin
npm run set-role your-email@example.com admin
```

Then sign out and sign back in.

### Deployment Fails

**Problem**: Missing dependencies or build errors

**Solution**:
```bash
cd functions
rm -rf node_modules lib
npm install
npm run build
npm run deploy
```

## File Structure

```
VantageFlow/
├── components/
│   └── UserAdministration.tsx    # Main UI component
├── functions/
│   ├── src/
│   │   └── index.ts              # Cloud Functions
│   ├── package.json              # Function dependencies
│   ├── tsconfig.json             # TypeScript config
│   └── README.md                 # Function documentation
├── firestore-admin/
│   └── setUserRole.ts            # CLI admin tool (backup)
├── firebase.json                 # Functions configuration
└── firestore.rules               # Security rules
```

## Best Practices

1. **Always have at least one admin**: Don't delete or demote all admins
2. **Use meaningful roles**: Assign based on actual responsibilities
3. **Audit regularly**: Review user list periodically
4. **Test permissions**: Verify each role can only do what they should
5. **Backup admin access**: Keep CLI tool functional as backup

## Next Steps

### Enhance Permissions

Edit `firestore.rules` to enforce granular permissions:

```javascript
// Example: Managers can only edit projects they created
function canEditProject(projectData) {
  return isAdmin() || 
         (isManager() && projectData.ownerId == request.auth.uid);
}
```

### Add Email Notifications

Notify users when their role changes:

```typescript
// In setUserRole function
await sendEmail(userEmail, `Your role has been updated to ${role}`);
```

### Activity Logging

Track who changes what:

```typescript
await admin.firestore().collection('audit_log').add({
  action: 'role_change',
  performedBy: context.auth.uid,
  targetUser: uid,
  oldRole: oldRole,
  newRole: role,
  timestamp: admin.firestore.FieldValue.serverTimestamp()
});
```

## Support

For issues or questions:
1. Check the console for error messages
2. Review Firebase Functions logs: `firebase functions:log`
3. Verify user has correct role: `cd firestore-admin && npm run list-users`

## Summary

✅ **Deployed**: Cloud Functions for user management
✅ **Accessible**: Admin button in header
✅ **Functional**: Change roles, delete users, view permissions
✅ **Secure**: Admin-only access, enforced at database level
✅ **Real-time**: Changes apply immediately after token refresh
