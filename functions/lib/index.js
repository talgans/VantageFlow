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
exports.inviteUser = exports.deleteUser = exports.setUserRole = exports.listUsers = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
/**
 * List all users (Admin only)
 */
exports.listUsers = functions.https.onCall(async (data, context) => {
    var _a;
    // Check if user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // Check if user is admin
    const callerToken = await admin.auth().getUser(context.auth.uid);
    if (!((_a = callerToken.customClaims) === null || _a === void 0 ? void 0 : _a.role) || callerToken.customClaims.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can list users');
    }
    try {
        const listUsersResult = await admin.auth().listUsers(1000);
        const users = listUsersResult.users.map(user => {
            var _a;
            return ({
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName,
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
    // Validate role
    if (!['admin', 'manager', 'member'].includes(role)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid role. Must be admin, manager, or member');
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
 * Invite user via email (Admin only)
 * Creates a user account with specified role
 */
exports.inviteUser = functions.https.onCall(async (data, context) => {
    var _a;
    // Check if user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // Check if user is admin
    const callerToken = await admin.auth().getUser(context.auth.uid);
    if (!((_a = callerToken.customClaims) === null || _a === void 0 ? void 0 : _a.role) || callerToken.customClaims.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can invite users');
    }
    const { email, role } = data;
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
        try {
            await admin.auth().getUserByEmail(email);
            throw new functions.https.HttpsError('already-exists', 'User with this email already exists');
        }
        catch (error) {
            if (error.code !== 'auth/user-not-found') {
                throw error;
            }
            // User doesn't exist, proceed with creation
        }
        // Create user with temporary password
        const tempPassword = Math.random().toString(36).slice(-12) + 'Aa1!';
        const userRecord = await admin.auth().createUser({
            email,
            password: tempPassword,
            emailVerified: false,
        });
        // Set custom claims for role
        await admin.auth().setCustomUserClaims(userRecord.uid, { role });
        // Generate password reset link
        const resetLink = await admin.auth().generatePasswordResetLink(email);
        // Write to Firestore mail collection to trigger email sending
        // This works with the Firebase Trigger Email extension
        await admin.firestore().collection('mail').add({
            to: email,
            message: {
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
              This link will expire in 1 hour. If you didn't expect this invitation, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            <p style="color: #94a3b8; font-size: 12px;">
              VantageFlow - Project Management & KPI Dashboard
            </p>
          </div>
        `,
            },
        });
        console.log(`User invited: ${email} with role ${role}`);
        return {
            success: true,
            message: `Invitation email sent to ${email}`,
        };
    }
    catch (error) {
        console.error('Error inviting user:', error);
        if (error.code === 'already-exists') {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to invite user');
    }
});
//# sourceMappingURL=index.js.map