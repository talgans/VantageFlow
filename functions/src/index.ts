import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { Resend } from 'resend';
import {
  getInvitationEmail,
  getReminderEmail,
  getNewMemberEmail,
  getResponsibilityAssignedEmail,
  getAchievementEmail,
  getProjectArchivedEmail
} from './emailTemplates';

// Prevent double initialization
if (admin.apps.length === 0) {
  admin.initializeApp();
}

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

// --- Helper for sending emails via Resend ---
const sendEmail = async (to: string, subject: string, html: string): Promise<boolean> => {
  console.log(`[sendEmail] Attempting to send email to: ${to}`);
  console.log(`[sendEmail] Subject: ${subject}`);

  const resendApiKey = functions.config().resend?.api_key;

  if (!resendApiKey) {
    console.error('[sendEmail] ERROR: Resend API key not set. Email not sent.');
    return false;
  }

  console.log(`[sendEmail] API key found (first 10 chars): ${resendApiKey.substring(0, 10)}...`);

  try {
    const resend = new Resend(resendApiKey);

    console.log('[sendEmail] Calling Resend API...');
    const { data, error } = await resend.emails.send({
      from: 'VantageFlow <vantage@intellisys.xyz>',
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error('[sendEmail] Resend API error:', JSON.stringify(error));
      return false;
    }

    console.log(`[sendEmail] Email sent successfully! Resend ID: ${data?.id}`);
    return true;
  } catch (error: any) {
    console.error('[sendEmail] Exception caught:', error.message || error);
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

  // Check if user is admin or manager
  const callerToken = await admin.auth().getUser((context as any).auth.uid);
  const userRole = callerToken.customClaims?.role;
  if (!userRole || (userRole !== 'admin' && userRole !== 'manager')) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins and managers can list users');
  }

  try {
    const listUsersResult = await admin.auth().listUsers(1000);

    const users: UserData[] = listUsersResult.users.map(user => ({
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName,
      photoURL: user.photoURL,
      role: user.customClaims?.role || 'member',
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
          role: user.customClaims?.role || 'member',
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

  // Validate role - accept any non-empty string (supports custom roles)
  if (!role || typeof role !== 'string' || role.trim().length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid role. Role must be a non-empty string');
  }

  try {
    // Get the user's current role before changing
    const targetUser = await admin.auth().getUser(uid);
    const previousRole = targetUser.customClaims?.role || 'member';

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
 * Update user profile (Admin only for other users)
 * Allows admin to update display name and photoURL for any user
 */
export const updateUserProfile = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!(context as any).auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Check if user is admin
  const callerToken = await admin.auth().getUser((context as any).auth.uid);
  if (!callerToken.customClaims?.role || callerToken.customClaims.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can update other user profiles');
  }

  const { uid, displayName, photoURL, phoneNumber } = data as any;

  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
  }

  try {
    const updateData: { displayName?: string; photoURL?: string } = {};

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
 * Configure Storage CORS (Admin only)
 * Fixes CORS issues for file uploads
 */
export const configureCors = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is authenticated
    if (!(context as any).auth) {
      return { success: false, error: 'User must be authenticated' };
    }

    const callerToken = await admin.auth().getUser((context as any).auth.uid);
    if (!callerToken.customClaims?.role || callerToken.customClaims.role !== 'admin') {
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

    // Validate role
    if (!role || typeof role !== 'string' || role.trim().length === 0 || role === 'admin') {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid role. Cannot invite as admin; admin role must be assigned after signup');
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

      // Generate password reset link with 24-hour expiration
      console.log('Generating password reset link with 24-hour expiration...');
      const actionCodeSettings = {
        url: 'https://vantageflow.vercel.app',
        handleCodeInApp: false,
        expiresIn: 86400000, // 24 hours in milliseconds
      };
      const resetLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);

      const html = getInvitationEmail(role, resetLink);

      await sendEmail(email, 'VantageFlow: Your Account Setup Link', html);

      return {
        success: true,
        message: `Invitation email sent to ${email}`,
      };
    } catch (error: any) {
      console.error('Error inviting user:', error);
      if (error.code === 'already-exists') throw error;
      throw new functions.https.HttpsError('internal', `Failed to invite user: ${error.message}`);
    }
  });


/**
 * Send reminder email to existing user who hasn't logged in (Admin only)
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

    // Check if user is admin
    const callerToken = await admin.auth().getUser((context as any).auth.uid);
    if (!callerToken.customClaims?.role || callerToken.customClaims.role !== 'admin') {
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

      // Generate a new password reset link with 24-hour expiration
      const actionCodeSettings = {
        url: 'https://vantageflow.vercel.app',
        handleCodeInApp: false,
        expiresIn: 86400000, // 24 hours in milliseconds
      };
      const resetLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);

      const html = getReminderEmail(role, resetLink);

      await sendEmail(email, 'VantageFlow: Action Required - Complete Your Account Setup', html);

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
