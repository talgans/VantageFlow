import React, { useState, useMemo } from 'react';

// Types
interface CalendarDataPoint {
    day: string; // YYYY-MM-DD format
    value: number;
}

interface TeamActivityHeatmapProps {
    data: CalendarDataPoint[];
    futureData?: CalendarDataPoint[]; // Future tasks data (amber)
    overdueData?: CalendarDataPoint[]; // Overdue/incomplete past tasks (rose)
    view?: 'week' | 'month' | 'quarter' | 'year' | 'range';
    showStats?: boolean;
    title?: string;
}

type ViewType = 'week' | 'month' | 'quarter' | 'year' | 'range';

// View configuration (range is dynamic, calculated from date picker)
const VIEW_CONFIG: Record<Exclude<ViewType, 'range'>, { weeks: number; cellSize: number; label: string }> = {
    week: { weeks: 1, cellSize: 24, label: 'Week' },
    month: { weeks: 5, cellSize: 18, label: 'Month' },
    quarter: { weeks: 13, cellSize: 14, label: 'Quarter' },
    year: { weeks: 52, cellSize: 10, label: 'Year' },
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Color intensity levels for past activity (cyan gradient)
const INTENSITY_COLORS = [
    '#1e293b', // 0: empty (slate-800)
    '#164e63', // 1: low (cyan-900)
    '#0e7490', // 2: medium-low (cyan-700)
    '#0891b2', // 3: medium (cyan-600)
    '#22d3ee', // 4: high (cyan-400)
];

// Color intensity levels for future tasks (amber gradient)
const FUTURE_INTENSITY_COLORS = [
    '#1e293b', // 0: empty (slate-800)
    '#78350f', // 1: low (amber-900)
    '#b45309', // 2: medium-low (amber-700)
    '#d97706', // 3: medium (amber-600)
    '#fbbf24', // 4: high (amber-400)
];

// Color intensity levels for overdue tasks (rose gradient)
const OVERDUE_INTENSITY_COLORS = [
    '#1e293b', // 0: empty (slate-800)
    '#881337', // 1: low (rose-900)
    '#be123c', // 2: medium-low (rose-700)
    '#e11d48', // 3: medium (rose-600)
    '#fb7185', // 4: high (rose-400)
];

// Helper functions
function getDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function getStartOfWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() - day);
    result.setHours(0, 0, 0, 0);
    return result;
}

function getIntensityLevel(value: number, max: number): number {
    if (value === 0 || max === 0) return 0;
    const percentage = value / max;
    if (percentage <= 0.25) return 1;
    if (percentage <= 0.50) return 2;
    if (percentage <= 0.75) return 3;
    return 4;
}

function calculateCurrentStreak(dataMap: Map<string, number>): number {
    let streak = 0;
    let checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);

    // Check today first
    const todayKey = getDateKey(checkDate);
    if (!dataMap.has(todayKey) || dataMap.get(todayKey) === 0) {
        // Check yesterday instead (streak might be ongoing but no activity today yet)
        checkDate = addDays(checkDate, -1);
    }

    while (true) {
        const key = getDateKey(checkDate);
        if (dataMap.has(key) && (dataMap.get(key) || 0) > 0) {
            streak++;
            checkDate = addDays(checkDate, -1);
        } else {
            break;
        }
    }

    return streak;
}

function calculateLongestStreak(dataMap: Map<string, number>): number {
    const sortedDates = Array.from(dataMap.entries())
        .filter(([_, value]) => value > 0)
        .map(([date]) => new Date(date))
        .sort((a, b) => a.getTime() - b.getTime());

    if (sortedDates.length === 0) return 0;

    let longestStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < sortedDates.length; i++) {
        const diffDays = Math.round(
            (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffDays === 1) {
            currentStreak++;
            longestStreak = Math.max(longestStreak, currentStreak);
        } else {
            currentStreak = 1;
        }
    }

    return longestStreak;
}

// Tooltip component
const Tooltip: React.FC<{
    date: string;
    value: number;
    isFuture?: boolean;
    isOverdue?: boolean;
    x: number;
    y: number;
}> = ({ date, value, isFuture, isOverdue, x, y }) => {
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    // Determine styling based on type
    let bgClass = 'bg-slate-700 border-slate-600';
    let labelText = `${value} ${value === 1 ? 'point' : 'points'}`;

    if (isOverdue) {
        bgClass = 'bg-rose-900/90 border-rose-700';
        labelText = `${value} ${value === 1 ? 'task' : 'tasks'} overdue`;
    } else if (isFuture) {
        bgClass = 'bg-amber-900/90 border-amber-700';
        labelText = `${value} ${value === 1 ? 'task' : 'tasks'} due`;
    }

    return (
        <div
            className={`absolute z-50 px-3 py-2 border rounded-lg shadow-xl text-sm pointer-events-none transform -translate-x-1/2 ${bgClass}`}
            style={{
                left: x,
                top: y - 50,
            }}
        >
            <div className="font-semibold text-white">{labelText}</div>
            <div className="text-slate-300 text-xs">{formattedDate}</div>
            <div className={`absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-2.5 h-2.5 border-r border-b rotate-45 ${bgClass}`} />
        </div>
    );
};

// Main component
const TeamActivityHeatmap: React.FC<TeamActivityHeatmapProps> = ({
    data,
    futureData = [],
    overdueData = [],
    view: initialView = 'month',
    showStats = true,
    title = 'Team Activity Heatmap',
}) => {
    const [activeView, setActiveView] = useState<ViewType>(initialView);
    const [tooltip, setTooltip] = useState<{
        date: string;
        value: number;
        isFuture?: boolean;
        isOverdue?: boolean;
        x: number;
        y: number;
    } | null>(null);

    // Date range state for custom range view
    const today = new Date();
    const defaultStartDate = new Date(today);
    defaultStartDate.setDate(today.getDate() - 30);

    const [rangeStart, setRangeStart] = useState<string>(defaultStartDate.toISOString().split('T')[0]);
    const [rangeEnd, setRangeEnd] = useState<string>(today.toISOString().split('T')[0]);

    // Create data map for quick lookups (past activity)
    const dataMap = useMemo(() => {
        const map = new Map<string, number>();
        data.forEach((d) => {
            map.set(d.day, (map.get(d.day) || 0) + d.value);
        });
        return map;
    }, [data]);

    // Create future data map for quick lookups (future tasks)
    const futureDataMap = useMemo(() => {
        const map = new Map<string, number>();
        futureData.forEach((d) => {
            map.set(d.day, (map.get(d.day) || 0) + d.value);
        });
        return map;
    }, [futureData]);

    // Create overdue data map for quick lookups (incomplete past tasks)
    const overdueDataMap = useMemo(() => {
        const map = new Map<string, number>();
        overdueData.forEach((d) => {
            map.set(d.day, (map.get(d.day) || 0) + d.value);
        });
        return map;
    }, [overdueData]);

    // Calculate max value for future tasks intensity
    const maxFutureValue = useMemo(() => {
        return Math.max(...futureData.map(d => d.value), 1);
    }, [futureData]);

    // Calculate max value for overdue tasks intensity
    const maxOverdueValue = useMemo(() => {
        return Math.max(...overdueData.map(d => d.value), 1);
    }, [overdueData]);

    // Calculate statistics
    const stats = useMemo(() => {
        const total = data.reduce((sum, d) => sum + d.value, 0);
        const currentStreak = calculateCurrentStreak(dataMap);
        const longestStreak = calculateLongestStreak(dataMap);

        return { total, currentStreak, longestStreak };
    }, [data, dataMap]);

    // Generate grid data based on view
    const gridData = useMemo(() => {
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        let weeks: number;
        let cellSize: number;
        let startDate: Date;
        let endDate: Date;

        if (activeView === 'range') {
            // Custom range view
            startDate = new Date(rangeStart);
            endDate = new Date(rangeEnd);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);

            // Calculate weeks between dates
            const diffTime = endDate.getTime() - startDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            weeks = Math.ceil(diffDays / 7) + 1;

            // Dynamically size cells based on range
            if (weeks <= 5) {
                cellSize = 18;
            } else if (weeks <= 13) {
                cellSize = 14;
            } else if (weeks <= 26) {
                cellSize = 12;
            } else {
                cellSize = 10;
            }
        } else if (activeView === 'month') {
            // Calendar month view - show entire current month (1st to last day)
            const currentYear = todayDate.getFullYear();
            const currentMonth = todayDate.getMonth();

            // First day of current month
            startDate = new Date(currentYear, currentMonth, 1);
            startDate.setHours(0, 0, 0, 0);

            // Last day of current month (show entire month, not just up to today)
            endDate = new Date(currentYear, currentMonth + 1, 0);
            endDate.setHours(0, 0, 0, 0);

            // Calculate weeks needed (from start of week containing 1st, to end of week containing last day)
            const firstWeekStart = getStartOfWeek(startDate);
            const lastWeekStart = getStartOfWeek(endDate);

            const diffTime = lastWeekStart.getTime() - firstWeekStart.getTime();
            weeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24) / 7) + 1;
            cellSize = 18;
        } else {
            const config = VIEW_CONFIG[activeView];
            weeks = config.weeks;
            cellSize = config.cellSize;

            // Calculate start date (beginning of the week, N weeks ago)
            const endOfWeek = getStartOfWeek(todayDate);
            endOfWeek.setDate(endOfWeek.getDate() + 6);
            startDate = addDays(endOfWeek, -(weeks * 7) + 1);
            endDate = todayDate;
        }

        // Build grid: columns = weeks, rows = days of week
        const weeksData: Array<{
            weekStart: Date;
            days: Array<{ date: Date; dateKey: string; value: number; futureValue: number; overdueValue: number }>;
        }> = [];

        let currentWeekStart = getStartOfWeek(startDate);

        for (let w = 0; w < weeks; w++) {
            const week = {
                weekStart: new Date(currentWeekStart),
                days: [] as Array<{ date: Date; dateKey: string; value: number; futureValue: number; overdueValue: number }>,
            };

            for (let d = 0; d < 7; d++) {
                const date = addDays(currentWeekStart, d);
                const dateKey = getDateKey(date);
                const value = dataMap.get(dateKey) || 0;
                const futureValue = futureDataMap.get(dateKey) || 0;
                const overdueValue = overdueDataMap.get(dateKey) || 0;

                // Check if date is within range
                const isInRange = date >= startDate && date <= endDate;
                const isFuture = date > todayDate;

                if (isInRange && !isFuture) {
                    // Past or today, in range - show with actual value and overdue info
                    week.days.push({ date, dateKey, value, futureValue: 0, overdueValue });
                } else if (isInRange && isFuture) {
                    // Future day but within month range - show with future task value (amber)
                    week.days.push({ date, dateKey, value: -2, futureValue, overdueValue: 0 });
                } else {
                    week.days.push({ date, dateKey, value: -1, futureValue: 0, overdueValue: 0 }); // -1 = out of range
                }
            }

            weeksData.push(week);
            currentWeekStart = addDays(currentWeekStart, 7);
        }

        // Find max value for intensity calculation
        const maxValue = Math.max(...data.map((d) => d.value), 1);

        // Calculate month labels
        const monthLabels: Array<{ month: string; colStart: number }> = [];
        let lastMonth = -1;

        weeksData.forEach((week, index) => {
            const monthOfWeek = week.weekStart.getMonth();
            if (monthOfWeek !== lastMonth) {
                monthLabels.push({
                    month: MONTHS[monthOfWeek],
                    colStart: index,
                });
                lastMonth = monthOfWeek;
            }
        });

        // For month view, only show the current month label
        if (activeView === 'month') {
            const currentMonth = new Date().getMonth();
            return {
                weeks: weeksData,
                maxValue,
                monthLabels: [{ month: MONTHS[currentMonth], colStart: 0 }],
                config: { weeks, cellSize, label: 'Month' }
            };
        }

        return {
            weeks: weeksData,
            maxValue,
            monthLabels,
            config: { weeks, cellSize, label: activeView === 'range' ? 'Range' : VIEW_CONFIG[activeView].label }
        };
    }, [activeView, dataMap, futureDataMap, overdueDataMap, data, rangeStart, rangeEnd]);

    const handleCellMouseEnter = (
        e: React.MouseEvent<HTMLDivElement>,
        dateKey: string,
        value: number,
        isFuture: boolean = false,
        isOverdue: boolean = false
    ) => {
        if (value < 0 && !isFuture && !isOverdue) return; // Out of range
        const rect = e.currentTarget.getBoundingClientRect();
        const containerRect = e.currentTarget.closest('.heatmap-container')?.getBoundingClientRect();

        if (containerRect) {
            setTooltip({
                date: dateKey,
                value,
                isFuture,
                isOverdue,
                x: rect.left - containerRect.left + rect.width / 2,
                y: rect.top - containerRect.top,
            });
        }
    };

    const handleCellMouseLeave = () => {
        setTooltip(null);
    };

    return (
        <div className="w-full">
            {/* Header with title and view toggle */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                    </svg>
                    {title}
                </h3>

                {/* View Toggle */}
                <div className="flex bg-slate-700/50 rounded-lg p-1">
                    {(Object.keys(VIEW_CONFIG) as ViewType[]).map((viewKey) => (
                        <button
                            key={viewKey}
                            onClick={() => setActiveView(viewKey)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${activeView === viewKey
                                ? 'bg-cyan-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white hover:bg-slate-600/50'
                                }`}
                        >
                            {VIEW_CONFIG[viewKey].label}
                        </button>
                    ))}
                    {/* Range button */}
                    <button
                        onClick={() => setActiveView('range')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${activeView === 'range'
                            ? 'bg-cyan-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white hover:bg-slate-600/50'
                            }`}
                    >
                        Range
                    </button>
                </div>
            </div>

            {/* Date Range Picker (only shown when range view is active) */}
            {activeView === 'range' && (
                <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-slate-700/30 rounded-lg border border-slate-700/50">
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-400">From:</label>
                        <input
                            type="date"
                            value={rangeStart}
                            onChange={(e) => setRangeStart(e.target.value)}
                            max={rangeEnd}
                            className="bg-slate-800 border border-slate-600 text-white text-sm rounded-md px-3 py-1.5 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-400">To:</label>
                        <input
                            type="date"
                            value={rangeEnd}
                            onChange={(e) => setRangeEnd(e.target.value)}
                            min={rangeStart}
                            max={new Date().toISOString().split('T')[0]}
                            className="bg-slate-800 border border-slate-600 text-white text-sm rounded-md px-3 py-1.5 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                        />
                    </div>
                    <div className="text-xs text-slate-500">
                        {(() => {
                            const start = new Date(rangeStart);
                            const end = new Date(rangeEnd);
                            const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                            return `${diffDays} days selected`;
                        })()}
                    </div>
                </div>
            )}

            {/* Statistics */}
            {showStats && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-700/50">
                        <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">All Activity</div>
                        <div className="text-2xl font-bold text-white">
                            {stats.total.toLocaleString()}
                            <span className="text-sm font-normal text-slate-400 ml-1">total</span>
                        </div>
                    </div>

                    <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-700/50">
                        <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Longest Streak</div>
                        <div className="text-2xl font-bold text-white">
                            {stats.longestStreak}
                            <span className="text-sm font-normal text-slate-400 ml-1">days</span>
                        </div>
                    </div>

                    <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-700/50">
                        <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Current Streak</div>
                        <div className="text-2xl font-bold text-white flex items-center gap-2">
                            {stats.currentStreak}
                            <span className="text-sm font-normal text-slate-400">days</span>
                            {stats.currentStreak > 0 && (
                                <span className="text-xs text-emerald-400 flex items-center">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                    </svg>
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Heatmap Grid */}
            <div className="heatmap-container relative overflow-x-auto pb-2">
                {/* Month labels */}
                <div
                    className="flex mb-1 text-xs text-slate-400"
                    style={{
                        marginLeft: activeView === 'week' ? 0 : '36px',
                    }}
                >
                    {gridData.monthLabels.map((label, index) => (
                        <div
                            key={`${label.month}-${index}`}
                            className="text-left"
                            style={{
                                marginLeft: index === 0
                                    ? `${label.colStart * (gridData.config.cellSize + 3)}px`
                                    : `${(label.colStart - (gridData.monthLabels[index - 1]?.colStart || 0) - 1) * (gridData.config.cellSize + 3)}px`,
                                minWidth: `${gridData.config.cellSize + 3}px`,
                            }}
                        >
                            {label.month}
                        </div>
                    ))}
                </div>

                {/* Grid with day labels */}
                <div className="flex">
                    {/* Day labels */}
                    {activeView !== 'week' && (
                        <div className="flex flex-col justify-around mr-2 text-xs text-slate-400" style={{ height: `${7 * (gridData.config.cellSize + 3) - 3}px` }}>
                            {DAYS_OF_WEEK.filter((_, i) => i % 2 === 1).map((day) => (
                                <div key={day} className="h-3 flex items-center">{day}</div>
                            ))}
                        </div>
                    )}

                    {/* Cells grid */}
                    <div
                        className="flex gap-[3px] transition-all duration-300"
                        style={{
                            flexDirection: activeView === 'week' ? 'row' : 'column',
                        }}
                    >
                        {activeView === 'week' ? (
                            // Week view: single row with 7 large cells
                            <div className="flex gap-[3px]">
                                {gridData.weeks[gridData.weeks.length - 1]?.days.map((day, dayIndex) => (
                                    <div
                                        key={day.dateKey}
                                        className={`rounded-lg transition-all duration-150 ${day.value >= 0 ? 'cursor-pointer hover:scale-110 hover:ring-2 hover:ring-cyan-400/50' : 'opacity-30'
                                            }`}
                                        style={{
                                            width: gridData.config.cellSize,
                                            height: gridData.config.cellSize,
                                            backgroundColor: day.value >= 0
                                                ? INTENSITY_COLORS[getIntensityLevel(day.value, gridData.maxValue)]
                                                : INTENSITY_COLORS[0],
                                        }}
                                        onMouseEnter={(e) => handleCellMouseEnter(e, day.dateKey, day.value)}
                                        onMouseLeave={handleCellMouseLeave}
                                    >
                                        <div className="text-center text-xs text-slate-400 mt-1">
                                            {DAYS_OF_WEEK[dayIndex]}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            // Other views: 7 rows (days) x N columns (weeks)
                            DAYS_OF_WEEK.map((_, dayIndex) => (
                                <div key={dayIndex} className="flex gap-[3px]">
                                    {gridData.weeks.map((week) => {
                                        const day = week.days[dayIndex];
                                        if (!day) return null;

                                        // Determine cell styling based on value
                                        // value >= 0: normal day with data (cyan for activity, rose if overdue)
                                        // value === -1: out of range (e.g., Dec days when viewing Jan)
                                        // value === -2: future day in range - check futureValue for tasks (amber)
                                        const isOutOfRange = day.value === -1;
                                        const isFutureInRange = day.value === -2;
                                        const hasFutureTasks = isFutureInRange && day.futureValue > 0;
                                        const hasOverdueTasks = day.value >= 0 && day.overdueValue > 0;
                                        const isInteractive = day.value >= 0 || hasFutureTasks;

                                        // Determine background color - overdue takes priority over activity
                                        let bgColor = INTENSITY_COLORS[0]; // Default empty
                                        let hoverRingColor = 'hover:ring-cyan-400/50';

                                        if (hasOverdueTasks) {
                                            // Overdue tasks - rose (priority over regular activity)
                                            bgColor = OVERDUE_INTENSITY_COLORS[getIntensityLevel(day.overdueValue, maxOverdueValue)];
                                            hoverRingColor = 'hover:ring-rose-400/50';
                                        } else if (day.value >= 0 && day.value > 0) {
                                            // Past activity - cyan
                                            bgColor = INTENSITY_COLORS[getIntensityLevel(day.value, gridData.maxValue)];
                                        } else if (hasFutureTasks) {
                                            // Future with tasks - amber
                                            bgColor = FUTURE_INTENSITY_COLORS[getIntensityLevel(day.futureValue, maxFutureValue)];
                                            hoverRingColor = 'hover:ring-amber-400/50';
                                        }

                                        return (
                                            <div
                                                key={day.dateKey}
                                                className={`rounded transition-all duration-150 ${isInteractive
                                                    ? `cursor-pointer hover:scale-125 hover:ring-2 ${hoverRingColor}`
                                                    : isOutOfRange
                                                        ? 'opacity-15'
                                                        : 'opacity-40'
                                                    }`}
                                                style={{
                                                    width: gridData.config.cellSize,
                                                    height: gridData.config.cellSize,
                                                    backgroundColor: bgColor,
                                                    borderRadius: gridData.config.cellSize >= 14 ? '4px' : '2px',
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (hasOverdueTasks) {
                                                        handleCellMouseEnter(e, day.dateKey, day.overdueValue, false, true);
                                                    } else if (day.value >= 0) {
                                                        handleCellMouseEnter(e, day.dateKey, day.value, false, false);
                                                    } else if (hasFutureTasks) {
                                                        handleCellMouseEnter(e, day.dateKey, day.futureValue, true, false);
                                                    }
                                                }}
                                                onMouseLeave={handleCellMouseLeave}
                                            />
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center justify-end gap-4 mt-4 text-xs text-slate-400">
                    {/* Past activity legend */}
                    <div className="flex items-center gap-2">
                        <span>Activity</span>
                        <div className="flex gap-1">
                            {INTENSITY_COLORS.map((color, index) => (
                                <div
                                    key={`past-${index}`}
                                    className="rounded"
                                    style={{
                                        width: 12,
                                        height: 12,
                                        backgroundColor: color,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                    {/* Future tasks legend */}
                    <div className="flex items-center gap-2">
                        <span>Tasks Due</span>
                        <div className="flex gap-1">
                            {FUTURE_INTENSITY_COLORS.map((color, index) => (
                                <div
                                    key={`future-${index}`}
                                    className="rounded"
                                    style={{
                                        width: 12,
                                        height: 12,
                                        backgroundColor: color,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                    {/* Overdue tasks legend */}
                    <div className="flex items-center gap-2">
                        <span>Overdue</span>
                        <div className="flex gap-1">
                            {OVERDUE_INTENSITY_COLORS.map((color, index) => (
                                <div
                                    key={`overdue-${index}`}
                                    className="rounded"
                                    style={{
                                        width: 12,
                                        height: 12,
                                        backgroundColor: color,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Tooltip */}
                {tooltip && (
                    <Tooltip
                        date={tooltip.date}
                        value={tooltip.value}
                        isFuture={tooltip.isFuture}
                        isOverdue={tooltip.isOverdue}
                        x={tooltip.x}
                        y={tooltip.y}
                    />
                )}
            </div>
        </div>
    );
};

export default TeamActivityHeatmap;
