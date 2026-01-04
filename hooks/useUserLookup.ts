import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

export interface UserInfo {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
    role: string;
}

interface UsersCache {
    usersByUid: Map<string, UserInfo>;
    usersByEmail: Map<string, UserInfo>;
    loading: boolean;
    error: string | null;
}

/**
 * Hook to look up user info by ID or email.
 * Fetches all users once and caches them for lookups.
 * Returns functions to get user info by ID or email.
 */
export const useUserLookup = () => {
    const [cache, setCache] = useState<UsersCache>({
        usersByUid: new Map(),
        usersByEmail: new Map(),
        loading: true,
        error: null,
    });

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const functions = getFunctions();
                const listUsersFunction = httpsCallable(functions, 'listUsers');
                const result = await listUsersFunction();
                const data = result.data as { users: UserInfo[] };

                const usersByUid = new Map<string, UserInfo>();
                const usersByEmail = new Map<string, UserInfo>();

                data.users.forEach((user) => {
                    usersByUid.set(user.uid, user);
                    if (user.email) {
                        usersByEmail.set(user.email.toLowerCase(), user);
                    }
                });

                setCache({
                    usersByUid,
                    usersByEmail,
                    loading: false,
                    error: null,
                });
            } catch (err: any) {
                console.error('Error fetching users for lookup:', err);
                setCache({
                    usersByUid: new Map(),
                    usersByEmail: new Map(),
                    loading: false,
                    error: 'Failed to load users',
                });
            }
        };

        fetchUsers();
    }, []);

    /**
     * Get user info by UID, with email fallback
     */
    const getUserById = useCallback((uid: string, email?: string): UserInfo | undefined => {
        let user = cache.usersByUid.get(uid);
        // Fallback to email lookup if UID not found
        if (!user && email) {
            user = cache.usersByEmail.get(email.toLowerCase());
        }
        return user;
    }, [cache.usersByUid, cache.usersByEmail]);

    /**
     * Get user display name by UID, with email fallback
     */
    const getUserDisplayName = useCallback((uid: string, email?: string): string | undefined => {
        const user = getUserById(uid, email);
        if (!user) return undefined;
        return user.displayName || user.email;
    }, [getUserById]);

    /**
     * Get user photo URL by UID, with email fallback
     */
    const getUserPhotoURL = useCallback((uid: string, email?: string): string | undefined => {
        const user = getUserById(uid, email);
        return user?.photoURL;
    }, [getUserById]);

    return {
        getUserById,
        getUserDisplayName,
        getUserPhotoURL,
        loading: cache.loading,
        error: cache.error,
    };
};

export default useUserLookup;
