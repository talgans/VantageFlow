import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { UserPresence } from '../types';

const PRESENCE_COLLECTION = 'presence';
const HEARTBEAT_INTERVAL_MS = 45000; // 45 seconds
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

class PresenceService {
  private heartbeatTimer: any = null;
  private currentUser: {
    uid: string;
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
    role?: string;
  } | null = null;
  private activeProjectId: string | null = null;
  private isInitialized = false;

  /**
   * Start presence heartbeat for the authenticated user
   */
  public startPresence(
    user: {
      uid: string;
      displayName?: string | null;
      email?: string | null;
      photoURL?: string | null;
      role?: string;
    },
    projectId?: string | null
  ) {
    if (!user || !user.uid) return;

    this.currentUser = user;
    if (projectId !== undefined) {
      this.activeProjectId = projectId;
    }

    // Send immediate heartbeat
    this.sendHeartbeat('online');

    // Setup periodic interval
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat('online');
    }, HEARTBEAT_INTERVAL_MS);

    // Setup browser lifecycle listeners once
    if (!this.isInitialized && typeof window !== 'undefined') {
      this.isInitialized = true;

      // When tab becomes visible again, refresh heartbeat
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.currentUser) {
          this.sendHeartbeat('online');
        }
      });

      // Best effort mark offline on tab close
      window.addEventListener('beforeunload', () => {
        if (this.currentUser) {
          this.setOfflineSync(this.currentUser.uid);
        }
      });
    }
  }

  /**
   * Update the project the user is actively viewing
   */
  public updateCurrentProject(projectId: string | null) {
    this.activeProjectId = projectId;
    if (this.currentUser) {
      this.sendHeartbeat('online');
    }
  }

  /**
   * Send heartbeat to Firestore
   */
  private async sendHeartbeat(state: 'online' | 'offline') {
    if (!this.currentUser || !this.currentUser.uid) return;

    try {
      const userRef = doc(db, PRESENCE_COLLECTION, this.currentUser.uid);
      const data: Partial<UserPresence> = {
        uid: this.currentUser.uid,
        displayName: this.currentUser.displayName || (this.currentUser.email ? this.currentUser.email.split('@')[0] : 'User'),
        email: this.currentUser.email || '',
        photoURL: this.currentUser.photoURL || null,
        role: this.currentUser.role || 'Team Member',
        currentProjectId: this.activeProjectId,
        state,
        lastSeen: serverTimestamp(),
      };

      await setDoc(userRef, data, { merge: true });
    } catch (err) {
      console.warn('[PresenceService] Failed to send heartbeat:', err);
    }
  }

  /**
   * Set user offline asynchronously (e.g. on logout)
   */
  public async setOffline(uid?: string) {
    const targetUid = uid || this.currentUser?.uid;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.currentUser = null;
    this.activeProjectId = null;

    if (!targetUid) return;

    try {
      const userRef = doc(db, PRESENCE_COLLECTION, targetUid);
      await setDoc(
        userRef,
        {
          state: 'offline',
          lastSeen: serverTimestamp(),
          currentProjectId: null,
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[PresenceService] Failed to set offline status:', err);
    }
  }

  /**
   * Synchronous / immediate attempt on beforeunload
   */
  private setOfflineSync(uid: string) {
    try {
      const userRef = doc(db, PRESENCE_COLLECTION, uid);
      setDoc(
        userRef,
        {
          state: 'offline',
          lastSeen: serverTimestamp(),
          currentProjectId: null,
        },
        { merge: true }
      ).catch(() => {});
    } catch {
      // Ignored during page unload
    }
  }

  /**
   * Listen in real-time to all online users
   */
  public subscribeToOnlineUsers(callback: (users: UserPresence[]) => void): () => void {
    const presenceCol = collection(db, PRESENCE_COLLECTION);

    const unsubscribe = onSnapshot(
      presenceCol,
      (snapshot) => {
        const now = Date.now();
        const activeUsers: UserPresence[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (!data || data.state === 'offline') return;

          let lastSeenMillis = 0;
          if (data.lastSeen instanceof Timestamp) {
            lastSeenMillis = data.lastSeen.toMillis();
          } else if (data.lastSeen?.seconds) {
            lastSeenMillis = data.lastSeen.seconds * 1000;
          } else if (data.lastSeen instanceof Date) {
            lastSeenMillis = data.lastSeen.getTime();
          } else if (typeof data.lastSeen === 'number') {
            lastSeenMillis = data.lastSeen;
          }

          // Must have been seen within the threshold
          if (now - lastSeenMillis <= ONLINE_THRESHOLD_MS) {
            activeUsers.push({
              uid: data.uid || docSnap.id,
              displayName: data.displayName || 'Member',
              email: data.email || '',
              photoURL: data.photoURL || null,
              role: data.role || 'Team Member',
              currentProjectId: data.currentProjectId || null,
              lastSeen: data.lastSeen,
              state: 'online',
            });
          }
        });

        callback(activeUsers);
      },
      (error) => {
        console.warn('[PresenceService] Snapshot error:', error);
      }
    );

    return unsubscribe;
  }
}

export const presenceService = new PresenceService();
