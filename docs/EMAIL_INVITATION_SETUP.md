# Email Invitation System Setup Guide

This guide documents how to implement an email invitation system using Firebase Cloud Functions (v1/1st Gen) with Gmail SMTP via Nodemailer.

## Overview

The system allows admins to invite new users by email. When invited:
1. A Firebase Authentication account is created
2. A custom role is assigned via custom claims
3. A password reset email is sent with a 24-hour expiration link
4. User sets their password and can immediately log in

## Prerequisites

- Firebase project with Authentication enabled
- Firebase CLI installed (`npm install -g firebase-tools`)
- Gmail account with App Password enabled
- Node.js 20+

---

## Step 1: Initialize Firebase Functions

```bash
# In your project root
firebase init functions

# Select:
# - TypeScript
# - ESLint: Yes
# - Install dependencies: Yes
```

This creates a `functions/` directory with the necessary structure.

---

## Step 2: Install Dependencies

```bash
cd functions
npm install firebase-admin firebase-functions nodemailer
npm install --save-dev @types/nodemailer
```

**package.json** should have:
```json
{
  "engines": {
    "node": "20"
  },
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^6.3.0",
    "nodemailer": "^7.0.10"
  }
}
```

---

## Step 3: Configure Gmail App Password

### Enable 2-Factor Authentication
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Step Verification

### Generate App Password
1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" and your device
3. Copy the 16-character password (e.g., `tvjd daxv ibiy tvie`)

### Set Firebase Config
```bash
cd functions
firebase functions:config:set email.user="your-email@gmail.com" email.password="your-app-password"
```

Verify config:
```bash
firebase functions:config:get
```

---

## Step 4: Write the Cloud Function

**CRITICAL**: Use Firebase Functions v1 API for reliable authentication context.

**functions/src/index.ts**:
```typescript
// IMPORTANT: Use v1 import for proper authentication handling
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

admin.initializeApp();

/**
 * Invite a new user via email
 * Creates Firebase Auth account, sets role, sends password reset email
 */
export const inviteUser = functions
  .runWith({ 
    timeoutSeconds: 60, 
    memory: '256MB' 
  })
  .https.onCall(async (data: any, context) => {
    // 1. Verify caller is authenticated
    if (!(context as any).auth) {
      throw new functions.https.HttpsError(
        'unauthenticated', 
        'User must be authenticated'
      );
    }

    // 2. Verify caller is admin
    const callerUid = (context as any).auth.uid;
    const caller = await admin.auth().getUser(callerUid);
    if (caller.customClaims?.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied', 
        'Only admins can invite users'
      );
    }

    // 3. Validate input
    const { email, role, displayName } = data;
    if (!email || !role) {
      throw new functions.https.HttpsError(
        'invalid-argument', 
        'Email and role are required'
      );
    }

    const validRoles = ['admin', 'manager', 'member'];
    if (!validRoles.includes(role)) {
      throw new functions.https.HttpsError(
        'invalid-argument', 
        'Invalid role specified'
      );
    }

    try {
      // 4. Generate temporary password
      const tempPassword = Math.random().toString(36).slice(-12) + 
                          Math.random().toString(36).slice(-12);

      // 5. Create Firebase Auth user
      const userRecord = await admin.auth().createUser({
        email,
        displayName: displayName || undefined,
        password: tempPassword,
        emailVerified: false,
      });
      console.log(`User created: ${userRecord.uid}`);

      // 6. Set custom claims for role
      await admin.auth().setCustomUserClaims(userRecord.uid, { role });
      console.log(`Role set: ${role}`);

      // 7. Generate password reset link (24 hour expiration)
      const actionCodeSettings = {
        url: 'https://your-app.web.app', // Redirect URL after password reset
        handleCodeInApp: false,
      };
      const resetLink = await admin.auth().generatePasswordResetLink(
        email, 
        actionCodeSettings
      );
      console.log('Password reset link generated');

      // 8. Configure email transporter
      const emailConfig = functions.config().email;
      if (!emailConfig?.user || !emailConfig?.password) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Email configuration not set'
        );
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailConfig.user,
          pass: emailConfig.password,
        },
      });

      // 9. Send invitation email
      const mailOptions = {
        from: `Your App <${emailConfig.user}>`,
        to: email,
        subject: 'You have been invited to Your App',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3b82f6;">Welcome!</h2>
            <p>You have been invited to join as a <strong>${role}</strong>.</p>
            <p>Click the button below to set your password:</p>
            <div style="margin: 30px 0;">
              <a href="${resetLink}" 
                 style="background-color: #3b82f6; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; display: inline-block;">
                Set Your Password
              </a>
            </div>
            <p style="color: #64748b; font-size: 14px;">
              This link expires in 24 hours.
            </p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Invitation email sent to ${email}`);

      return {
        success: true,
        uid: userRecord.uid,
        message: `Invitation sent to ${email}`,
      };

    } catch (error: any) {
      console.error('Error inviting user:', error);
      
      // Handle specific Firebase errors
      if (error.code === 'auth/email-already-exists') {
        throw new functions.https.HttpsError(
          'already-exists',
          'A user with this email already exists'
        );
      }
      
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Failed to invite user'
      );
    }
  });
```

---

## Step 5: Deploy the Function

```bash
cd functions
npm run build
firebase deploy --only functions:inviteUser
```

Expected output:
```
✓ functions[inviteUser(us-central1)] Successful create operation.
```

---

## Step 6: Client-Side Implementation

### Call the Cloud Function from React

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const handleInviteUser = async (email: string, role: string) => {
  try {
    const functions = getFunctions();
    const inviteUserFn = httpsCallable(functions, 'inviteUser');
    
    const result = await inviteUserFn({ email, role });
    const data = result.data as { success: boolean; message: string };
    
    if (data.success) {
      alert(`Invitation sent to ${email}`);
    }
  } catch (error: any) {
    console.error('Error:', error);
    alert(`Failed to invite: ${error.message}`);
  }
};
```

### Example UI Component

```tsx
const InviteUserForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await handleInviteUser(email, role);
      setEmail('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="user@example.com"
        required
      />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="member">Member</option>
        <option value="manager">Manager</option>
        <option value="admin">Admin</option>
      </select>
      <button type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Send Invitation'}
      </button>
    </form>
  );
};
```

---

## Step 7: Display Invited vs Joined Users

Track user status by checking `lastSignIn`:

```typescript
// In your listUsers Cloud Function
const users = listUsersResult.users.map(user => ({
  uid: user.uid,
  email: user.email || '',
  role: user.customClaims?.role || 'member',
  createdAt: user.metadata.creationTime,
  lastSignIn: user.metadata.lastSignInTime, // undefined if never signed in
}));

// In your UI
<p>
  {user.lastSignIn 
    ? `Joined ${new Date(user.createdAt).toLocaleDateString()}`
    : `Invited ${new Date(user.createdAt).toLocaleDateString()}`
  }
</p>
```

---

## Common Issues & Solutions

### Issue: "The request was not authenticated"

**Cause**: Using Firebase Functions v2 API which requires explicit IAM configuration.

**Solution**: Use v1 API with explicit import:
```typescript
// ❌ Wrong - v2 API
import { onCall } from 'firebase-functions/v2/https';

// ✅ Correct - v1 API
import * as functions from 'firebase-functions/v1';
export const myFunction = functions.https.onCall(...);
```

### Issue: Function deploys as 2nd Gen

**Cause**: Firebase CLI defaults to 2nd Gen when using `firebase-functions` v6+.

**Solution**: Use `functions.runWith()` to force 1st Gen:
```typescript
export const inviteUser = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data, context) => { ... });
```

Also delete any `.env.vantageflow` or `.env.<project>` files in the functions directory.

### Issue: Email not sending

**Cause**: Gmail App Password not configured or incorrect.

**Solution**:
1. Verify config: `firebase functions:config:get`
2. Re-set config: `firebase functions:config:set email.user="..." email.password="..."`
3. Redeploy: `firebase deploy --only functions:inviteUser`

### Issue: Password reset link redirects to wrong URL

**Cause**: `actionCodeSettings.url` not matching your deployed app.

**Solution**: Update the URL in the function:
```typescript
const actionCodeSettings = {
  url: 'https://your-actual-domain.web.app',
  handleCodeInApp: false,
};
```

### Issue: User can't log in after setting password

**Cause**: Custom claims not set before password reset.

**Solution**: Ensure `setCustomUserClaims` is called before generating the reset link (as shown in the code above).

---

## Security Considerations

1. **Always verify caller is admin** before creating users
2. **Validate email format** on both client and server
3. **Limit valid roles** to prevent privilege escalation
4. **Use HTTPS** for all communications
5. **Log all invitation attempts** for audit trail
6. **Rate limit** the invitation endpoint

---

## Deprecation Notice

⚠️ `functions.config()` will be deprecated in March 2026. Future migration options:
- Use `.env` files with `defineString()` from `firebase-functions/params`
- Use Secret Manager for sensitive values

Current implementation works until March 2026.

---

## File Structure

```
your-project/
├── functions/
│   ├── src/
│   │   └── index.ts      # Cloud Functions
│   ├── package.json
│   └── tsconfig.json
├── src/
│   └── components/
│       └── UserAdministration.tsx  # UI Component
└── .firebaserc
```

---

## Testing Checklist

- [ ] Admin can send invitation
- [ ] Non-admin cannot send invitation
- [ ] Email arrives with correct content
- [ ] Password reset link works
- [ ] User can log in after setting password
- [ ] User has correct role after first login
- [ ] Invited users show "Invited" status
- [ ] Logged-in users show "Joined" status

---

## References

- [Firebase Admin SDK - Create User](https://firebase.google.com/docs/auth/admin/manage-users#create_a_user)
- [Firebase Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Nodemailer Documentation](https://nodemailer.com/)
- [Firebase Functions v1 vs v2](https://firebase.google.com/docs/functions/version-comparison)
