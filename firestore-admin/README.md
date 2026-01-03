# VantageFlow Firestore Admin Scripts

Administrative scripts for managing the VantageFlow Firestore database and user roles.

## Prerequisites

1. **Service Account Key**: Download from Firebase Console
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save as `serviceAccountKey.json` in this folder
   - **Never commit this file to Git** (already in .gitignore)

2. **Dependencies**: Install packages
   ```bash
   npm install
   ```

## Available Scripts

### 1. Seed Database

Populate Firestore with initial project data (from `constants.ts`).

```bash
npm run seed
```

**Output:**
- Creates projects collection in Firestore
- Converts all dates to Firestore Timestamps
- Verifies data was written correctly

**Note:** Run this once to initialize the database with sample data.

---

### 2. Set User Role

Assign roles to users via Firebase custom claims.

```bash
npm run set-role <email> <role>
```

**Available Roles:**
- `admin` - Full access (create, read, update, delete)
- `manager` - Create, read, and update projects
- `member` - Read-only access (default for new users)

**Examples:**
```bash
# Set admin role
npm run set-role admin@example.com admin

# Set manager role
npm run set-role manager@example.com manager

# Set member role (explicitly)
npm run set-role user@example.com member
```

**Important Notes:**
- User must already exist (signed up via the app)
- User must sign out and sign in again for role changes to take effect
- Or wait for automatic token refresh (10 minutes)

---

### 3. List All Users

View all registered users and their current roles.

```bash
npm run list-users
```

**Output:**
```
📋 Listing all users and their roles:

Total users: 3

📧 admin@example.com
   ID: abc123...
   Role: admin
   Created: Mon, 08 Nov 2025 12:00:00 GMT

📧 manager@example.com
   ID: def456...
   Role: manager
   Created: Mon, 08 Nov 2025 12:30:00 GMT

📧 user@example.com
   ID: ghi789...
   Role: member (default)
   Created: Mon, 08 Nov 2025 13:00:00 GMT
```

---

## Workflow

### Initial Setup
1. **Seed database** with sample projects:
   ```bash
   npm run seed
   ```

2. **Create first admin user**:
   - Sign up via the app UI with your email
   - Run: `npm run set-role your-email@example.com admin`
   - Sign out and back in

3. **Create additional users** as needed:
   ```bash
   npm run set-role manager1@example.com manager
   npm run set-role manager2@example.com manager
   ```

### Ongoing Management
- **List users**: `npm run list-users`
- **Change roles**: `npm run set-role <email> <new-role>`
- **Verify roles**: Check custom claims in Firebase Console → Authentication → Users

---

## Security Notes

⚠️ **Important Security Considerations:**

1. **Service Account Key**
   - Keep `serviceAccountKey.json` private and secure
   - Never commit to version control
   - Has full admin access to your Firebase project

2. **Script Access**
   - These scripts bypass Firestore security rules
   - Only run from trusted environments
   - Consider restricting access to this folder in production

3. **Custom Claims**
   - Roles are stored in Firebase ID tokens
   - Changes require token refresh (sign out/in)
   - Verified on both client and server

---

## Troubleshooting

### "serviceAccountKey.json not found"
**Solution:** Download the service account key from Firebase Console and place in this folder.

### "User not found"
**Solution:** User must sign up in the app first before setting their role.

### "Permission denied"
**Solution:** Ensure service account has Admin SDK Admin permission in Firebase IAM.

### Role not updating in app
**Solution:** User must sign out and sign in again, or wait for 10-minute auto-refresh.

---

## File Structure

```
firestore-admin/
├── seed.ts              # Database seeding script
├── setUserRole.ts       # User role management script
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── .gitignore          # Excludes sensitive files
├── serviceAccountKey.json  # ⚠️ NOT IN GIT - Download from Firebase
└── README.md           # This file
```

---

## Additional Resources

- [Firebase Admin SDK Docs](https://firebase.google.com/docs/admin/setup)
- [Custom Claims Guide](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [VantageFlow Setup Guide](../FIREBASE_SETUP.md)
