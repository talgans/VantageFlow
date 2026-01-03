import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

admin.initializeApp();

interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  role: string;
  createdAt: string;
  lastSignIn?: string;
}

/**
 * List all users (Admin only)
 */
export const listUsers = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!(context as any).auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Check if user is admin
  const callerToken = await admin.auth().getUser((context as any).auth.uid);
  if (!callerToken.customClaims?.role || callerToken.customClaims.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can list users');
  }

  try {
    const listUsersResult = await admin.auth().listUsers(1000);

    const users: UserData[] = listUsersResult.users.map(user => ({
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName,
      role: user.customClaims?.role || 'member',
      createdAt: user.metadata.creationTime,
      lastSignIn: user.metadata.lastSignInTime,
    }));

    return { users };
  } catch (error) {
    console.error('Error listing users:', error);
    throw new functions.https.HttpsError('internal', 'Failed to list users');
  }
});

/**
 * Set user role (Admin only)
 */
export const setUserRole = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!(context as any).auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Check if user is admin
  const callerToken = await admin.auth().getUser((context as any).auth.uid);
  if (!callerToken.customClaims?.role || callerToken.customClaims.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can set user roles');
  }

  const { uid, role } = data as any;

  // Validate role
  if (!['admin', 'manager', 'member'].includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid role. Must be admin, manager, or member');
  }

  try {
    await admin.auth().setCustomUserClaims(uid, { role });
    return { success: true, message: `User role set to ${role}` };
  } catch (error) {
    console.error('Error setting user role:', error);
    throw new functions.https.HttpsError('internal', 'Failed to set user role');
  }
});

/**
 * Delete user (Admin only)
 */
export const deleteUser = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!(context as any).auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Check if user is admin
  const callerToken = await admin.auth().getUser((context as any).auth.uid);
  if (!callerToken.customClaims?.role || callerToken.customClaims.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can delete users');
  }

  const { uid } = data as any;

  // Prevent self-deletion
  if (uid === (context as any).auth.uid) {
    throw new functions.https.HttpsError('invalid-argument', 'Cannot delete your own account');
  }

  try {
    await admin.auth().deleteUser(uid);
    return { success: true, message: 'User deleted successfully' };
  } catch (error) {
    console.error('Error deleting user:', error);
    throw new functions.https.HttpsError('internal', 'Failed to delete user');
  }
});

/**
 * Invite user via email (Admin only)
 * Creates a user account with specified role
 */
export const inviteUser = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB'
  })
  .https.onCall(async (data: any, context) => {
    // Check if user is authenticated
    if (!(context as any).auth) {
      console.error('inviteUser called without authentication');
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    console.log(`inviteUser called by: ${(context as any).auth.uid}`);

    // Check if user is admin
    const callerToken = await admin.auth().getUser((context as any).auth.uid);
    console.log(`Caller role: ${callerToken.customClaims?.role}`);

    if (!callerToken.customClaims?.role || callerToken.customClaims.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can invite users');
    }

    const { email, role } = data;
    console.log(`Attempting to invite: ${email} with role: ${role}`);

    // Validate role - only manager or member allowed for invitations
    if (!['manager', 'member'].includes(role)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid role. Can only invite as manager or member');
    }

    // Validate email
    if (!email || !email.includes('@')) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid email address');
    }

    try {
      // Check if user already exists
      console.log(`Checking if user ${email} already exists...`);
      try {
        await admin.auth().getUserByEmail(email);
        throw new functions.https.HttpsError('already-exists', 'User with this email already exists');
      } catch (error: any) {
        if (error.code !== 'auth/user-not-found') {
          throw error;
        }
        console.log('User does not exist, proceeding with creation');
        // User doesn't exist, proceed with creation
      }

      // Create user with temporary password
      console.log('Creating user account...');
      const tempPassword = Math.random().toString(36).slice(-12) + 'Aa1!';
      const userRecord = await admin.auth().createUser({
        email,
        password: tempPassword,
        emailVerified: false,
      });
      console.log(`User created successfully: ${userRecord.uid}`);

      // Set custom claims for role
      console.log(`Setting custom claims: role=${role}`);
      await admin.auth().setCustomUserClaims(userRecord.uid, { role });

      // Generate password reset link (24 hour expiration)
      console.log('Generating password reset link...');
      const actionCodeSettings = {
        url: 'https://vantageflow.vercel.app', // Redirect to Vercel-hosted app after password reset
        handleCodeInApp: false,
      };
      const resetLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
      console.log('Password reset link generated');

      // Get email configuration
      const emailConfig = functions.config().email;
      const emailUserValue = emailConfig?.user;
      const emailPasswordValue = emailConfig?.password;
      console.log(`Email config - user: ${emailUserValue ? 'set' : 'not set'}, password: ${emailPasswordValue ? 'set' : 'not set'}`);

      // Send email using Nodemailer
      if (emailUserValue && emailPasswordValue) {
        console.log('Configuring email transporter...');
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: emailUserValue,
            pass: emailPasswordValue,
          },
        });

        console.log('Preparing email...');
        const mailOptions = {
          from: `VantageFlow <${emailUserValue}>`,
          to: email,
          subject: 'You have been invited to VantageFlow',
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3b82f6;">Welcome to VantageFlow!</h2>
            <p>You have been invited to join VantageFlow as a <strong>${role}</strong>.</p>
            <p>To get started, please set your password by clicking the link below:</p>
            <div style="margin: 30px 0;">
              <a href="${resetLink}" 
                 style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Set Your Password
              </a>
            </div>
            <p style="color: #64748b; font-size: 14px;">
              This link will expire in 24 hours. If you didn't expect this invitation, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            <p style="color: #94a3b8; font-size: 12px;">
              VantageFlow - Project Management & KPI Dashboard
            </p>
          </div>
        `,
        };

        console.log(`Sending email to ${email}...`);
        await transporter.sendMail(mailOptions);
        console.log(`Invitation email sent successfully to ${email}`);
      } else {
        console.warn('Email configuration not set. User created but invitation email not sent.');
      }

      console.log(`User invited successfully: ${email} with role ${role}`);

      return {
        success: true,
        message: `Invitation email sent to ${email}`,
      };
    } catch (error: any) {
      console.error('Error inviting user:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);

      if (error.code === 'already-exists') {
        throw error;
      }
      throw new functions.https.HttpsError('internal', `Failed to invite user: ${error.message}`);
    }
  });

