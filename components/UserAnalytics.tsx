
import React, { useEffect, useState, useMemo } from 'react';
import { ResponsiveRadar } from '@nivo/radar';
import { ResponsiveBar } from '@nivo/bar';
import { achievementService } from '../services/achievementService';
import { Project, UserAchievement } from '../types';
import { ChevronDownIcon, ChartBarIcon } from './icons';

interface UserAnalyticsProps {
    userId: string;
    userProjects?: Project[];
}

type TimeRange = '7d' | '30d' | '90d' | 'all';

interface ProgressDataPoint {
    date: string;
    fullDate: string;
    Tasks: number;
    Milestones: number;
    Other: number;
    total: number;
    achievements: UserAchievement[];
}

const UserAnalytics: React.FC<UserAnalyticsProps> = ({ userId, userProjects = [] }) => {
    const [achievements, setAchievements] = useState<UserAchievement[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
    const [timeRange, setTimeRange] = useState<TimeRange>('30d');

    useEffect(() => {
        const load = async () => {
            const data = await achievementService.getUserAchievements(userId);
            setAchievements(data);
            setLoading(false);
        };
        load();
    }, [userId]);

    // Build project list for filtering (including any referenced project from achievements)
    const availableProjects = useMemo(() => {
        const list = [...userProjects];
        const existingIds = new Set(list.map(p => p.id));

        achievements.forEach(a => {
            if (a.projectId && !existingIds.has(a.projectId)) {
                existingIds.add(a.projectId);
                list.push({
                    id: a.projectId,
                    name: `Project (${a.projectId.slice(0, 6)})`,
                } as Project);
            }
        });
        return list;
    }, [userProjects, achievements]);

    // Helper to safely parse dates from Firestore or strings
    const parseAwardedDate = (awardedAt: any): Date => {
        if (!awardedAt) return new Date();
        if (typeof awardedAt.toDate === 'function') return awardedAt.toDate();
        if (awardedAt.seconds) return new Date(awardedAt.seconds * 1000);
        if (awardedAt instanceof Date) return awardedAt;
        const parsed = new Date(awardedAt);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
    };

    // Filter achievements by project
    const projectAchievements = useMemo(() => {
        if (selectedProjectId === 'all') return achievements;
        return achievements.filter(a => a.projectId === selectedProjectId);
    }, [achievements, selectedProjectId]);

    // Selected project name for display
    const selectedProjectName = useMemo(() => {
        if (selectedProjectId === 'all') return 'All My Projects';
        return availableProjects.find(p => p.id === selectedProjectId)?.name || 'Selected Project';
    }, [selectedProjectId, availableProjects]);

    // Prepare Radar Data (Skills/Categories)
    const { radarData, radarTotalPoints } = useMemo(() => {
        const categoryCounts: Record<string, number> = {
            'Task Execution': 0,
            'Project Milestones': 0,
            'Collaboration': 0,
            'Quality': 0
        };

        let total = 0;
        projectAchievements.forEach(a => {
            const pts = a.points || 0;
            total += pts;
            if (a.category === 'task_complete') categoryCounts['Task Execution'] += pts;
            else if (a.category === 'phase_complete' || a.category === 'milestone') categoryCounts['Project Milestones'] += pts;
            else if (a.category === 'collaboration') categoryCounts['Collaboration'] += pts;
            else if (a.category === 'quality') categoryCounts['Quality'] += pts;
        });

        const data = Object.keys(categoryCounts).map(key => ({
            category: key,
            value: categoryCounts[key]
        }));

        return { radarData: data, radarTotalPoints: total };
    }, [projectAchievements]);

    // Prepare Progress Over Time Data
    const { progressData, periodTotalPoints, periodAchievementCount } = useMemo(() => {
        const now = new Date();

        if (timeRange === '7d') {
            const days: (ProgressDataPoint & { dayStart: Date; dayEnd: Date })[] = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
                const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
                days.push({
                    date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                    fullDate: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
                    dayStart: start,
                    dayEnd: end,
                    Tasks: 0,
                    Milestones: 0,
                    Other: 0,
                    total: 0,
                    achievements: []
                });
            }

            let totalPts = 0;
            let count = 0;

            projectAchievements.forEach(a => {
                const aDate = parseAwardedDate(a.awardedAt);
                const bucket = days.find(day => aDate >= day.dayStart && aDate <= day.dayEnd);
                if (bucket) {
                    const pts = a.points || 0;
                    totalPts += pts;
                    count++;
                    bucket.total += pts;
                    bucket.achievements.push(a);
                    if (a.category === 'task_complete') {
                        bucket.Tasks += pts;
                    } else if (a.category === 'phase_complete' || a.category === 'milestone') {
                        bucket.Milestones += pts;
                    } else {
                        bucket.Other += pts;
                    }
                }
            });

            return {
                progressData: days,
                periodTotalPoints: totalPts,
                periodAchievementCount: count
            };
        }

        if (timeRange === '30d') {
            const days: (ProgressDataPoint & { dayStart: Date; dayEnd: Date })[] = [];
            for (let i = 29; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
                const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
                days.push({
                    date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                    fullDate: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
                    dayStart: start,
                    dayEnd: end,
                    Tasks: 0,
                    Milestones: 0,
                    Other: 0,
                    total: 0,
                    achievements: []
                });
            }

            let totalPts = 0;
            let count = 0;

            projectAchievements.forEach(a => {
                const aDate = parseAwardedDate(a.awardedAt);
                const bucket = days.find(day => aDate >= day.dayStart && aDate <= day.dayEnd);
                if (bucket) {
                    const pts = a.points || 0;
                    totalPts += pts;
                    count++;
                    bucket.total += pts;
                    bucket.achievements.push(a);
                    if (a.category === 'task_complete') {
                        bucket.Tasks += pts;
                    } else if (a.category === 'phase_complete' || a.category === 'milestone') {
                        bucket.Milestones += pts;
                    } else {
                        bucket.Other += pts;
                    }
                }
            });

            return {
                progressData: days,
                periodTotalPoints: totalPts,
                periodAchievementCount: count
            };
        }

        if (timeRange === '90d') {
            const weeks: (ProgressDataPoint & { weekStart: Date; weekEnd: Date })[] = [];
            for (let i = 11; i >= 0; i--) {
                const start = new Date(now);
                start.setDate(start.getDate() - (i * 7 + 6));
                start.setHours(0, 0, 0, 0);

                const end = new Date(now);
                end.setDate(end.getDate() - (i * 7));
                end.setHours(23, 59, 59, 999);

                weeks.push({
                    date: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                    fullDate: `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,
                    weekStart: start,
                    weekEnd: end,
                    Tasks: 0,
                    Milestones: 0,
                    Other: 0,
                    total: 0,
                    achievements: []
                });
            }

            let totalPts = 0;
            let count = 0;

            projectAchievements.forEach(a => {
                const aDate = parseAwardedDate(a.awardedAt);
                const bucket = weeks.find(w => aDate >= w.weekStart && aDate <= w.weekEnd);
                if (bucket) {
                    const pts = a.points || 0;
                    totalPts += pts;
                    count++;
                    bucket.total += pts;
                    bucket.achievements.push(a);
                    if (a.category === 'task_complete') {
                        bucket.Tasks += pts;
                    } else if (a.category === 'phase_complete' || a.category === 'milestone') {
                        bucket.Milestones += pts;
                    } else {
                        bucket.Other += pts;
                    }
                }
            });

            return {
                progressData: weeks,
                periodTotalPoints: totalPts,
                periodAchievementCount: count
            };
        }

        // timeRange === 'all'
        const monthsMap = new Map<string, ProgressDataPoint & { monthStart: Date; monthEnd: Date }>();

        // Default to last 6 months
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
            const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            monthsMap.set(key, {
                date: d.toLocaleDateString(undefined, { month: 'short' }),
                fullDate: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
                monthStart: start,
                monthEnd: end,
                Tasks: 0,
                Milestones: 0,
                Other: 0,
                total: 0,
                achievements: []
            });
        }

        let totalPts = 0;
        let count = 0;

        projectAchievements.forEach(a => {
            const aDate = parseAwardedDate(a.awardedAt);
            const key = `${aDate.getFullYear()}-${aDate.getMonth()}`;
            if (!monthsMap.has(key)) {
                const start = new Date(aDate.getFullYear(), aDate.getMonth(), 1, 0, 0, 0, 0);
                const end = new Date(aDate.getFullYear(), aDate.getMonth() + 1, 0, 23, 59, 59, 999);
                monthsMap.set(key, {
                    date: aDate.toLocaleDateString(undefined, { month: 'short' }),
                    fullDate: aDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
                    monthStart: start,
                    monthEnd: end,
                    Tasks: 0,
                    Milestones: 0,
                    Other: 0,
                    total: 0,
                    achievements: []
                });
            }
            const m = monthsMap.get(key)!;
            const pts = a.points || 0;
            totalPts += pts;
            count++;
            m.total += pts;
            m.achievements.push(a);
            if (a.category === 'task_complete') {
                m.Tasks += pts;
            } else if (a.category === 'phase_complete' || a.category === 'milestone') {
                m.Milestones += pts;
            } else {
                m.Other += pts;
            }
        });

        const sortedMonths = Array.from(monthsMap.values()).sort((a, b) => a.monthStart.getTime() - b.monthStart.getTime());

        return {
            progressData: sortedMonths,
            periodTotalPoints: totalPts,
            periodAchievementCount: count
        };
    }, [projectAchievements, timeRange]);

    if (loading) return <div className="text-slate-400 text-sm animate-pulse">Loading analytics...</div>;

    if (achievements.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500 bg-slate-800/30 rounded-xl border border-slate-700/50">
                No achievement data available yet. Complete tasks to see analytics!
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Skills Radar */}
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 flex flex-col justify-between min-h-[440px]">
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="text-lg font-bold text-white">Performance Profile</h3>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {radarTotalPoints} pts
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate" title={selectedProjectName}>
                        {selectedProjectName}
                    </p>
                </div>

                <div className="h-[320px] flex-grow">
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
                                        fill: '#cbd5e1',
                                        fontSize: 12,
                                        fontWeight: 600
                                    }
                                }
                            },
                            dots: {
                                text: {
                                    fill: '#f8fafc',
                                    fontSize: 11,
                                    fontWeight: 700
                                }
                            },
                            grid: {
                                line: { stroke: '#334155', strokeWidth: 1 }
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

            {/* Progress Over Time Bar */}
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 flex flex-col justify-between min-h-[440px]">
                {/* Header with Project Selector & Time Range Toggles */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-white">Progress Over Time</h3>
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                +{periodTotalPoints} pts
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {periodAchievementCount} achievement{periodAchievementCount === 1 ? '' : 's'} in selected period
                        </p>
                    </div>

                    <div className="flex items-center flex-wrap gap-2">
                        {/* Project Dropdown */}
                        <div className="relative">
                            <select
                                value={selectedProjectId}
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 pr-7 appearance-none focus:outline-none focus:ring-1 focus:ring-brand-secondary cursor-pointer hover:border-slate-600 transition-colors max-w-[150px] truncate"
                                title="Filter by project"
                            >
                                <option value="all">All My Projects</option>
                                {availableProjects.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-400">
                                <ChevronDownIcon className="w-3.5 h-3.5" />
                            </div>
                        </div>

                        {/* Time Range Pills */}
                        <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-0.5">
                            {(['7d', '30d', '90d', 'all'] as const).map(range => (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                                        timeRange === range
                                            ? 'bg-brand-secondary text-white shadow-sm'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                    }`}
                                >
                                    {range === '7d' ? '7D' : range === '30d' ? '30D' : range === '90d' ? '90D' : 'All'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Chart Area */}
                {periodTotalPoints === 0 && progressData.every(d => d.total === 0) ? (
                    <div className="h-[280px] flex flex-col items-center justify-center text-center p-6 bg-slate-900/30 rounded-lg border border-dashed border-slate-700/60 my-auto">
                        <ChartBarIcon className="w-10 h-10 text-slate-600 mb-2" />
                        <p className="text-sm font-medium text-slate-300">No activity recorded</p>
                        <p className="text-xs text-slate-500 mt-1 max-w-xs">
                            No achievement points were earned in this time period for {selectedProjectId === 'all' ? 'your projects' : 'this project'}.
                        </p>
                    </div>
                ) : (
                    <div className="h-[280px] flex-grow">
                        <ResponsiveBar
                            data={progressData}
                            keys={['Tasks', 'Milestones', 'Other']}
                            indexBy="date"
                            margin={{ top: 15, right: 15, bottom: 45, left: 45 }}
                            padding={timeRange === '30d' ? 0.25 : 0.4}
                            valueScale={{ type: 'linear' }}
                            indexScale={{ type: 'band', round: true }}
                            colors={['#3b82f6', '#f59e0b', '#10b981']}
                            borderColor={{
                                from: 'color',
                                modifiers: [['darker', 0.6]]
                            }}
                            axisTop={null}
                            axisRight={null}
                            axisBottom={{
                                tickSize: 4,
                                tickPadding: 6,
                                tickRotation: timeRange === '30d' ? -35 : 0,
                                format: (val: string) => {
                                    if (timeRange === '30d') {
                                        const idx = progressData.findIndex(d => d.date === val);
                                        return idx % 5 === 0 || idx === progressData.length - 1 ? val : '';
                                    }
                                    return val;
                                }
                            }}
                            axisLeft={{
                                tickSize: 4,
                                tickPadding: 6,
                                tickRotation: 0,
                                legend: 'Points',
                                legendPosition: 'middle',
                                legendOffset: -38
                            }}
                            enableLabel={timeRange !== '30d'}
                            labelSkipHeight={12}
                            labelTextColor="#ffffff"
                            tooltip={({ data }) => {
                                const pt = data as unknown as ProgressDataPoint;
                                return (
                                    <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-2 min-w-[190px] pointer-events-none">
                                        <div className="font-semibold text-white border-b border-slate-700/80 pb-1.5 flex items-center justify-between">
                                            <span>{pt.fullDate || pt.date}</span>
                                            <span className="text-amber-400 font-bold">+{pt.total} pts</span>
                                        </div>

                                        <div className="space-y-1 text-slate-300">
                                            {pt.Tasks > 0 && (
                                                <div className="flex items-center justify-between">
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                                                        Tasks:
                                                    </span>
                                                    <span className="font-medium text-white">+{pt.Tasks} pts</span>
                                                </div>
                                            )}
                                            {pt.Milestones > 0 && (
                                                <div className="flex items-center justify-between">
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                                                        Milestones:
                                                    </span>
                                                    <span className="font-medium text-white">+{pt.Milestones} pts</span>
                                                </div>
                                            )}
                                            {pt.Other > 0 && (
                                                <div className="flex items-center justify-between">
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                                        Other:
                                                    </span>
                                                    <span className="font-medium text-white">+{pt.Other} pts</span>
                                                </div>
                                            )}
                                        </div>

                                        {pt.achievements.length > 0 && (
                                            <div className="pt-1.5 border-t border-slate-700/60 space-y-1">
                                                <p className="text-[10px] uppercase font-semibold text-slate-400">Activity ({pt.achievements.length})</p>
                                                {pt.achievements.slice(0, 3).map((a, idx) => (
                                                    <p key={idx} className="text-[11px] text-slate-300 truncate" title={a.description}>
                                                        • {a.description || 'Achievement earned'}
                                                    </p>
                                                ))}
                                                {pt.achievements.length > 3 && (
                                                    <p className="text-[10px] text-slate-500">+{pt.achievements.length - 3} more</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            }}
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
                                            fill: '#cbd5e1',
                                            fontSize: 10,
                                            fontWeight: 500
                                        }
                                    },
                                    legend: {
                                        text: {
                                            fill: '#94a3b8',
                                            fontSize: 11,
                                            fontWeight: 600
                                        }
                                    }
                                },
                                grid: {
                                    line: { stroke: '#334155', strokeWidth: 1 }
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
                )}

                {/* Subtitle / Legend */}
                <div className="flex items-center justify-center gap-4 text-xs text-slate-400 mt-2 pt-2 border-t border-slate-700/40">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                        <span>Tasks (+10)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                        <span>Milestones (+50)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                        <span>Other</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserAnalytics;
