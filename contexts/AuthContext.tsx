import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  Auth,
  UserCredential
} from 'firebase/auth';
import { doc, onSnapshot, deleteDoc, Firestore } from 'firebase/firestore';
import { UserRole } from '../types';

// Note: Firebase auth instance should be initialized in a separate firebase config file
// This will be imported once firebase is installed
// import { auth } from '../services/firebaseConfig';

interface ForceLogoutData {
  reason: string;
  previousRole: string;
  newRole: string;
  message: string;
  changedAt: any;
}

interface AuthUser {
  uid: string;
  email: string | null;
  role: UserRole;
  displayName?: string | null;
  photoURL?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<UserCredential>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<UserCredential>;
  refreshUserRole: () => Promise<void>;
  error: string | null;
  pendingLogout: ForceLogoutData | null;
  acknowledgePendingLogout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  auth: Auth; // Accept auth instance as prop for flexibility
  firestore?: Firestore; // Optional Firestore instance for forceLogout listener
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, auth, firestore }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingLogout, setPendingLogout] = useState<ForceLogoutData | null>(null);

  /**
   * Extract user role from Firebase custom claims
   */
  const extractUserRole = async (firebaseUser: User): Promise<UserRole> => {
    try {
      const idTokenResult = await firebaseUser.getIdTokenResult();
      const customClaims = idTokenResult.claims;

      // Check custom claims for role
      if (customClaims.role === 'admin') {
        return UserRole.Admin;
      } else if (customClaims.role === 'manager') {
        return UserRole.Manager;
      } else {
        return UserRole.Member; // Default role
      }
    } catch (error) {
      console.error('Error extracting user role:', error);
      return UserRole.Member; // Default to Member on error
    }
  };

  /**
   * Convert Firebase User to AuthUser with role
   */
  const convertToAuthUser = async (firebaseUser: User): Promise<AuthUser> => {
    const role = await extractUserRole(firebaseUser);
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      role,
    };
  };

  /**
   * Refresh user role by forcing token refresh
   * Useful when custom claims are updated on the backend
   */
  const refreshUserRole = async (): Promise<void> => {
    if (!auth.currentUser) {
      console.warn('No user logged in, cannot refresh role');
      return;
    }

    try {
      setLoading(true);
      // Force token refresh to get updated custom claims
      await auth.currentUser.getIdToken(true);

      // Re-extract role from refreshed token
      const updatedUser = await convertToAuthUser(auth.currentUser);
      setUser(updatedUser);
      setError(null);

      console.log('User role refreshed:', updatedUser.role);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh user role';
      console.error('Error refreshing user role:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Acknowledge pending logout and delete the forceLogout document
   */
  const acknowledgePendingLogout = async (): Promise<void> => {
    if (!user || !firestore || !pendingLogout) return;

    try {
      await deleteDoc(doc(firestore, 'forceLogout', user.uid));
      setPendingLogout(null);
    } catch (err) {
      console.error('Error acknowledging pending logout:', err);
    }
  };

  /**
   * Sign in with email and password
   */
  const signIn = async (email: string, password: string): Promise<UserCredential> => {
    try {
      setError(null);
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign in';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign up with email and password
   */
  const signUp = async (email: string, password: string): Promise<UserCredential> => {
    try {
      setError(null);
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Note: Default role (Member) will be set via custom claims by backend
      // Admin needs to manually upgrade users to Manager or Admin roles

      return userCredential;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign up';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign out current user
   */
  const signOut = async (): Promise<void> => {
    try {
      setError(null);
      setPendingLogout(null); // Clear any pending logout
      await firebaseSignOut(auth);
      setUser(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign out';
      setError(errorMessage);
      throw err;
    }
  };

  /**
   * Listen to authentication state changes
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (firebaseUser) {
          try {
            const authUser = await convertToAuthUser(firebaseUser);
            setUser(authUser);
            setError(null);
          } catch (err) {
            console.error('Error converting user:', err);
            setError('Failed to load user data');
            setUser(null);
          }
        } else {
          setUser(null);
          setPendingLogout(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Auth state change error:', err);
        setError('Authentication error occurred');
        setUser(null);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [auth]);

  /**
   * Listen for force logout events (role changes)
   * This replaces the old periodic token refresh
   */
  useEffect(() => {
    if (!user || !firestore) return;

    const forceLogoutRef = doc(firestore, 'forceLogout', user.uid);

    const unsubscribe = onSnapshot(
      forceLogoutRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as ForceLogoutData;
          console.log('Force logout event detected:', data);
          setPendingLogout(data);
        }
      },
      (err) => {
        // Ignore permission errors if no document exists
        if (err.code !== 'permission-denied') {
          console.error('Error listening to forceLogout:', err);
        }
      }
    );

    return () => unsubscribe();
  }, [user, firestore]);

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signOut,
    signUp,
    refreshUserRole,
    error,
    pendingLogout,
    acknowledgePendingLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to use auth context
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Helper function to map UserRole enum to custom claim string
 * For use in admin scripts when setting custom claims
 */
export const roleToClaimString = (role: UserRole): string => {
  switch (role) {
    case UserRole.Admin:
      return 'admin';
    case UserRole.Manager:
      return 'manager';
    case UserRole.Member:
      return 'member';
    default:
      return 'member';
  }
};

/**
 * Helper function to check if user has permission to modify projects
 */
export const canModifyProjects = (user: AuthUser | null): boolean => {
  if (!user) return false;
  return user.role === UserRole.Admin || user.role === UserRole.Manager;
};
