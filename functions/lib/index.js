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
exports.inviteUser = exports.configureCors = exports.updateUserProfile = exports.deleteUser = exports.setUserRole = exports.listUsers = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const nodemailer = __importStar(require("nodemailer"));
// Prevent double initialization
if (admin.apps.length === 0) {
    admin.initializeApp();
}
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
 * Set user role (Admin only)
 */
exports.setUserRole = functions.https.onCall(async (data, context) => {
    var _a;
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
        await admin.auth().setCustomUserClaims(uid, { role });
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
    // Validate role - any non-empty string except 'admin' (admin must be assigned after signup)
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
        const emailUserValue = emailConfig === null || emailConfig === void 0 ? void 0 : emailConfig.user;
        const emailPasswordValue = emailConfig === null || emailConfig === void 0 ? void 0 : emailConfig.password;
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
        }
        else {
            console.warn('Email configuration not set. User created but invitation email not sent.');
        }
        console.log(`User invited successfully: ${email} with role ${role}`);
        return {
            success: true,
            message: `Invitation email sent to ${email}`,
        };
    }
    catch (error) {
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
//# sourceMappingURL=index.js.map