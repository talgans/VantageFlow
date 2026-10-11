
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

    // --- Helper to safely parse dates from Firestore or strings ---
    const parseAwardedDate = (awardedAt: any): Date => {
        if (!awardedAt) return new Date();
        if (typeof awardedAt.toDate === 'function') return awardedAt.toDate();
        if (awardedAt.seconds) return new Date(awardedAt.seconds * 1000);
        if (awardedAt instanceof Date) return awardedAt;
        const parsed = new Date(awardedAt);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
    };

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

    // --- Prepare Bar Data (Activity over time - last 7 achievements) ---
    const recentActivity = [...achievements]
        .sort((a, b) => {
            const timeA = parseAwardedDate(a.awardedAt).getTime();
            const timeB = parseAwardedDate(b.awardedAt).getTime();
            return timeB - timeA;
        })
        .slice(0, 7)
        .reverse()
        .map((a, i) => {
            const d = parseAwardedDate(a.awardedAt);
            return {
                id: i,
                date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                points: a.points || 0,
                name: a.description || 'Achievement',
                category: a.category || 'General'
            };
        });

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
                        dotSize={8}
                        dotColor="#3b82f6"
                        dotBorderWidth={2}
                        dotBorderColor="#1e293b"
                        enableDotLabel={true}
                        dotLabel="value"
                        dotLabelYOffset={-12}
                        colors={['#3b82f6']}
                        fillOpacity={0.35}
                        blendMode="normal"
                        sliceTooltip={({ index, data }) => (
                            <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1.5 min-w-[150px] pointer-events-none">
                                <div className="font-semibold text-white border-b border-slate-700/80 pb-1">{index}</div>
                                {data.map(d => (
                                    <div key={d.id} className="flex items-center justify-between gap-3">
                                        <span className="text-slate-300">Earned Points:</span>
                                        <span className="font-bold text-amber-400">+{d.value}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        theme={{
                            text: {
                                fill: '#cbd5e1',
                                fontSize: 12
                            },
                            axis: {
                                ticks: {
                                    text: {
                                        fill: '#cbd5e1', // High contrast slate-300 for category labels
                                        fontSize: 12,
                                        fontWeight: 600
                                    }
                                }
                            },
                            dots: {
                                text: {
                                    fill: '#f8fafc', // High contrast white for point numbers
                                    fontSize: 11,
                                    fontWeight: 700
                                }
                            },
                            grid: {
                                line: { stroke: '#334155', strokeWidth: 1 } // slate-700
                            },
                            tooltip: {
                                container: {
                                    background: '#0f172a',
                                    color: '#f8fafc',
                                    fontSize: 12,
                                    borderRadius: 8,
                                    border: '1px solid #334155',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
                                    padding: '8px 12px'
                                }
                            }
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
                        colors={['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1']}
                        colorBy="indexValue"
                        borderColor={{
                            from: 'color',
                            modifiers: [['darker', 0.6]]
                        }}
                        axisTop={null}
                        axisRight={null}
                        axisBottom={{
                            tickSize: 5,
                            tickPadding: 5,
                            tickRotation: 0,
                            legend: 'Date',
                            legendPosition: 'middle',
                            legendOffset: 36
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
                        labelTextColor="#ffffff"
                        tooltip={({ value, data, color }) => (
                            <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1.5 min-w-[170px] pointer-events-none">
                                <div className="font-semibold text-white line-clamp-2 leading-snug">{(data as any).name}</div>
                                <div className="text-slate-400 text-[11px] flex items-center justify-between">
                                    <span>{(data as any).date}</span>
                                    <span className="capitalize text-slate-400">{(data as any).category?.replace('_', ' ')}</span>
                                </div>
                                <div className="flex items-center justify-between pt-1.5 border-t border-slate-700/60 mt-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                        <span className="text-slate-300 font-medium">Points</span>
                                    </div>
                                    <span className="font-bold text-amber-400">+{value} pts</span>
                                </div>
                            </div>
                        )}
                        theme={{
                            text: {
                                fill: '#cbd5e1',
                                fontSize: 11
                            },
                            axis: {
                                domain: { line: { stroke: '#475569', strokeWidth: 1 } },
                                ticks: {
                                    line: { stroke: '#475569', strokeWidth: 1 },
                                    text: {
                                        fill: '#cbd5e1', // High contrast slate-300 for tick labels
                                        fontSize: 11,
                                        fontWeight: 500
                                    }
                                },
                                legend: {
                                    text: {
                                        fill: '#94a3b8', // slate-400 for axis names ('Date', 'Points')
                                        fontSize: 12,
                                        fontWeight: 600
                                    }
                                }
                            },
                            grid: {
                                line: { stroke: '#334155', strokeWidth: 1 } // slate-700
                            },
                            tooltip: {
                                container: {
                                    background: '#0f172a',
                                    color: '#f8fafc',
                                    fontSize: 12,
                                    borderRadius: 8,
                                    border: '1px solid #334155',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
                                    padding: '8px 12px'
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
