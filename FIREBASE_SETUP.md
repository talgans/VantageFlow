# VantageFlow Firebase Setup Guide

## ✅ Completed Components

### 1. Authentication System
- ✅ Firebase Authentication integrated
- ✅ AuthContext with role-based access control
- ✅ LoginModal UI for sign in/sign up
- ✅ Custom claims for user roles (admin, manager, member)
- ✅ Auto token refresh every 10 minutes

### 2. Firestore Database
- ✅ Real-time project synchronization
- ✅ Firestore service layer with CRUD operations
- ✅ Date/Timestamp conversion handlers
- ✅ Security rules with role-based permissions
- ✅ Data seeding script for initial projects

### 3. UI Integration
- ✅ Updated Header with user info and auth buttons
- ✅ App.tsx with Firestore real-time listeners
- ✅ Loading states for auth and data
- ✅ Error handling and toast notifications

## 📋 Setup Instructions

### Step 1: Configure Environment Variables

Copy `.env.local.template` to `.env.local`:
```bash
cp .env.local.template .env.local
```

Add your Firebase credentials:
```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key
```

### Step 2: Deploy Firestore Security Rules

```bash
firebase deploy --only firestore:rules
```

Or manually copy `firestore.rules` to Firebase Console:
1. Go to Firebase Console → Firestore Database → Rules
2. Copy content from `firestore.rules`
3. Publish

### Step 3: Seed Initial Data (Optional)

```bash
cd firestore-admin
npm install
npm run seed
```

This populates Firestore with the mock project data.

### Step 4: Set User Roles (Admin Script Required)

Create `firestore-admin/setUserRole.ts`:
```typescript
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'serviceAccountKey.json'), 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function setUserRole(email: string, role: 'admin' | 'manager' | 'member') {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { role });
    console.log(`✅ Set ${email} role to: ${role}`);
  } catch (error) {
    console.error('❌ Error setting role:', error);
  }
}

// Usage
const [email, role] = process.argv.slice(2);
if (!email || !role) {
  console.log('Usage: ts-node setUserRole.ts <email> <role>');
  process.exit(1);
}

setUserRole(email, role as any).then(() => process.exit(0));
```

Add to `firestore-admin/package.json`:
```json
"scripts": {
  "seed": "ts-node seed.ts",
  "set-role": "ts-node setUserRole.ts"
}
```

Set user roles:
```bash
cd firestore-admin
npm run set-role user@example.com admin
npm run set-role manager@example.com manager
```

### Step 5: Run the Application

```bash
npm run dev
```

Visit `http://localhost:3000`

## 🔐 User Authentication Flow

### New User Signup
1. Click "Sign In" in header
2. Toggle to "Sign Up" mode
3. Enter email and password (min 6 characters)
4. User created with default **Member** role
5. Admin must manually upgrade role if needed

### Sign In
1. Click "Sign In" in header
2. Enter email and password
3. AuthContext extracts role from custom claims
4. UI adjusts based on role permissions

### Role Permissions
- **Member**: Can view all projects, cannot edit/delete
- **Manager**: Can view, create, edit projects
- **Admin**: Full access including delete

## 📊 Firestore Data Structure

```
projects/
  └─ {projectId}/
      ├─ id: string
      ├─ name: string
      ├─ description: string
      ├─ coreSystem: string
      ├─ duration: string
      ├─ team: { name, size, manager }
      ├─ cost: string
      ├─ phases: Phase[]
      │   └─ tasks: Task[]
      │       └─ subTasks: Task[] (recursive)
      ├─ createdAt: Timestamp
      └─ updatedAt: Timestamp
```

## 🔒 Security Rules Summary

- **Read**: All authenticated users can read projects
- **Create**: Only Admin and Manager roles
- **Update**: Only Admin and Manager roles
- **Delete**: Only Admin role

Rules are enforced at the Firestore level, not just in the UI.

## 🧪 Testing

### Test Authentication
1. Create test user via signup
2. Sign out and sign back in
3. Verify role displays correctly in header

### Test Permissions
1. Sign in as Member → verify no edit/delete buttons
2. Sign in as Manager → verify create/edit buttons present
3. Sign in as Admin → verify full CRUD access

### Test Real-Time Sync
1. Open app in two browser windows
2. Sign in with different users
3. Edit project in one window
4. Verify changes appear instantly in other window

## 🛠 Troubleshooting

### "Cannot read properties of undefined"
- Check `.env.local` has all Firebase config variables
- Verify Firebase project is initialized correctly

### "Permission denied" errors
- Deploy `firestore.rules` to Firebase
- Verify user has custom claims set (use setUserRole script)

### Custom claims not updating
- Force token refresh: Sign out and sign in again
- Or wait for 10-minute auto-refresh

### Dates showing as objects
- Verify `firestoreService.ts` conversion functions are used
- Check that dates are converted to/from Timestamp correctly

## 📚 Key Files Reference

- `services/firebaseConfig.ts` - Firebase initialization
- `contexts/AuthContext.tsx` - Authentication state and methods
- `services/firestoreService.ts` - Database CRUD operations
- `components/LoginModal.tsx` - Sign in/up UI
- `components/Header.tsx` - User info and auth buttons
- `firestore.rules` - Database security rules
- `firestore-admin/seed.ts` - Data seeding script

## 🎯 Next Steps

1. ✅ Complete setup steps above
2. ✅ Deploy security rules
3. ✅ Seed initial data
4. ✅ Create admin user and set role
5. ✅ Test authentication and permissions
6. 🚀 Deploy to production!

---

For production deployment, consider:
- Firebase Hosting for static files
- Cloud Functions for advanced backend logic
- Firebase Storage for file uploads
- Analytics and monitoring
