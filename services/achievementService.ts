import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { UserAchievement, UserStats } from '../types';

export const achievementService = {
    /**
     * Award points to a user
     */
    awardPoints: async (userId: string, points: number, category: UserAchievement['category'], description: string, projectId?: string) => {
        try {
            await addDoc(collection(db, 'achievements'), {
                userId,
                points,
                category,
                description,
                projectId: projectId || null,
                awardedAt: serverTimestamp()
            });
            console.log(`Awarded ${points} points to ${userId} for ${category} (Project: ${projectId})`);
            return true;
        } catch (error) {
            console.error('Error awarding points:', error);
            return false;
        }
    },

    /**
     * Get user achievements
     */
    getUserAchievements: async (userId: string): Promise<UserAchievement[]> => {
        try {
            const q = query(
                collection(db, 'achievements'),
                where('userId', '==', userId),
                orderBy('awardedAt', 'desc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserAchievement));
        } catch (error) {
            console.error('Error fetching achievements:', error);
            return [];
        }
    },

    /**
     * Get user stats (total points and star rating)
     */
    getUserStats: async (userId: string): Promise<UserStats> => {
        try {
            // Calculate from achievements for now (or read aggregated doc if exists)
            const achievements = await achievementService.getUserAchievements(userId);
            const totalPoints = achievements.reduce((sum, a) => sum + (a.points || 0), 0);

            // 5-star rating logic
            // Task = 10 points
            // Phase = 50 points
            // 5 stars > 1000
            let starRating: 1 | 2 | 3 | 4 | 5 = 1;
            if (totalPoints > 1000) starRating = 5;
            else if (totalPoints > 600) starRating = 4;
            else if (totalPoints > 300) starRating = 3;
            else if (totalPoints > 100) starRating = 2;

            return {
                totalPoints,
                starRating,
                achievements
            };
        } catch (error) {
            console.error('Error getting user stats:', error);
            return { totalPoints: 0, starRating: 1, achievements: [] };
        }
    },

    /**
     * Get all achievements (for dashboard)
     */
    getAllAchievements: async (): Promise<UserAchievement[]> => {
        try {
            const q = query(
                collection(db, 'achievements'),
                orderBy('awardedAt', 'desc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserAchievement));
        } catch (error) {
            console.error('Error fetching all achievements:', error);
            return [];
        }
    },

    /**
     * Get leaderboard data
     */
    getLeaderboard: async (): Promise<{ userId: string; points: number; achievements: number }[]> => {
        try {
            const allAchievements = await achievementService.getAllAchievements();
            const userPoints: Record<string, { points: number; achievements: number }> = {};

            allAchievements.forEach(a => {
                if (!userPoints[a.userId]) {
                    userPoints[a.userId] = { points: 0, achievements: 0 };
                }
                userPoints[a.userId].points += (a.points || 0);
                userPoints[a.userId].achievements += 1;
            });

            return Object.entries(userPoints)
                .map(([userId, stats]) => ({ userId, ...stats }))
                .sort((a, b) => b.points - a.points);
        } catch (error) {
            console.error('Error getting leaderboard:', error);
            return [];
        }
    }
};
