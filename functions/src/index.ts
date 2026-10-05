import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';
import {
  getInvitationEmail,
  getReminderEmail,
  getNewMemberEmail,
  getResponsibilityAssignedEmail,
  getAchievementEmail,
  getProjectArchivedEmail
} from './emailTemplates';

// Base web app URL
const APP_URL = process.env.APP_URL || 'https://vantageflow.vercel.app';

// Prevent double initialization
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Creates a cryptographically secure 48-hour invitation token in Firestore (`invites/{token}`)
 * and invalidates any previous pending invite tokens for the same email.
 */
const createInviteToken = async (email: string, role: string, createdBy?: string): Promise<string> => {
  const normalizedEmail = email.toLowerCase().trim();
  const db = admin.firestore();

  // Invalidate any existing pending invites for this email
  const existingInvites = await db.collection('invites')
    .where('email', '==', normalizedEmail)
    .where('used', '==', false)
    .get();

  const batch = db.batch();
  existingInvites.docs.forEach((doc) => {
    batch.update(doc.ref, {
      used: true,
      invalidated: true,
      invalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  const token = crypto.randomBytes(32).toString('hex');
  const inviteRef = db.collection('invites').doc(token);

  // Exactly 48 hours expiration
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  batch.set(inviteRef, {
    token,
    email: normalizedEmail,
    role,
    createdBy: createdBy || 'admin',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    used: false,
  });

  await batch.commit();
  console.log(`[createInviteToken] Created 48-hour invite token for ${normalizedEmail}, expires at: ${expiresAt.toISOString()}`);
  return token;
};

interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: string;
  createdAt: string;
  lastSignIn?: string;
  phoneNumber?: string;
}

// Helpers for checking admin / superadmin status
const isSuperAdminUser = (userRecord: admin.auth.UserRecord) => {
  return userRecord.email?.toLowerCase() === 'talgans@gmail.com' || userRecord.customClaims?.role === 'superadmin';
};

const isAdminUser = (userRecord: admin.auth.UserRecord) => {
  return isSuperAdminUser(userRecord) || userRecord.customClaims?.role === 'admin';
};

// --- Helper for creating Nodemailer transporter using Gmail SMTP ---
const createTransporter = () => {
  const emailUser = process.env.EMAIL_USER || functions.config().email?.user;
  const emailPassword = process.env.EMAIL_PASSWORD || functions.config().email?.password;

  if (!emailUser || !emailPassword) {
    console.error('[sendEmail] ERROR: Email configuration not set. Missing EMAIL_USER or EMAIL_PASSWORD.');
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });
};

// --- Helper for sending emails via Gmail SMTP ---
const sendEmail = async (to: string, subject: string, html: string): Promise<boolean> => {
  console.log(`[sendEmail] Attempting to send email to: ${to}`);
  console.log(`[sendEmail] Subject: ${subject}`);

  const transporter = createTransporter();
  if (!transporter) {
    return false;
  }

  const emailUser = process.env.EMAIL_USER || functions.config().email?.user;

  try {
    console.log('[sendEmail] Sending email via Gmail SMTP...');
    const info = await transporter.sendMail({
      from: `"VantageFlow" <${emailUser}>`,
      to,
      subject,
      html,
    });

    console.log(`[sendEmail] Email sent successfully! Message ID: ${info.messageId}`);
    return true;
  } catch (error: any) {
    console.error('[sendEmail] Gmail SMTP error:', error.message || error);
    return false;
  }
};

// --- Helper for creating in-app notification ---
const createNotification = async (userId: string, type: string, message: string, projectId: string, projectName: string, link?: string) => {
  await admin.firestore().collection('notifications').add({
    userId,
    type,
    message,
    projectId,
    projectName,
    link,
    read: false,
    emailSent: true, // We assume email is attempted if we are here
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};


/**
 * List all users (Admin and Manager)
 * Managers need this to assign team members when creating projects
 */
export const listUsers = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!(context as any).auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Check if user is admin, superadmin, or manager
  const callerToken = await admin.auth().getUser((context as any).auth.uid);
  const userRole = callerToken.customClaims?.role;
  if (!isAdminUser(callerToken) && userRole !== 'manager') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins and managers can list users');
  }

  try {
    const listUsersResult = await admin.auth().listUsers(1000);

    const users: UserData[] = listUsersResult.users.map(user => ({
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName,
      photoURL: user.photoURL,
      role: user.email?.toLowerCase() === 'talgans@gmail.com' ? 'superadmin' : (user.customClaims?.role || 'member'),
      createdAt: user.metadata.creationTime,
      lastSignIn: user.metadata.lastSignInTime,
      phoneNumber: user.phoneNumber,
    }));

    return { users };
  } catch (error) {
    console.error('Error listing users:', error);
    throw new functions.https.HttpsError('internal', 'Failed to list users');
  }
});

/**
 * Get public user directory (Available to all authenticated users)
 * Returns basic info for leaderboard and team display
 */
export const getPublicDirectory = functions.https.onCall(async (data, context) => {
  if (!(context as any).auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const users: UserData[] = [];
    let nextPageToken;

    // Fetch all users with pagination
    do {
      const result: admin.auth.ListUsersResult = await admin.auth().listUsers(1000, nextPageToken);
      result.users.forEach(user => {
        users.push({
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: user.email?.toLowerCase() === 'talgans@gmail.com' ? 'superadmin' : (user.customClaims?.role || 'member'),
          createdAt: user.metadata.creationTime,
          lastSignIn: user.metadata.lastSignInTime,
          phoneNumber: user.phoneNumber,
        });
      });
      nextPageToken = result.pageToken;
    } while (nextPageToken);

    return { users };
  } catch (error) {
    console.error('Error getting public directory:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get user directory');
  }
});

/**
 * Set user role (Admin or SuperAdmin only)
 */
export const setUserRole = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!(context as any).auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Check if user is admin or superadmin
  const callerToken = await admin.auth().getUser((context as any).auth.uid);
  if (!isAdminUser(callerToken)) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can set user roles');
  }

  const { uid, role } = data as any;

  // Validate role - accept any non-empty string (supports custom roles)
  if (!role || typeof role !== 'string' || role.trim().length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid role. Role must be a non-empty string');
  }

  try {
    // Get the user's current role before changing
    const targetUser = await admin.auth().getUser(uid);
    const previousRole = targetUser.email?.toLowerCase() === 'talgans@gmail.com' ? 'superadmin' : (targetUser.customClaims?.role || 'member');

    // Security: The primary SuperAdmin (talgans@gmail.com) can NEVER have their role altered
    if (targetUser.email?.toLowerCase() === 'talgans@gmail.com') {
      throw new functions.https.HttpsError('permission-denied', 'Cannot modify the role of the primary SuperAdmin (talgans@gmail.com)');
    }

    // Security: Only SuperAdmins can assign or alter the superadmin role
    if ((role === 'superadmin' || targetUser.customClaims?.role === 'superadmin') && !isSuperAdminUser(callerToken)) {
      throw new functions.https.HttpsError('permission-denied', 'Only SuperAdmins can grant or revoke the SuperAdmin role');
    }

    // Set the new role
    await admin.auth().setCustomUserClaims(uid, { role });

    // If role actually changed, create a forceLogout document to notify the user
    if (previousRole !== role) {
      await admin.firestore().collection('forceLogout').doc(uid).set({
        reason: 'role_changed',
        previousRole,
        newRole: role,
        changedAt: admin.firestore.FieldValue.serverTimestamp(),
        changedBy: (context as any).auth.uid,
        message: `Your role has been changed from ${previousRole} to ${role}. You will be logged out in 60 seconds to apply the new permissions.`
      });
    }

    return { success: true, message: `User role set to ${role}` };
  } catch (error) {
    console.error('Error setting user role:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to set user role');
  }
});

/**
 * Delete user (Admin or SuperAdmin only)
 */
export const deleteUser = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!(context as any).auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Check if user is admin or superadmin
  const callerToken = await admin.auth().getUser((context as any).auth.uid);
  if (!isAdminUser(callerToken)) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can delete users');
  }

  const { uid } = data as any;

  // Prevent self-deletion
  if (uid === (context as any).auth.uid) {
    throw new functions.https.HttpsError('invalid-argument', 'Cannot delete your own account');
  }

  try {
    const targetUser = await admin.auth().getUser(uid);

    // Security: The primary SuperAdmin (talgans@gmail.com) can NEVER be deleted
    if (targetUser.email?.toLowerCase() === 'talgans@gmail.com') {
      throw new functions.https.HttpsError('permission-denied', 'The primary SuperAdmin (talgans@gmail.com) cannot be deleted');
    }

    // Security: Only SuperAdmins can delete another SuperAdmin
    if (targetUser.customClaims?.role === 'superadmin' && !isSuperAdminUser(callerToken)) {
      throw new functions.https.HttpsError('permission-denied', 'Only SuperAdmins can delete a SuperAdmin user');
    }

    await admin.auth().deleteUser(uid);
    return { success: true, message: 'User deleted successfully' };
  } catch (error) {
    console.error('Error deleting user:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to delete user');
  }
});

/**
 * Update user profile (Admin or SuperAdmin only for other users)
 * Allows admin to update display name and photoURL for any user
 */
export const updateUserProfile = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!(context as any).auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { uid, displayName, photoURL, phoneNumber } = data as any;

  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
  }

  // Check if user is admin, superadmin, or updating their own profile
  const callerUid = (context as any).auth.uid;
  const callerToken = await admin.auth().getUser(callerUid);
  if (callerUid !== uid && !isAdminUser(callerToken)) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can update other user profiles');
  }

  try {
    const updateData: { displayName?: string; photoURL?: string; phoneNumber?: string } = {};

    if (displayName !== undefined) {
      updateData.displayName = displayName;
    }

    if (photoURL !== undefined) {
      updateData.photoURL = photoURL;
    }

    if (phoneNumber !== undefined) {
      updateData.phoneNumber = phoneNumber;
    }

    await admin.auth().updateUser(uid, updateData);
    return { success: true, message: 'User profile updated successfully' };
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw new functions.https.HttpsError('internal', 'Failed to update user profile');
  }
});

/**
 * Configure Storage CORS (Admin or SuperAdmin only)
 * Fixes CORS issues for file uploads
 */
export const configureCors = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is authenticated
    if (!(context as any).auth) {
      return { success: false, error: 'User must be authenticated' };
    }

    const callerToken = await admin.auth().getUser((context as any).auth.uid);
    if (!isAdminUser(callerToken)) {
      return { success: false, error: 'Only admins can invoke this function' };
    }
    const bucket = admin.storage().bucket('vantageflow.firebasestorage.app');

    // Check if bucket exists
    const [exists] = await bucket.exists();
    if (!exists) {
      return { success: false, error: 'Bucket vantageflow.firebasestorage.app does not exist' };
    }

    const corsConfig = [
      {
        origin: ["*"],
        method: ["GET", "PUT", "POST", "DELETE", "HEAD", "OPTIONS"],
        responseHeader: ["Content-Type", "Authorization", "Content-Length", "User-Agent", "x-goog-resumable"],
        maxAgeSeconds: 3600
      }
    ];

    try {
      // Try preferred method
      await bucket.setCorsConfiguration(corsConfig);
    } catch (e) {
      console.log('setCorsConfiguration failed, trying setMetadata...', e);
      // Fallback to setMetadata which is lower level
      await bucket.setMetadata({ cors: corsConfig });
    }

    return { success: true, message: `CORS configured for bucket: ${bucket.name}` };
  } catch (error: any) {
    console.error('Error configuring CORS:', error);
    // Return error as result instead of throwing to avoid CORS errors on client
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
});

/**
 * Invite user via email (Admin or SuperAdmin only)
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

    // Check if user is admin or superadmin
    const callerToken = await admin.auth().getUser((context as any).auth.uid);
    console.log(`Caller role: ${callerToken.customClaims?.role}`);

    if (!isAdminUser(callerToken)) {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can invite users');
    }

    const { email, role } = data;
    console.log(`Attempting to invite: ${email} with role: ${role}`);

    // Validate role: admin or superadmin must be assigned after signup
    if (!role || typeof role !== 'string' || role.trim().length === 0 || role === 'admin' || role === 'superadmin') {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid role. Administrative roles must be assigned after signup from Users & Roles');
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

      // Generate secure 48-hour invitation token and setup link
      console.log('Generating 48-hour secure invitation token...');
      const setupToken = await createInviteToken(email, role, (context as any).auth?.uid);
      const setupLink = `${APP_URL}/?setupToken=${setupToken}&email=${encodeURIComponent(email)}`;

      const html = getInvitationEmail(role, setupLink);

      const emailSent = await sendEmail(email, 'VantageFlow: Your Account Setup Link', html);
      if (!emailSent) {
        throw new functions.https.HttpsError(
          'internal',
          `User account was created, but failed to send invitation email to ${email}. Please check SMTP configuration or use the Send Reminder button.`
        );
      }

      return {
        success: true,
        message: `Invitation email sent to ${email}`,
      };
    } catch (error: any) {
      console.error('Error inviting user:', error);
      if (error.code === 'already-exists') throw error;
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', `Failed to invite user: ${error.message}`);
    }
  });


/**
 * Send reminder email to existing user who hasn't logged in (Admin or SuperAdmin only)
 * Generates a new password reset link and sends it
 */
export const sendReminderEmail = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB'
  })
  .https.onCall(async (data: any, context) => {
    // Check if user is authenticated
    if (!(context as any).auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Check if user is admin or superadmin
    const callerToken = await admin.auth().getUser((context as any).auth.uid);
    if (!isAdminUser(callerToken)) {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can send reminder emails');
    }

    const { email } = data;

    if (!email || !email.includes('@')) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid email address');
    }

    try {
      // Get the existing user
      const existingUser = await admin.auth().getUserByEmail(email);

      // Check if user has already logged in
      if (existingUser.metadata.lastSignInTime) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'This user has already logged in. Password reset is not needed.'
        );
      }

      const role = existingUser.customClaims?.role || 'member';

      // Generate fresh 48-hour invitation token for reminder
      console.log('Generating fresh 48-hour secure invitation token for reminder...');
      const setupToken = await createInviteToken(email, role, (context as any).auth?.uid);
      const setupLink = `${APP_URL}/?setupToken=${setupToken}&email=${encodeURIComponent(email)}`;

      const html = getReminderEmail(role, setupLink);

      const emailSent = await sendEmail(email, 'VantageFlow: Action Required - Complete Your Account Setup', html);
      if (!emailSent) {
        throw new functions.https.HttpsError(
          'internal',
          `Failed to deliver reminder email to ${email}. Please check SMTP configuration.`
        );
      }

      return {
        success: true,
        message: `Reminder email sent to ${email}`,
      };
    } catch (error: any) {
      console.error('Error sending reminder:', error);
      if (error.code === 'auth/user-not-found') {
        throw new functions.https.HttpsError('not-found', 'User not found. Please invite them first.');
      }
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', `Failed to send reminder: ${error.message}`);
    }
  });/**
 * Notify project team when a new member is added
 */
export const notifyProjectMemberAdded = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB'
  })
  .https.onCall(async (data, context) => {
    if (!(context as any).auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authenticated user required');
    }

    const { projectId, projectName, newMemberEmail, newMemberName, teamEmails } = data;
    const inviterName = (context as any).auth.token.name || (context as any).auth.token.email;

    const subject = `New Team Member: ${newMemberName || newMemberEmail}`;
    const link = `https://vantageflow.vercel.app/project/${projectId}`;
    const html = getNewMemberEmail(newMemberName || newMemberEmail, projectName, inviterName, link);

    const validEmails = (teamEmails as string[] || []).filter(e => e && e.includes('@'));

    // Note: For large teams, consider individual sending or BCC to avoid exposing all emails if privacy is concern
    // For internal teams, iterating is fine
    const promises = validEmails.map(email => sendEmail(email, subject, html));
    await Promise.all(promises);

    // Send in-app notification to the new member? Or team? 
    // Requirement: "Notify team when new member is added"
    // We'll simplisticly assume we notify the TEAM that a new member joined.
    // We'll also notify the NEW MEMBER that they were added.

    // Need UIDs to create in-app notifications. Typically passed or looked up.
    // For now, we will just count on emails if we don't have UIDs passed in data.
    // Ideally client passes member UIDs.

    return { success: true };
  });

/**
 * Notify assignees of responsibility
 */
export const notifyResponsibilityAssigned = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB'
  })
  .https.onCall(async (data, context) => {
    if (!(context as any).auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authenticated user required');
    }

    const { projectId, projectName, itemType, itemName, assignees } = data;
    // assignees: { uid: string, email: string, displayName: string }[]
    const assignerName = (context as any).auth.token.name || (context as any).auth.token.email;

    const subject = `New Responsibility: ${itemName}`;
    const link = `https://vantageflow.vercel.app/project/${projectId}`;
    const html = getResponsibilityAssignedEmail(itemType, itemName, projectName, assignerName, link);

    // Send emails and create notifications
    const promises = (assignees as any[]).map(async (member) => {
      if (member.email) {
        await sendEmail(member.email, subject, html);
      }
      if (member.uid) {
        await createNotification(
          member.uid,
          'responsibility_assigned',
          `Assigned to ${itemType}: ${itemName} in ${projectName}`,
          projectId,
          projectName,
          link
        );
      }
    });

    await Promise.all(promises);
    return { success: true };
  });

// NOTE: Dynamic user lookup via useUserLookup hook is now used on the client.
/**
 * Listen for new achievements and notify user/team
 */
export const onAchievementAwarded = functions.firestore
  .document('achievements/{achievementId}')
  .onCreate(async (snap, context) => {
    const achievement = snap.data();
    const { userId, points, category, description, projectId } = achievement;

    console.log(`[onAchievementAwarded] New achievement for ${userId}: ${points} pts (${category})`);

    try {
      const userRecord = await admin.auth().getUser(userId);
      const userEmail = userRecord.email;
      const userName = userRecord.displayName || userEmail?.split('@')[0] || 'User';

      // 1. Notify the User (Email) if significant achievement
      if (userEmail && (category === 'phase_complete' || category === 'milestone' || points >= 50)) {
        const subject = `Congratulations! You earned ${points} points!`;
        const html = getAchievementEmail(userName, points, description);
        await sendEmail(userEmail, subject, html);
      }

      // 2. Notify Teammates
      if (projectId) {
        const projectDoc = await admin.firestore().collection('projects').doc(projectId).get();
        if (projectDoc.exists) {
          const projectData = projectDoc.data();
          const projectName = projectData?.name || 'Unknown Project';
          const teamMembers = projectData?.team?.members || [];

          const notifyPromises = teamMembers.map(async (member: any) => {
            // Don't notify the user who got the award
            if (member.uid === userId) return;

            const message = `${userName} earned ${points} pts in ${projectName}!`;

            // Create In-App Notification
            await createNotification(
              member.uid,
              'achievement_celebration',
              message,
              projectId,
              projectName
            );
          });

          await Promise.all(notifyPromises);
        }
      }

    } catch (error) {
      console.error('[onAchievementAwarded] Error processing achievement:', error);
    }
  });

/**
 * Listen for project archive status changes and notify team
 */
export const onProjectArchiveStatusChange = functions.firestore
  .document('projects/{projectId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const projectId = context.params.projectId;

    // Check if isArchived changed
    const wasArchived = before.isArchived === true;
    const isNowArchived = after.isArchived === true;

    if (wasArchived === isNowArchived) {
      // No change in archive status
      return null;
    }

    console.log(`[onProjectArchiveStatusChange] Project ${projectId} archive status: ${wasArchived} -> ${isNowArchived}`);

    const projectName = after.name || 'Unknown Project';
    const archivedBy = after.archivedBy;
    const teamMembers = after.team?.members || [];
    const link = `https://vantageflow.vercel.app/project/${projectId}`;

    // Get the name of who archived
    let actionByName = 'an administrator';
    if (archivedBy) {
      try {
        const userRecord = await admin.auth().getUser(archivedBy);
        actionByName = userRecord.displayName || userRecord.email || 'an administrator';
      } catch (e) {
        console.warn(`Could not get user info for ${archivedBy}`);
      }
    }

    const subject = `Project ${isNowArchived ? 'Archived' : 'Unarchived'}: ${projectName}`;
    const html = getProjectArchivedEmail(projectName, actionByName, isNowArchived, link);

    const notifyPromises = teamMembers.map(async (member: any) => {
      // Send email
      if (member.email) {
        await sendEmail(member.email, subject, html);
      }

      // Create in-app notification
      if (member.uid) {
        const message = `Project "${projectName}" has been ${isNowArchived ? 'archived' : 'unarchived'} by ${actionByName}.`;
        await createNotification(
          member.uid,
          'project_archived',
          message,
          projectId,
          projectName,
          link
        );
      }
    });

    await Promise.all(notifyPromises);
    console.log(`[onProjectArchiveStatusChange] Notifications sent to ${teamMembers.length} team members.`);
    return null;
  });

/**
 * Validate an invitation token before displaying the setup form
 */
export const validateInviteToken = functions
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .https.onCall(async (data: any) => {
    const { token } = data || {};
    if (!token || typeof token !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid or missing invitation token');
    }

    try {
      const inviteDoc = await admin.firestore().collection('invites').doc(token).get();
      if (!inviteDoc.exists) {
        return { valid: false, reason: 'not_found', message: 'Invitation link is invalid.' };
      }

      const invite = inviteDoc.data()!;
      if (invite.used) {
        return {
          valid: false,
          reason: invite.invalidated ? 'superseded' : 'already_used',
          message: invite.invalidated
            ? 'This invitation link was superseded by a newer reminder email. Please use the link in the most recent email.'
            : 'This invitation link has already been used. Please sign in with your email and password.'
        };
      }

      const expiresAt = invite.expiresAt?.toDate ? invite.expiresAt.toDate() : new Date(invite.expiresAt);
      if (Date.now() > expiresAt.getTime()) {
        return {
          valid: false,
          reason: 'expired',
          message: 'This invitation link has expired (valid for 48 hours). Please ask your administrator to send a new invite.'
        };
      }

      return {
        valid: true,
        email: invite.email,
        role: invite.role,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (error: any) {
      console.error('Error validating invite token:', error);
      throw new functions.https.HttpsError('internal', 'Failed to validate invitation token');
    }
  });

/**
 * Complete account setup: validates 48-hour invite token, sets user password, and returns a custom token for auto-login
 */
export const completeAccountSetup = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data: any) => {
    const { token, password, displayName } = data || {};

    if (!token || typeof token !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid or missing invitation token');
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters long');
    }

    const db = admin.firestore();
    const inviteRef = db.collection('invites').doc(token);
    const inviteDoc = await inviteRef.get();

    if (!inviteDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Invalid invitation link');
    }

    const invite = inviteDoc.data()!;

    if (invite.used) {
      const msg = invite.invalidated
        ? 'This invitation link was superseded by a newer reminder email. Please use the most recent email link.'
        : 'This invitation link has already been used. Please sign in with your email and password.';
      throw new functions.https.HttpsError('failed-precondition', msg);
    }

    const expiresAt = invite.expiresAt?.toDate ? invite.expiresAt.toDate() : new Date(invite.expiresAt);
    if (Date.now() > expiresAt.getTime()) {
      throw new functions.https.HttpsError(
        'deadline-exceeded',
        'This invitation link has expired after 48 hours. Please request a new invite from your administrator.'
      );
    }

    try {
      // Find the user in Firebase Auth
      const userRecord = await admin.auth().getUserByEmail(invite.email);

      // Update password, displayName, and mark emailVerified = true
      const updateData: admin.auth.UpdateRequest = {
        password,
        emailVerified: true,
      };

      if (displayName && typeof displayName === 'string' && displayName.trim().length > 0) {
        updateData.displayName = displayName.trim();
      }

      await admin.auth().updateUser(userRecord.uid, updateData);

      // Ensure custom claims for role are set
      if (invite.role) {
        await admin.auth().setCustomUserClaims(userRecord.uid, { role: invite.role });
      }

      // Try to generate custom token if IAM permission exists, but do not fail account setup if signBlob is not configured
      let customToken: string | null = null;
      try {
        customToken = await admin.auth().createCustomToken(userRecord.uid);
      } catch (tokenErr: any) {
        console.warn(
          '[completeAccountSetup] Could not create custom token (iam.serviceAccounts.signBlob permission not configured). Client will authenticate using email and password.',
          tokenErr?.message
        );
      }

      // Mark invite as used
      await inviteRef.update({
        used: true,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        message: 'Account setup completed successfully!',
        customToken,
        email: invite.email,
        role: invite.role,
      };
    } catch (error: any) {
      console.error('Error completing account setup:', error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', `Failed to complete account setup: ${error.message}`);
    }
  });
