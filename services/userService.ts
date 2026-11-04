import { updateProfile } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from './firebaseConfig';

export interface ProjectInviteContext {
    projectId?: string;
    projectName?: string;
    projectDescription?: string;
    projectTimeline?: string;
}

/**
 * Format project startDate and duration into a readable timeline string for emails
 */
export const formatProjectTimeline = (
    startDate?: Date | string,
    duration?: number | string,
    durationUnit?: string
): string => {
    const parts: string[] = [];
    if (startDate) {
        const d = startDate instanceof Date ? startDate : new Date(startDate);
        if (!isNaN(d.getTime())) {
            parts.push(`Start: ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);
        }
    }
    if (duration && Number(duration) > 0) {
        const unit = durationUnit || 'weeks';
        parts.push(`Duration: ${duration} ${unit}`);
    }
    return parts.join(' • ');
};

/**
 * Shared user invitation function (used by both UserAdministrationPage and Project Management Modal)
 */
export const inviteUserByEmail = async (
    email: string,
    role: string = 'member',
    projectContext?: ProjectInviteContext
): Promise<{
    success: boolean;
    message: string;
    user?: {
        uid: string;
        email: string;
        displayName?: string;
        role: string;
        createdAt?: string;
        lastSignIn?: string;
    };
}> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error('You must be signed in to invite users. Please refresh the page and sign in again.');
    }

    await currentUser.getIdToken(true);

    const functions = getFunctions(app, 'us-central1');
    const inviteUserFunction = httpsCallable(functions, 'inviteUser');
    const result = await inviteUserFunction({
        email: email.trim(),
        role,
        ...(projectContext || {}),
    });

    return result.data as any;
};

/**
 * Shared reminder email function for pending users who haven't completed account setup
 * (used by both UserAdministrationPage and Project Management Modal)
 */
export const sendUserReminderEmail = async (
    email: string,
    projectContext?: ProjectInviteContext
): Promise<{ success: boolean; message: string }> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error('You must be signed in to send reminder emails.');
    }

    await currentUser.getIdToken(true);

    const functions = getFunctions(app, 'us-central1');
    const sendReminderEmailFunction = httpsCallable(functions, 'sendReminderEmail');
    const result = await sendReminderEmailFunction({
        email: email.trim(),
        ...(projectContext || {}),
    });

    return result.data as any;
};

/**
 * Update user profile (display name and/or photo URL)
 */
export const updateUserProfile = async (
    displayName?: string,
    photoURL?: string,
    phoneNumber?: string | null
): Promise<void> => {
    const user = auth.currentUser;

    if (!user) {
        throw new Error('No user is currently signed in');
    }

    const updates: { displayName?: string; photoURL?: string } = {};

    if (displayName !== undefined) {
        updates.displayName = displayName;
    }

    if (photoURL !== undefined) {
        updates.photoURL = photoURL;
    }

    try {
        if (Object.keys(updates).length > 0) {
            await updateProfile(user, updates);
        }

        // Only update phoneNumber via Cloud Function if it was explicitly provided and changed
        if (phoneNumber !== undefined) {
            const currentPhone = (user.phoneNumber || '').trim();
            const newPhone = phoneNumber === null ? '' : phoneNumber.trim();

            if (newPhone !== currentPhone) {
                // If setting a phone number, validate E.164 format
                if (newPhone !== '' && !/^\+[1-9]\d{6,14}$/.test(newPhone)) {
                    throw new Error('Phone number must start with + and include country code (e.g. +2348012345678 or +1234567890)');
                }

                const functions = getFunctions();
                const updateUserProfileFunction = httpsCallable(functions, 'updateUserProfile');
                await updateUserProfileFunction({
                    uid: user.uid,
                    phoneNumber: newPhone === '' ? null : newPhone
                });
            }
        }
    } catch (error: any) {
        console.error('Error updating profile:', error);
        throw new Error(error?.message || 'Failed to update profile. Please try again.');
    }
};

/**
 * Generate initials from display name or email
 */
export const getInitials = (displayName?: string | null, email?: string | null): string => {
    if (displayName) {
        const parts = displayName.trim().split(' ');
        if (parts.length >= 2) {
            return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
        }
        return displayName.substring(0, 2).toUpperCase();
    }

    if (email) {
        return email.substring(0, 2).toUpperCase();
    }

    return 'U';
};
