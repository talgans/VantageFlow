
import React, { useEffect, useState, useMemo } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsiveCalendar } from '@nivo/calendar';
import { achievementService } from '../services/achievementService';
import { UserAchievement, Project } from '../types';
import { useUserLookup } from '../hooks/useUserLookup';
import { StarIcon, TrophyIcon, FireIcon } from './icons';

interface UserPerformanceDashboardProps {
    projects: Project[];
}

interface LeaderboardEntry {
    userId: string;
    points: number;
    achievements: number;
}

const UserPerformanceDashboard: React.FC<UserPerformanceDashboardProps> = ({ projects }) => {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [achievements, setAchievements] = useState<UserAchievement[]>([]);
    const [loading, setLoading] = useState(true);
    const { getUserDisplayName, getUserPhotoURL } = useUserLookup();

    // Build a fallback user lookup from project team members
    const projectUserLookup = useMemo(() => {
        const lookup = new Map<string, { displayName?: string; photoURL?: string; email: string }>();
        projects.forEach(project => {
            project.team?.members?.forEach(member => {
                if (!lookup.has(member.uid)) {
                    lookup.set(member.uid, {
                        displayName: member.displayName,
                        photoURL: member.photoURL,
                        email: member.email
                    });
                }
            });
        });
        return lookup;
    }, [projects]);

    // Enhanced lookup functions with fallback
    const getDisplayName = (userId: string, fallback: string = 'User'): string => {
        const name = getUserDisplayName(userId);
        if (name && name !== 'User' && name !== '?') return name;

        const projectUser = projectUserLookup.get(userId);

        // Try displayName first
        if (projectUser?.displayName) {
            return projectUser.displayName;
        }

        // Extract name from email as last resort
        if (projectUser?.email) {
            const emailName = projectUser.email.split('@')[0];
            // Convert bashir.mahmud -> Bashir Mahmud
            const formatted = emailName.split(/[._-]/).map(part =>
                part.charAt(0).toUpperCase() + part.slice(1)
            ).join(' ');
            return formatted;
        }

        return fallback;
    };

    const getPhotoURL = (userId: string, fallback: string = ''): string => {
        const photo = getUserPhotoURL(userId);
        if (photo) return photo;
        const projectUser = projectUserLookup.get(userId);
        return projectUser?.photoURL || fallback;
    };

    useEffect(() => {
        const loadData = async () => {
            const [lbData, achData] = await Promise.all([
                achievementService.getLeaderboard(),
                achievementService.getAllAchievements()
            ]);
            setLeaderboard(lbData);
            setAchievements(achData);
            setLoading(false);
        };
        loadData();
    }, []);

    // --- Data Prep for Project Stacks ---
    // X: Project Names
    // Y: Points
    // Stack: Users
    const projectBarData = useMemo(() => {
        const projectPoints: Record<string, Record<string, number>> = {};

        achievements.forEach(a => {
            if (a.projectId) {
                const proj = projects.find(p => p.id === a.projectId);
                const projName = proj ? proj.name : 'Unknown Project';

                if (!projectPoints[projName]) {
                    projectPoints[projName] = { project: projName as any };
                }

                const userName = getDisplayName(a.userId, 'User');
                projectPoints[projName][userName] = (projectPoints[projName][userName] || 0) + a.points;
            }
        });

        return Object.values(projectPoints);
    }, [achievements, projects, getUserDisplayName]);

    // Get all unique user names involved in projects for legend/keys
    const userKeys = useMemo(() => {
        const keys = new Set<string>();
        projectBarData.forEach((row: any) => {
            Object.keys(row).forEach(k => {
                if (k !== 'project') keys.add(k);
            });
        });
        return Array.from(keys);
    }, [projectBarData]);


    // --- Data Prep for Calendar (Activity Heatmap) ---
    // Date: YYYY-MM-DD
    // Value: Points
    const calendarData = useMemo(() => {
        const dailyPoints: Record<string, number> = {};
        achievements.forEach(a => {
            // Check if awardedAt is a Firestore Timestamp or Date
            let dateObj: Date;
            if ((a.awardedAt as any).toDate) {
                dateObj = (a.awardedAt as any).toDate();
            } else {
                dateObj = new Date(a.awardedAt);
            }

            const dayKey = dateObj.toISOString().split('T')[0];
            dailyPoints[dayKey] = (dailyPoints[dayKey] || 0) + (a.points || 0);
        });

        return Object.keys(dailyPoints).map(day => ({
            day,
            value: dailyPoints[day]
        }));
    }, [achievements]);

    if (loading) return (
        <div className="flex items-center justify-center h-screen bg-slate-900 text-slate-400">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-secondary"></div>
        </div>
    );

    const topPerformer = leaderboard.length > 0 ? leaderboard[0] : null;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Performance Dashboard</h1>
                    <p className="text-slate-400">Team achievements, leaderboard, and activity metrics.</p>
                </div>
                {topPerformer && (
                    <div className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 p-4 rounded-xl flex items-center gap-4">
                        <div className="relative">
                            <TrophyIcon className="w-10 h-10 text-yellow-400" />
                            <div className="absolute -top-1 -right-1 animate-ping w-3 h-3 bg-yellow-200 rounded-full opacity-75"></div>
                        </div>
                        <div>
                            <p className="text-yellow-200 text-xs font-bold uppercase tracking-wider">Top Performer</p>
                            <p className="text-white font-bold text-lg">{getDisplayName(topPerformer.userId, 'Unknown')}</p>
                            <p className="text-yellow-400/80 text-sm">{topPerformer.points} Points</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Leaderboard */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 lg:col-span-1">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <StarIcon className="w-6 h-6 text-yellow-400" /> Leaderboard
                    </h3>
                    <div className="space-y-3">
                        {leaderboard.map((entry, index) => {
                            const isTop3 = index < 3;
                            return (
                                <div key={entry.userId} className={`flex items-center justify-between p-3 rounded-lg ${isTop3 ? 'bg-slate-700/80 border border-slate-600' : 'bg-slate-800 border border-slate-700/50'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                                            ${index === 0 ? 'bg-yellow-500 text-slate-900' :
                                                index === 1 ? 'bg-slate-300 text-slate-800' :
                                                    index === 2 ? 'bg-amber-700 text-white' : 'bg-slate-700 text-slate-400'}
                                        `}>
                                            {index + 1}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {/* Avatar if available */}
                                            <div className="w-8 h-8 rounded-full bg-slate-600 overflow-hidden">
                                                {getPhotoURL(entry.userId, '') ?
                                                    <img src={getPhotoURL(entry.userId, '')} alt="" className="w-full h-full object-cover" /> :
                                                    <div className="w-full h-full flex items-center justify-center text-xs text-white">
                                                        {(getDisplayName(entry.userId, '?') || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                }
                                            </div>
                                            <span className={`font-medium ${isTop3 ? 'text-white' : 'text-slate-300'}`}>
                                                {getDisplayName(entry.userId, 'User')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-brand-light">{entry.points} pts</div>
                                        <div className="text-xs text-slate-500">{entry.achievements} awards</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Project Performance Chart */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 lg:col-span-2 flex flex-col">
                    <h3 className="text-xl font-bold text-white mb-4">Points by Project</h3>
                    <div className="flex-grow min-h-[300px]">
                        <ResponsiveBar
                            data={projectBarData}
                            keys={userKeys}
                            indexBy="project"
                            margin={{ top: 20, right: 130, bottom: 50, left: 60 }}
                            padding={0.3}
                            valueScale={{ type: 'linear' }}
                            indexScale={{ type: 'band', round: true }}
                            colors={{ scheme: 'nivo' }}
                            textColor="#94a3b8"
                            theme={{
                                axis: {
                                    ticks: { text: { fill: '#94a3b8' } },
                                    legend: { text: { fill: '#94a3b8' } }
                                },
                                grid: { line: { stroke: '#334155' } },
                                legends: { text: { fill: '#94a3b8' } },
                                tooltip: {
                                    container: {
                                        background: '#1e293b',
                                        color: '#f8fafc',
                                    }
                                }
                            }}
                            borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
                            axisTop={null}
                            axisRight={null}
                            axisBottom={{
                                tickSize: 5,
                                tickPadding: 5,
                                tickRotation: 0,
                                legend: 'Project',
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
                            legends={[
                                {
                                    dataFrom: 'keys',
                                    anchor: 'bottom-right',
                                    direction: 'column',
                                    justify: false,
                                    translateX: 120,
                                    translateY: 0,
                                    itemsSpacing: 2,
                                    itemWidth: 100,
                                    itemHeight: 20,
                                    itemDirection: 'left-to-right',
                                    itemOpacity: 0.85,
                                    symbolSize: 20,
                                    effects: [
                                        {
                                            on: 'hover',
                                            style: {
                                                itemOpacity: 1
                                            }
                                        }
                                    ]
                                }
                            ]}
                        />
                    </div>
                </div>
            </div>

            {/* Activity Calendar Heatmap */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <FireIcon className="w-5 h-5 text-orange-500" /> Team Activity Heatmap
                </h3>
                <div className="h-[200px]">
                    <ResponsiveCalendar
                        data={calendarData}
                        from={new Date(new Date().setMonth(new Date().getMonth() - 2)).toISOString().split('T')[0]}
                        to={new Date().toISOString().split('T')[0]}
                        emptyColor="#1e293b" // slate-800
                        colors={['#1e293b', '#0e7490', '#0ea5e9', '#38bdf8', '#7dd3fc']} // blue scale
                        margin={{ top: 20, right: 40, bottom: 20, left: 40 }}
                        yearSpacing={40}
                        monthBorderColor="#334155"
                        dayBorderWidth={2}
                        dayBorderColor="#0f172a"
                        theme={{
                            textColor: '#94a3b8',
                            fontSize: 12
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default UserPerformanceDashboard;
