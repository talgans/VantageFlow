import { updateProfile } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from './firebaseConfig';

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
