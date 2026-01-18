"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onAchievementAwarded = exports.notifyResponsibilityAssigned = exports.notifyProjectMemberAdded = exports.sendReminderEmail = exports.inviteUser = exports.configureCors = exports.updateUserProfile = exports.deleteUser = exports.setUserRole = exports.getPublicDirectory = exports.listUsers = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const resend_1 = require("resend");
// Prevent double initialization
if (admin.apps.length === 0) {
    admin.initializeApp();
}
// --- Helper for sending emails via Resend ---
const sendEmail = async (to, subject, html) => {
    var _a;
    console.log(`[sendEmail] Attempting to send email to: ${to}`);
    console.log(`[sendEmail] Subject: ${subject}`);
    const resendApiKey = (_a = functions.config().resend) === null || _a === void 0 ? void 0 : _a.api_key;
    if (!resendApiKey) {
        console.error('[sendEmail] ERROR: Resend API key not set. Email not sent.');
        return false;
    }
    console.log(`[sendEmail] API key found (first 10 chars): ${resendApiKey.substring(0, 10)}...`);
    try {
        const resend = new resend_1.Resend(resendApiKey);
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
        console.log(`[sendEmail] Email sent successfully! Resend ID: ${data === null || data === void 0 ? void 0 : data.id}`);
        return true;
    }
    catch (error) {
        console.error('[sendEmail] Exception caught:', error.message || error);
        return false;
    }
};
// --- Helper for creating in-app notification ---
const createNotification = async (userId, type, message, projectId, projectName, link) => {
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
exports.listUsers = functions.https.onCall(async (data, context) => {
    var _a;
    // Check if user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // Check if user is admin or manager
    const callerToken = await admin.auth().getUser(context.auth.uid);
    const userRole = (_a = callerToken.customClaims) === null || _a === void 0 ? void 0 : _a.role;
    if (!userRole || (userRole !== 'admin' && userRole !== 'manager')) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins and managers can list users');
    }
    try {
        const listUsersResult = await admin.auth().listUsers(1000);
        const users = listUsersResult.users.map(user => {
            var _a;
            return ({
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName,
                photoURL: user.photoURL,
                role: ((_a = user.customClaims) === null || _a === void 0 ? void 0 : _a.role) || 'member',
                createdAt: user.metadata.creationTime,
                lastSignIn: user.metadata.lastSignInTime,
            });
        });
        return { users };
    }
    catch (error) {
        console.error('Error listing users:', error);
        throw new functions.https.HttpsError('internal', 'Failed to list users');
    }
});
/**
 * Get public user directory (Available to all authenticated users)
 * Returns basic info for leaderboard and team display
 */
exports.getPublicDirectory = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    try {
        const users = [];
        let nextPageToken;
        // Fetch all users with pagination
        do {
            const result = await admin.auth().listUsers(1000, nextPageToken);
            result.users.forEach(user => {
                var _a;
                users.push({
                    uid: user.uid,
                    email: user.email || '',
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    role: ((_a = user.customClaims) === null || _a === void 0 ? void 0 : _a.role) || 'member',
                    createdAt: user.metadata.creationTime,
                    lastSignIn: user.metadata.lastSignInTime,
                });
            });
            nextPageToken = result.pageToken;
        } while (nextPageToken);
        return { users };
    }
    catch (error) {
        console.error('Error getting public directory:', error);
        throw new functions.https.HttpsError('internal', 'Failed to get user directory');
    }
});
/**
 * Set user role (Admin only)
 */
exports.setUserRole = functions.https.onCall(async (data, context) => {
    var _a, _b;
    // Check if user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // Check if user is admin
    const callerToken = await admin.auth().getUser(context.auth.uid);
    if (!((_a = callerToken.customClaims) === null || _a === void 0 ? void 0 : _a.role) || callerToken.customClaims.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can set user roles');
    }
    const { uid, role } = data;
    // Validate role - accept any non-empty string (supports custom roles)
    if (!role || typeof role !== 'string' || role.trim().length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid role. Role must be a non-empty string');
    }
    try {
        // Get the user's current role before changing
        const targetUser = await admin.auth().getUser(uid);
        const previousRole = ((_b = targetUser.customClaims) === null || _b === void 0 ? void 0 : _b.role) || 'member';
        // Set the new role
        await admin.auth().setCustomUserClaims(uid, { role });
        // If role actually changed, create a forceLogout document to notify the user
        if (previousRole !== role) {
            await admin.firestore().collection('forceLogout').doc(uid).set({
                reason: 'role_changed',
                previousRole,
                newRole: role,
                changedAt: admin.firestore.FieldValue.serverTimestamp(),
                changedBy: context.auth.uid,
                message: `Your role has been changed from ${previousRole} to ${role}. You will be logged out in 60 seconds to apply the new permissions.`
            });
        }
        return { success: true, message: `User role set to ${role}` };
    }
    catch (error) {
        console.error('Error setting user role:', error);
        throw new functions.https.HttpsError('internal', 'Failed to set user role');
    }
});
/**
 * Delete user (Admin only)
 */
exports.deleteUser = functions.https.onCall(async (data, context) => {
    var _a;
    // Check if user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // Check if user is admin
    const callerToken = await admin.auth().getUser(context.auth.uid);
    if (!((_a = callerToken.customClaims) === null || _a === void 0 ? void 0 : _a.role) || callerToken.customClaims.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can delete users');
    }
    const { uid } = data;
    // Prevent self-deletion
    if (uid === context.auth.uid) {
        throw new functions.https.HttpsError('invalid-argument', 'Cannot delete your own account');
    }
    try {
        await admin.auth().deleteUser(uid);
        return { success: true, message: 'User deleted successfully' };
    }
    catch (error) {
        console.error('Error deleting user:', error);
        throw new functions.https.HttpsError('internal', 'Failed to delete user');
    }
});
/**
 * Update user profile (Admin only for other users)
 * Allows admin to update display name and photoURL for any user
 */
exports.updateUserProfile = functions.https.onCall(async (data, context) => {
    var _a;
    // Check if user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // Check if user is admin
    const callerToken = await admin.auth().getUser(context.auth.uid);
    if (!((_a = callerToken.customClaims) === null || _a === void 0 ? void 0 : _a.role) || callerToken.customClaims.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can update other user profiles');
    }
    const { uid, displayName, photoURL } = data;
    if (!uid) {
        throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
    }
    try {
        const updateData = {};
        if (displayName !== undefined) {
            updateData.displayName = displayName;
        }
        if (photoURL !== undefined) {
            updateData.photoURL = photoURL;
        }
        await admin.auth().updateUser(uid, updateData);
        return { success: true, message: 'User profile updated successfully' };
    }
    catch (error) {
        console.error('Error updating user profile:', error);
        throw new functions.https.HttpsError('internal', 'Failed to update user profile');
    }
});
/**
 * Configure Storage CORS (Admin only)
 * Fixes CORS issues for file uploads
 */
exports.configureCors = functions.https.onCall(async (data, context) => {
    var _a;
    try {
        // Check if user is authenticated
        if (!context.auth) {
            return { success: false, error: 'User must be authenticated' };
        }
        const callerToken = await admin.auth().getUser(context.auth.uid);
        if (!((_a = callerToken.customClaims) === null || _a === void 0 ? void 0 : _a.role) || callerToken.customClaims.role !== 'admin') {
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
        }
        catch (e) {
            console.log('setCorsConfiguration failed, trying setMetadata...', e);
            // Fallback to setMetadata which is lower level
            await bucket.setMetadata({ cors: corsConfig });
        }
        return { success: true, message: `CORS configured for bucket: ${bucket.name}` };
    }
    catch (error) {
        console.error('Error configuring CORS:', error);
        // Return error as result instead of throwing to avoid CORS errors on client
        return { success: false, error: error.message || 'Unknown error occurred' };
    }
});
/**
 * Invite user via email (Admin only)
 * Creates a user account with specified role
 */
exports.inviteUser = functions
    .runWith({
    timeoutSeconds: 60,
    memory: '256MB'
})
    .https.onCall(async (data, context) => {
    var _a, _b;
    // Check if user is authenticated
    if (!context.auth) {
        console.error('inviteUser called without authentication');
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    console.log(`inviteUser called by: ${context.auth.uid}`);
    // Check if user is admin
    const callerToken = await admin.auth().getUser(context.auth.uid);
    console.log(`Caller role: ${(_a = callerToken.customClaims) === null || _a === void 0 ? void 0 : _a.role}`);
    if (!((_b = callerToken.customClaims) === null || _b === void 0 ? void 0 : _b.role) || callerToken.customClaims.role !== 'admin') {
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
        }
        catch (error) {
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
        const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">VantageFlow Account Setup Required</h2>
          <p>You have been invited to join <strong>VantageFlow</strong> as a <strong>${role}</strong>.</p>
          <p>To get started, please set your password by clicking the button below:</p>
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
      `;
        await sendEmail(email, 'VantageFlow: Your Account Setup Link', html);
        return {
            success: true,
            message: `Invitation email sent to ${email}`,
        };
    }
    catch (error) {
        console.error('Error inviting user:', error);
        if (error.code === 'already-exists')
            throw error;
        throw new functions.https.HttpsError('internal', `Failed to invite user: ${error.message}`);
    }
});
/**
 * Send reminder email to existing user who hasn't logged in (Admin only)
 * Generates a new password reset link and sends it
 */
exports.sendReminderEmail = functions
    .runWith({
    timeoutSeconds: 60,
    memory: '256MB'
})
    .https.onCall(async (data, context) => {
    var _a, _b;
    // Check if user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // Check if user is admin
    const callerToken = await admin.auth().getUser(context.auth.uid);
    if (!((_a = callerToken.customClaims) === null || _a === void 0 ? void 0 : _a.role) || callerToken.customClaims.role !== 'admin') {
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
            throw new functions.https.HttpsError('failed-precondition', 'This user has already logged in. Password reset is not needed.');
        }
        const role = ((_b = existingUser.customClaims) === null || _b === void 0 ? void 0 : _b.role) || 'member';
        // Generate a new password reset link with 24-hour expiration
        const actionCodeSettings = {
            url: 'https://vantageflow.vercel.app',
            handleCodeInApp: false,
            expiresIn: 86400000, // 24 hours in milliseconds
        };
        const resetLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
        const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">VantageFlow: Action Required - Complete Your Setup</h2>
          <p>You were invited to join <strong>VantageFlow</strong> as a <strong>${role}</strong>, but haven't set your password yet.</p>
          <p>To get started, please set your password by clicking the button below:</p>
          <div style="margin: 30px 0;">
            <a href="${resetLink}" 
               style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Set Your Password
            </a>
          </div>
          <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px; margin: 20px 0;">
            <p style="color: #92400e; font-size: 13px; margin: 0;">
              <strong>Important:</strong> If you received multiple emails, please use the link from this most recent email. Previous links are no longer valid.
            </p>
          </div>
          <p style="color: #64748b; font-size: 14px;">
            This link will expire in 24 hours. If you didn't expect this email, you can safely ignore it.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          <p style="color: #94a3b8; font-size: 12px;">
            VantageFlow - Project Management & KPI Dashboard
          </p>
        </div>
      `;
        await sendEmail(email, 'VantageFlow: Action Required - Complete Your Account Setup', html);
        return {
            success: true,
            message: `Reminder email sent to ${email}`,
        };
    }
    catch (error) {
        console.error('Error sending reminder:', error);
        if (error.code === 'auth/user-not-found') {
            throw new functions.https.HttpsError('not-found', 'User not found. Please invite them first.');
        }
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', `Failed to send reminder: ${error.message}`);
    }
}); /**
* Notify project team when a new member is added
*/
exports.notifyProjectMemberAdded = functions
    .runWith({
    timeoutSeconds: 60,
    memory: '256MB'
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const { projectId, projectName, newMemberEmail, newMemberName, teamEmails } = data;
    const inviterName = context.auth.token.name || context.auth.token.email;
    const subject = `New Team Member: ${newMemberName || newMemberEmail}`;
    const link = `https://vantageflow.vercel.app/project/${projectId}`;
    const html = `
    <div style="font-family: Arial, sans-serif;">
      <h2 style="color: #3b82f6;">New Project Member</h2>
      <p><strong>${newMemberName || newMemberEmail}</strong> has been added to project <strong>${projectName}</strong> by ${inviterName}.</p>
      <p><a href="${link}">View Project</a></p>
    </div>
  `;
    const validEmails = (teamEmails || []).filter(e => e && e.includes('@'));
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
exports.notifyResponsibilityAssigned = functions
    .runWith({
    timeoutSeconds: 60,
    memory: '256MB'
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const { projectId, projectName, itemType, itemName, assignees } = data;
    // assignees: { uid: string, email: string, displayName: string }[]
    const assignerName = context.auth.token.name || context.auth.token.email;
    const subject = `New Responsibility: ${itemName}`;
    const link = `https://vantageflow.vercel.app/project/${projectId}`;
    const html = `
    <div style="font-family: Arial, sans-serif;">
      <h2 style="color: #3b82f6;">Responsibility Assigned</h2>
      <p>You have been assigned to <strong>${itemType}: ${itemName}</strong> in project <strong>${projectName}</strong> by ${assignerName}.</p>
      <p><a href="${link}">View Assignment</a></p>
    </div>
  `;
    // Send emails and create notifications
    const promises = assignees.map(async (member) => {
        if (member.email) {
            await sendEmail(member.email, subject, html);
        }
        if (member.uid) {
            await createNotification(member.uid, 'responsibility_assigned', `Assigned to ${itemType}: ${itemName} in ${projectName}`, projectId, projectName, link);
        }
    });
    await Promise.all(promises);
    return { success: true };
});
// NOTE: Dynamic user lookup via useUserLookup hook is now used on the client.
/**
 * Listen for new achievements and notify user/team
 */
exports.onAchievementAwarded = functions.firestore
    .document('achievements/{achievementId}')
    .onCreate(async (snap, context) => {
    var _a;
    const achievement = snap.data();
    const { userId, points, category, description, projectId } = achievement;
    console.log(`[onAchievementAwarded] New achievement for ${userId}: ${points} pts (${category})`);
    try {
        const userRecord = await admin.auth().getUser(userId);
        const userEmail = userRecord.email;
        const userName = userRecord.displayName || (userEmail === null || userEmail === void 0 ? void 0 : userEmail.split('@')[0]) || 'User';
        // 1. Notify the User (Email) if significant achievement
        if (userEmail && (category === 'phase_complete' || category === 'milestone' || points >= 50)) {
            const subject = `Congratulations! You earned ${points} points!`;
            const html = `
          <div style="font-family: Arial, sans-serif;">
             <h2 style="color: #3b82f6;">Achievement Unlocked!</h2>
             <p>Hi ${userName},</p>
             <p>You've just earned <strong>${points} points</strong> for:</p>
             <p style="font-size: 18px; font-weight: bold; color: #1e293b; background-color: #f1f5f9; padding: 10px; border-radius: 8px;">
               ${description}
             </p>
             <p>Keep up the great work!</p>
             <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
             <p style="color: #94a3b8; font-size: 12px;">VantageFlow Team</p>
          </div>
        `;
            await sendEmail(userEmail, subject, html);
        }
        // 2. Notify Teammates
        if (projectId) {
            const projectDoc = await admin.firestore().collection('projects').doc(projectId).get();
            if (projectDoc.exists) {
                const projectData = projectDoc.data();
                const projectName = (projectData === null || projectData === void 0 ? void 0 : projectData.name) || 'Unknown Project';
                const teamMembers = ((_a = projectData === null || projectData === void 0 ? void 0 : projectData.team) === null || _a === void 0 ? void 0 : _a.members) || [];
                const notifyPromises = teamMembers.map(async (member) => {
                    // Don't notify the user who got the award
                    if (member.uid === userId)
                        return;
                    const message = `${userName} earned ${points} pts in ${projectName}!`;
                    // Create In-App Notification
                    await createNotification(member.uid, 'achievement_celebration', message, projectId, projectName);
                });
                await Promise.all(notifyPromises);
            }
        }
    }
    catch (error) {
        console.error('[onAchievementAwarded] Error processing achievement:', error);
    }
});
//# sourceMappingURL=index.js.map