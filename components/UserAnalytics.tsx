
import React, { useEffect, useState } from 'react';
import { ResponsiveRadar } from '@nivo/radar';
import { ResponsiveBar } from '@nivo/bar';
import { achievementService } from '../services/achievementService';
import { UserAchievement } from '../types';

interface UserAnalyticsProps {
    userId: string;
}

const UserAnalytics: React.FC<UserAnalyticsProps> = ({ userId }) => {
    const [achievements, setAchievements] = useState<UserAchievement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const data = await achievementService.getUserAchievements(userId);
            setAchievements(data);
            setLoading(false);
        };
        load();
    }, [userId]);

    if (loading) return <div className="text-slate-400 text-sm animate-pulse">Loading analytics...</div>;

    if (achievements.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500 bg-slate-800/30 rounded-xl border border-slate-700/50">
                No achievement data available yet. Complete tasks to see analytics!
            </div>
        );
    }

    // --- Prepare Radar Data (Skills/Categories) ---
    // Categories: task_complete, phase_complete, milestone, collaboration, quality
    const categoryCounts: Record<string, number> = {
        'Task Execution': 0,
        'Project Milestones': 0,
        'Collaboration': 0,
        'Quality': 0
    };

    achievements.forEach(a => {
        if (a.category === 'task_complete') categoryCounts['Task Execution'] += (a.points || 0);
        else if (a.category === 'phase_complete' || a.category === 'milestone') categoryCounts['Project Milestones'] += (a.points || 0);
        else if (a.category === 'collaboration') categoryCounts['Collaboration'] += (a.points || 0);
        else if (a.category === 'quality') categoryCounts['Quality'] += (a.points || 0);
    });

    const radarData = Object.keys(categoryCounts).map(key => ({
        category: key,
        value: categoryCounts[key]
    }));

    // --- Prepare Bar Data (Activity over time - last 7 days or weeks) ---
    // Simple view: Last 5 achievements points
    const recentActivity = [...achievements]
        .sort((a, b) => (b.awardedAt as any) - (a.awardedAt as any)) // Descending
        .slice(0, 7)
        .reverse()
        .map((a, i) => ({
            id: i,
            date: new Date(a.awardedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            points: a.points,
            name: a.description.slice(0, 15) + '...'
        }));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Skills Radar */}
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 h-[400px]">
                <h3 className="text-lg font-bold text-white mb-4">Performance Profile</h3>
                <div className="h-[320px]">
                    <ResponsiveRadar
                        data={radarData}
                        keys={['value']}
                        indexBy="category"
                        maxValue="auto"
                        margin={{ top: 70, right: 80, bottom: 40, left: 80 }}
                        curve="linearClosed"
                        borderWidth={2}
                        borderColor={{ from: 'color' }}
                        gridLevels={5}
                        gridShape="circular"
                        gridLabelOffset={36}
                        enableDots={true}
                        dotSize={10}
                        dotColor={{ theme: 'background' }}
                        dotBorderWidth={2}
                        dotBorderColor={{ from: 'color' }}
                        enableDotLabel={true}
                        dotLabel="value"
                        dotLabelYOffset={-12}
                        colors={{ scheme: 'category10' }} // or custom
                        fillOpacity={0.25}
                        blendMode="multiply"
                        theme={{
                            textColor: '#94a3b8',
                            fontSize: 12,
                            grid: {
                                line: { stroke: '#475569', strokeWidth: 1 } // slate-600
                            },
                        }}
                    />
                </div>
            </div>

            {/* Recent Points Bar */}
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 h-[400px]">
                <h3 className="text-lg font-bold text-white mb-4">Recent Achievements</h3>
                <div className="h-[320px]">
                    <ResponsiveBar
                        data={recentActivity}
                        keys={['points']}
                        indexBy="date"
                        margin={{ top: 20, right: 20, bottom: 50, left: 50 }}
                        padding={0.3}
                        valueScale={{ type: 'linear' }}
                        indexScale={{ type: 'band', round: true }}
                        colors={{ scheme: 'nivo' }}
                        borderColor={{
                            from: 'color',
                            modifiers: [['darker', 1.6]]
                        }}
                        axisTop={null}
                        axisRight={null}
                        axisBottom={{
                            tickSize: 5,
                            tickPadding: 5,
                            tickRotation: 0,
                            legend: 'Date',
                            legendPosition: 'middle',
                            legendOffset: 32
                        }}
                        axisLeft={{
                            tickSize: 5,
                            tickPadding: 5,
                            tickRotation: 0,
                            legend: 'Points',
                            legendPosition: 'middle',
                            legendOffset: -40
                        }}
                        labelSkipWidth={12}
                        labelSkipHeight={12}
                        labelTextColor={{
                            from: 'color',
                            modifiers: [['darker', 1.6]]
                        }}
                        theme={{
                            textColor: '#94a3b8',
                            fontSize: 12,
                            axis: {
                                domain: { line: { stroke: '#475569' } },
                                ticks: { line: { stroke: '#475569' } }
                            },
                            tooltip: {
                                container: {
                                    background: '#1e293b', // slate-800
                                    color: '#f8fafc', // slate-50
                                    fontSize: 12,
                                    borderRadius: 4,
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                }
                            }
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default UserAnalytics;
