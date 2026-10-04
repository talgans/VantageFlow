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
exports.onProjectArchiveStatusChange = exports.onAchievementAwarded = exports.notifyResponsibilityAssigned = exports.notifyProjectMemberAdded = exports.sendReminderEmail = exports.inviteUser = exports.configureCors = exports.updateUserProfile = exports.deleteUser = exports.setUserRole = exports.getPublicDirectory = exports.listUsers = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const nodemailer = __importStar(require("nodemailer"));
const emailTemplates_1 = require("./emailTemplates");
// Prevent double initialization
if (admin.apps.length === 0) {
    admin.initializeApp();
}
// Helpers for checking admin / superadmin status
const isSuperAdminUser = (userRecord) => {
    var _a, _b;
    return ((_a = userRecord.email) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'talgans@gmail.com' || ((_b = userRecord.customClaims) === null || _b === void 0 ? void 0 : _b.role) === 'superadmin';
};
const isAdminUser = (userRecord) => {
    var _a;
    return isSuperAdminUser(userRecord) || ((_a = userRecord.customClaims) === null || _a === void 0 ? void 0 : _a.role) === 'admin';
};
// --- Helper for creating Nodemailer transporter using Gmail SMTP ---
const createTransporter = () => {
    var _a, _b;
    const emailUser = process.env.EMAIL_USER || ((_a = functions.config().email) === null || _a === void 0 ? void 0 : _a.user);
    const emailPassword = process.env.EMAIL_PASSWORD || ((_b = functions.config().email) === null || _b === void 0 ? void 0 : _b.password);
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
const sendEmail = async (to, subject, html) => {
    var _a;
    console.log(`[sendEmail] Attempting to send email to: ${to}`);
    console.log(`[sendEmail] Subject: ${subject}`);
    const transporter = createTransporter();
    if (!transporter) {
        return false;
    }
    const emailUser = process.env.EMAIL_USER || ((_a = functions.config().email) === null || _a === void 0 ? void 0 : _a.user);
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
    }
    catch (error) {
        console.error('[sendEmail] Gmail SMTP error:', error.message || error);
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
    // Check if user is admin, superadmin, or manager
    const callerToken = await admin.auth().getUser(context.auth.uid);
    const userRole = (_a = callerToken.customClaims) === null || _a === void 0 ? void 0 : _a.role;
    if (!isAdminUser(callerToken) && userRole !== 'manager') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins and managers can list users');
    }
    try {
        const listUsersResult = await admin.auth().listUsers(1000);
        const users = listUsersResult.users.map(user => {
            var _a, _b;
            return ({
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName,
                photoURL: user.photoURL,
                role: ((_a = user.email) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'talgans@gmail.com' ? 'superadmin' : (((_b = user.customClaims) === null || _b === void 0 ? void 0 : _b.role) || 'member'),
                createdAt: user.metadata.creationTime,
                lastSignIn: user.metadata.lastSignInTime,
                phoneNumber: user.phoneNumber,
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
                var _a, _b;
                users.push({
                    uid: user.uid,
                    email: user.email || '',
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    role: ((_a = user.email) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'talgans@gmail.com' ? 'superadmin' : (((_b = user.customClaims) === null || _b === void 0 ? void 0 : _b.role) || 'member'),
                    createdAt: user.metadata.creationTime,
                    lastSignIn: user.metadata.lastSignInTime,
                    phoneNumber: user.phoneNumber,
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
 * Set user role (Admin or SuperAdmin only)
 */
exports.setUserRole = functions.https.onCall(async (data, context) => {
    var _a, _b, _c, _d;
    // Check if user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // Check if user is admin or superadmin
    const callerToken = await admin.auth().getUser(context.auth.uid);
    if (!isAdminUser(callerToken)) {
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
        const previousRole = ((_a = targetUser.email) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'talgans@gmail.com' ? 'superadmin' : (((_b = targetUser.customClaims) === null || _b === void 0 ? void 0 : _b.role) || 'member');
        // Security: The primary SuperAdmin (talgans@gmail.com) can NEVER have their role altered
        if (((_c = targetUser.email) === null || _c === void 0 ? void 0 : _c.toLowerCase()) === 'talgans@gmail.com') {
            throw new functions.https.HttpsError('permission-denied', 'Cannot modify the role of the primary SuperAdmin (talgans@gmail.com)');
        }
        // Security: Only SuperAdmins can assign or alter the superadmin role
        if ((role === 'superadmin' || ((_d = targetUser.customClaims) === null || _d === void 0 ? void 0 : _d.role) === 'superadmin') && !isSuperAdminUser(callerToken)) {
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
                changedBy: context.auth.uid,
                message: `Your role has been changed from ${previousRole} to ${role}. You will be logged out in 60 seconds to apply the new permissions.`
            });
        }
        return { success: true, message: `User role set to ${role}` };
    }
    catch (error) {
        console.error('Error setting user role:', error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', 'Failed to set user role');
    }
});
/**
 * Delete user (Admin or SuperAdmin only)
 */
exports.deleteUser = functions.https.onCall(async (data, context) => {
    var _a, _b;
    // Check if user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // Check if user is admin or superadmin
    const callerToken = await admin.auth().getUser(context.auth.uid);
    if (!isAdminUser(callerToken)) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can delete users');
    }
    const { uid } = data;
    // Prevent self-deletion
    if (uid === context.auth.uid) {
        throw new functions.https.HttpsError('invalid-argument', 'Cannot delete your own account');
    }
    try {
        const targetUser = await admin.auth().getUser(uid);
        // Security: The primary SuperAdmin (talgans@gmail.com) can NEVER be deleted
        if (((_a = targetUser.email) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'talgans@gmail.com') {
            throw new functions.https.HttpsError('permission-denied', 'The primary SuperAdmin (talgans@gmail.com) cannot be deleted');
        }
        // Security: Only SuperAdmins can delete another SuperAdmin
        if (((_b = targetUser.customClaims) === null || _b === void 0 ? void 0 : _b.role) === 'superadmin' && !isSuperAdminUser(callerToken)) {
            throw new functions.https.HttpsError('permission-denied', 'Only SuperAdmins can delete a SuperAdmin user');
        }
        await admin.auth().deleteUser(uid);
        return { success: true, message: 'User deleted successfully' };
    }
    catch (error) {
        console.error('Error deleting user:', error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', 'Failed to delete user');
    }
});
/**
 * Update user profile (Admin or SuperAdmin only for other users)
 * Allows admin to update display name and photoURL for any user
 */
exports.updateUserProfile = functions.https.onCall(async (data, context) => {
    // Check if user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { uid, displayName, photoURL, phoneNumber } = data;
    if (!uid) {
        throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
    }
    // Check if user is admin, superadmin, or updating their own profile
    const callerUid = context.auth.uid;
    const callerToken = await admin.auth().getUser(callerUid);
    if (callerUid !== uid && !isAdminUser(callerToken)) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can update other user profiles');
    }
    try {
        const updateData = {};
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
    }
    catch (error) {
        console.error('Error updating user profile:', error);
        throw new functions.https.HttpsError('internal', 'Failed to update user profile');
    }
});
/**
 * Configure Storage CORS (Admin or SuperAdmin only)
 * Fixes CORS issues for file uploads
 */
exports.configureCors = functions.https.onCall(async (data, context) => {
    try {
        // Check if user is authenticated
        if (!context.auth) {
            return { success: false, error: 'User must be authenticated' };
        }
        const callerToken = await admin.auth().getUser(context.auth.uid);
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
 * Invite user via email (Admin or SuperAdmin only)
 * Creates a user account with specified role
 */
exports.inviteUser = functions
    .runWith({
    timeoutSeconds: 60,
    memory: '256MB'
})
    .https.onCall(async (data, context) => {
    var _a;
    // Check if user is authenticated
    if (!context.auth) {
        console.error('inviteUser called without authentication');
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    console.log(`inviteUser called by: ${context.auth.uid}`);
    // Check if user is admin or superadmin
    const callerToken = await admin.auth().getUser(context.auth.uid);
    console.log(`Caller role: ${(_a = callerToken.customClaims) === null || _a === void 0 ? void 0 : _a.role}`);
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
        const html = (0, emailTemplates_1.getInvitationEmail)(role, resetLink);
        const emailSent = await sendEmail(email, 'VantageFlow: Your Account Setup Link', html);
        if (!emailSent) {
            throw new functions.https.HttpsError('internal', `User account was created, but failed to send invitation email to ${email}. Please check SMTP configuration or use the Send Reminder button.`);
        }
        return {
            success: true,
            message: `Invitation email sent to ${email}`,
        };
    }
    catch (error) {
        console.error('Error inviting user:', error);
        if (error.code === 'already-exists')
            throw error;
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', `Failed to invite user: ${error.message}`);
    }
});
/**
 * Send reminder email to existing user who hasn't logged in (Admin or SuperAdmin only)
 * Generates a new password reset link and sends it
 */
exports.sendReminderEmail = functions
    .runWith({
    timeoutSeconds: 60,
    memory: '256MB'
})
    .https.onCall(async (data, context) => {
    var _a;
    // Check if user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // Check if user is admin or superadmin
    const callerToken = await admin.auth().getUser(context.auth.uid);
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
            throw new functions.https.HttpsError('failed-precondition', 'This user has already logged in. Password reset is not needed.');
        }
        const role = ((_a = existingUser.customClaims) === null || _a === void 0 ? void 0 : _a.role) || 'member';
        // Generate a new password reset link with 24-hour expiration
        const actionCodeSettings = {
            url: 'https://vantageflow.vercel.app',
            handleCodeInApp: false,
            expiresIn: 86400000, // 24 hours in milliseconds
        };
        const resetLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
        const html = (0, emailTemplates_1.getReminderEmail)(role, resetLink);
        const emailSent = await sendEmail(email, 'VantageFlow: Action Required - Complete Your Account Setup', html);
        if (!emailSent) {
            throw new functions.https.HttpsError('internal', `Failed to deliver reminder email to ${email}. Please check SMTP configuration.`);
        }
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
    const html = (0, emailTemplates_1.getNewMemberEmail)(newMemberName || newMemberEmail, projectName, inviterName, link);
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
    const html = (0, emailTemplates_1.getResponsibilityAssignedEmail)(itemType, itemName, projectName, assignerName, link);
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
            const html = (0, emailTemplates_1.getAchievementEmail)(userName, points, description);
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
/**
 * Listen for project archive status changes and notify team
 */
exports.onProjectArchiveStatusChange = functions.firestore
    .document('projects/{projectId}')
    .onUpdate(async (change, context) => {
    var _a;
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
    const teamMembers = ((_a = after.team) === null || _a === void 0 ? void 0 : _a.members) || [];
    const link = `https://vantageflow.vercel.app/project/${projectId}`;
    // Get the name of who archived
    let actionByName = 'an administrator';
    if (archivedBy) {
        try {
            const userRecord = await admin.auth().getUser(archivedBy);
            actionByName = userRecord.displayName || userRecord.email || 'an administrator';
        }
        catch (e) {
            console.warn(`Could not get user info for ${archivedBy}`);
        }
    }
    const subject = `Project ${isNowArchived ? 'Archived' : 'Unarchived'}: ${projectName}`;
    const html = (0, emailTemplates_1.getProjectArchivedEmail)(projectName, actionByName, isNowArchived, link);
    const notifyPromises = teamMembers.map(async (member) => {
        // Send email
        if (member.email) {
            await sendEmail(member.email, subject, html);
        }
        // Create in-app notification
        if (member.uid) {
            const message = `Project "${projectName}" has been ${isNowArchived ? 'archived' : 'unarchived'} by ${actionByName}.`;
            await createNotification(member.uid, 'project_archived', message, projectId, projectName, link);
        }
    });
    await Promise.all(notifyPromises);
    console.log(`[onProjectArchiveStatusChange] Notifications sent to ${teamMembers.length} team members.`);
    return null;
});
//# sourceMappingURL=index.js.map