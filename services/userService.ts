import { updateProfile } from 'firebase/auth';
import { auth } from './firebaseConfig';

/**
 * Update user profile (display name and/or photo URL)
 */
export const updateUserProfile = async (
    displayName?: string,
    photoURL?: string
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
        await updateProfile(user, updates);
    } catch (error) {
        console.error('Error updating profile:', error);
        throw new Error('Failed to update profile. Please try again.');
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
