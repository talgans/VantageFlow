import { useState, useEffect, useMemo, useCallback } from 'react';
import { presenceService } from '../services/presenceService';
import { UserPresence, Project } from '../types';
import { useAuth } from '../contexts/AuthContext';

export const usePresence = (currentProjectId?: string | null) => {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);

  // Start heartbeat and sync current project ID whenever user or currentProjectId changes
  useEffect(() => {
    if (!user) return;

    presenceService.startPresence(
      {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        role: user.role,
      },
      currentProjectId
    );
  }, [user, currentProjectId]);

  // Listen to all online users
  useEffect(() => {
    if (!user) {
      setOnlineUsers([]);
      return;
    }

    const unsubscribe = presenceService.subscribeToOnlineUsers((users) => {
      setOnlineUsers(users);
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  // Check if a specific user is currently online
  const isUserOnline = useCallback(
    (uid: string) => {
      return onlineUsers.some((u) => u.uid === uid);
    },
    [onlineUsers]
  );

  // Filter online users for a specific project
  const getProjectOnlineUsers = useCallback(
    (project?: Project | null) => {
      if (!project) return [];

      const memberUids = new Set<string>();
      if (project.ownerId) memberUids.add(project.ownerId);
      if (project.team?.members) {
        project.team.members.forEach((m) => {
          if (m.uid) memberUids.add(m.uid);
        });
      }

      return onlineUsers.filter((u) => {
        // Online if they are an assigned member/owner of the project
        // OR actively viewing this project right now
        const isAssigned = memberUids.has(u.uid);
        const isViewing = u.currentProjectId === project.id;
        return isAssigned || isViewing;
      });
    },
    [onlineUsers]
  );

  return {
    onlineUsers,
    isUserOnline,
    getProjectOnlineUsers,
  };
};
