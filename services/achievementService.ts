import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { UserAchievement, UserStats } from '../types';

export const achievementService = {
    /**
     * Award points to a user
     */
    awardPoints: async (userId: string, points: number, category: UserAchievement['category'], description: string) => {
        try {
            await addDoc(collection(db, 'achievements'), {
                userId,
                points,
                category,
                description,
                awardedAt: serverTimestamp()
            });
            console.log(`Awarded ${points} points to ${userId} for ${category}`);
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

            // 5-star rating logic (Example: 1 star per 100 points, max 5)
            // Or based on task completion count?
            // Let's go with a simple mapping for now
            let starRating: 1 | 2 | 3 | 4 | 5 = 1;
            if (totalPoints > 500) starRating = 5;
            else if (totalPoints > 300) starRating = 4;
            else if (totalPoints > 150) starRating = 3;
            else if (totalPoints > 50) starRating = 2;

            return {
                totalPoints,
                starRating,
                achievements
            };
        } catch (error) {
            console.error('Error getting user stats:', error);
            return { totalPoints: 0, starRating: 1, achievements: [] };
        }
    }
};
