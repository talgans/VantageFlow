import React, { useEffect, useState } from 'react';
import { achievementService } from '../services/achievementService';
import { StarIcon } from './icons';

interface UserAchievementBadgeProps {
    userId: string;
    showPoints?: boolean;
}

const UserAchievementBadge: React.FC<UserAchievementBadgeProps> = ({ userId, showPoints = false }) => {
    const [rating, setRating] = useState<number>(1);
    const [points, setPoints] = useState<number>(0);

    useEffect(() => {
        if (!userId) return;
        const loadStats = async () => {
            const stats = await achievementService.getUserStats(userId);
            setRating(stats.starRating);
            setPoints(stats.totalPoints);
        };
        loadStats();
    }, [userId]);

    return (
        <div className="flex items-center gap-1" title={`${points} points`}>
            <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                    <StarIcon
                        key={star}
                        className={`w-4 h-4 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}`}
                    />
                ))}
            </div>
            {showPoints && (
                <span className="text-xs text-slate-400 ml-1">
                    ({points})
                </span>
            )}
        </div>
    );
};

export default UserAchievementBadge;
