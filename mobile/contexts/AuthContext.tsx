import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../services/firebaseConfig';
import { AuthUser, UserRole } from '../types';
import { registerForPushNotificationsAsync } from '../services/notificationService';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInAsDemo: (role?: UserRole) => void;
  refreshUserRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const extractUserRole = async (firebaseUser: User): Promise<UserRole> => {
    try {
      const idTokenResult = await Promise.race([
        firebaseUser.getIdTokenResult(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
      ]);
      const roleClaim = idTokenResult?.claims?.role;
      if (roleClaim === 'admin') return UserRole.Admin;
      if (roleClaim === 'manager') return UserRole.Manager;
      return UserRole.Member;
    } catch {
      return UserRole.Member;
    }
  };

  const convertToAuthUser = async (firebaseUser: User): Promise<AuthUser> => {
    const role = await extractUserRole(firebaseUser);
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
      photoURL: firebaseUser.photoURL,
      role,
    };
  };

  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      setLoading(false);
      return;
    }

    // Safety timeout: never hang indefinitely on loading spinner
    const timeoutTimer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(
        auth,
        async (firebaseUser) => {
          clearTimeout(timeoutTimer);
          try {
            if (firebaseUser) {
              const authUser = await convertToAuthUser(firebaseUser);
              setUser(authUser);
              registerForPushNotificationsAsync().catch(() => {});
            } else {
              setUser(null);
            }
          } catch (e) {
            console.warn('[Auth] Error transforming auth user:', e);
            setUser(null);
          } finally {
            setLoading(false);
          }
        },
        (authErr) => {
          console.warn('[Auth] onAuthStateChanged error:', authErr);
          clearTimeout(timeoutTimer);
          setUser(null);
          setLoading(false);
        }
      );
    } catch (err) {
      console.warn('[Auth] Failed to set up auth listener:', err);
      clearTimeout(timeoutTimer);
      setLoading(false);
    }

    return () => {
      clearTimeout(timeoutTimer);
      unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      if (!isFirebaseConfigured() || !auth) {
        signInAsDemo();
        return;
      }
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const authUser = await convertToAuthUser(userCredential.user);
      setUser(authUser);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
      throw err;
    }
  };

  const signUp = async (email: string, password: string) => {
    setError(null);
    try {
      if (!isFirebaseConfigured() || !auth) {
        signInAsDemo();
        return;
      }
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const authUser = await convertToAuthUser(userCredential.user);
      setUser(authUser);
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
      throw err;
    }
  };

  const signOut = async () => {
    try {
      if (isFirebaseConfigured() && auth) {
        await firebaseSignOut(auth);
      }
      setUser(null);
    } catch (err: any) {
      console.error('Sign out error:', err);
      setUser(null);
    }
  };

  const signInAsDemo = (role: UserRole = UserRole.Admin) => {
    setUser({
      uid: 'demo-u1',
      email: 'mohammed@vantageflow.app',
      displayName: 'Mohammed Mahmud (Demo)',
      role,
    });
  };

  const refreshUserRole = async () => {
    if (auth?.currentUser) {
      await auth.currentUser.getIdToken(true);
      const authUser = await convertToAuthUser(auth.currentUser);
      setUser(authUser);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        signInAsDemo,
        refreshUserRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
