import React, { useState, useMemo } from 'react';

// Types
interface TaskDetail {
    projectName: string;
    sectionName: string;
    taskName: string;
    assignees: string[];
}

interface CalendarDataPoint {
    day: string; // YYYY-MM-DD format
    value: number;
    tasks?: TaskDetail[]; // Optional detailed task information
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
    quarter: { weeks: 13, cellSize: 32, label: 'Quarter' },
    year: { weeks: 52, cellSize: 23, label: 'Year' },
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
    tasks?: TaskDetail[];
    x: number;
    y: number;
}> = ({ date, value, isFuture, isOverdue, tasks, x, y }) => {
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

    // Check if we should show task details (for future/overdue tasks)
    const showTaskDetails = (isFuture || isOverdue) && tasks && tasks.length > 0;

    return (
        <div
            className={`fixed z-[100] px-3 py-2 border rounded-lg shadow-xl text-sm pointer-events-none transform -translate-x-1/2 ${bgClass}`}
            style={{
                left: x,
                top: y - (showTaskDetails ? 100 : 60),
                maxWidth: '300px',
            }}
        >
            <div className="font-semibold text-white">{labelText}</div>
            <div className="text-slate-300 text-xs mb-1">{formattedDate}</div>

            {/* Task details list */}
            {showTaskDetails && (
                <div className="mt-2 max-h-40 overflow-y-auto space-y-2 border-t border-slate-600/50 pt-2">
                    {tasks!.slice(0, 5).map((task, idx) => (
                        <div key={idx} className="text-xs">
                            <div className="text-cyan-400 font-bold mb-0.5 truncate">{task.projectName}</div>
                            <div className="text-white font-medium truncate mb-0.5">{task.taskName}</div>
                            <div className="text-slate-400 truncate text-[10px]">
                                Section: {task.sectionName}
                            </div>
                            {task.assignees.length > 0 && (
                                <div className="text-slate-500 truncate text-[10px] mt-0.5">
                                    👤 {task.assignees.slice(0, 2).join(', ')}
                                    {task.assignees.length > 2 && ` +${task.assignees.length - 2}`}
                                </div>
                            )}
                        </div>
                    ))}
                    {tasks!.length > 5 && (
                        <div className="text-xs text-slate-400 italic">+{tasks!.length - 5} more...</div>
                    )}
                </div>
            )}

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
        tasks?: TaskDetail[];
        x: number;
        y: number;
    } | null>(null);

    // Date range state for custom range view
    const today = new Date();
    const defaultStartDate = new Date(today);
    defaultStartDate.setDate(today.getDate() - 30);

    const [rangeStart, setRangeStart] = useState<string>(defaultStartDate.toISOString().split('T')[0]);
    const [rangeEnd, setRangeEnd] = useState<string>(today.toISOString().split('T')[0]);

    // Navigation offset states for week and month views
    const [weekOffset, setWeekOffset] = useState(0);
    const [monthOffset, setMonthOffset] = useState(0);

    // Create data map for quick lookups (past activity)
    const dataMap = useMemo(() => {
        const map = new Map<string, number>();
        data.forEach((d) => {
            map.set(d.day, (map.get(d.day) || 0) + d.value);
        });
        return map;
    }, [data]);

    // Create future data map for quick lookups (future tasks) - stores both value and task details
    const futureDataMap = useMemo(() => {
        const map = new Map<string, { value: number; tasks: TaskDetail[] }>();
        futureData.forEach((d) => {
            const existing = map.get(d.day) || { value: 0, tasks: [] };
            existing.value += d.value;
            if (d.tasks) {
                existing.tasks.push(...d.tasks);
            }
            map.set(d.day, existing);
        });
        return map;
    }, [futureData]);

    // Create overdue data map for quick lookups (incomplete past tasks) - stores both value and task details
    const overdueDataMap = useMemo(() => {
        const map = new Map<string, { value: number; tasks: TaskDetail[] }>();
        overdueData.forEach((d) => {
            const existing = map.get(d.day) || { value: 0, tasks: [] };
            existing.value += d.value;
            if (d.tasks) {
                existing.tasks.push(...d.tasks);
            }
            map.set(d.day, existing);
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

    // Week schedule data for columnar view
    const weekScheduleData = useMemo(() => {
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const currentStartOfWeek = getStartOfWeek(todayDate);
        // Apply week offset (positive = future, negative = past)
        const startOfWeek = addDays(currentStartOfWeek, weekOffset * 7);

        const WEEK_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const WEEK_DAY_COLORS = [
            'bg-purple-500/20 border-purple-500/30', // Sunday
            'bg-pink-500/20 border-pink-500/30',     // Monday
            'bg-cyan-500/20 border-cyan-500/30',     // Tuesday
            'bg-green-500/20 border-green-500/30',   // Wednesday
            'bg-amber-500/20 border-amber-500/30',   // Thursday
            'bg-rose-500/20 border-rose-500/30',     // Friday
            'bg-blue-500/20 border-blue-500/30',     // Saturday
        ];

        const days = [];
        for (let i = 0; i < 7; i++) {
            const date = addDays(startOfWeek, i);
            const dateKey = getDateKey(date);
            const isFuture = date > todayDate;
            const isToday = dateKey === getDateKey(todayDate);

            const futureEntry = futureDataMap.get(dateKey) || { value: 0, tasks: [] };
            const overdueEntry = overdueDataMap.get(dateKey) || { value: 0, tasks: [] };

            // Combine all tasks for the day
            const allTasks: TaskDetail[] = [];
            if (isFuture) {
                allTasks.push(...futureEntry.tasks);
            } else {
                allTasks.push(...overdueEntry.tasks);
            }

            days.push({
                dayName: WEEK_DAY_NAMES[i],
                date,
                dateKey,
                dayOfMonth: date.getDate(),
                month: MONTHS[date.getMonth()],
                isFuture,
                isToday,
                tasks: allTasks,
                futureCount: isFuture ? futureEntry.value : 0,
                overdueCount: !isFuture ? overdueEntry.value : 0,
                colorClass: WEEK_DAY_COLORS[i],
            });
        }

        // Calculate week label
        const endOfWeek = addDays(startOfWeek, 6);
        const weekLabel = `${MONTHS[startOfWeek.getMonth()]} ${startOfWeek.getDate()} - ${MONTHS[endOfWeek.getMonth()]} ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;

        return { days, weekLabel };
    }, [futureDataMap, overdueDataMap, weekOffset]);

    // Month calendar grid data (7 columns x number of weeks)
    const monthCalendarData = useMemo(() => {
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const todayKey = getDateKey(todayDate);

        // Apply month offset
        const targetDate = new Date(todayDate.getFullYear(), todayDate.getMonth() + monthOffset, 1);
        const currentYear = targetDate.getFullYear();
        const currentMonth = targetDate.getMonth();

        // First day of the month
        const firstDay = new Date(currentYear, currentMonth, 1);
        const firstDayOfWeek = firstDay.getDay(); // 0 = Sunday

        // Last day of the month
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();

        // Calculate number of weeks needed
        const totalCells = firstDayOfWeek + daysInMonth;
        const numWeeks = Math.ceil(totalCells / 7);

        const weeks: Array<Array<{
            date: Date | null;
            dateKey: string;
            dayOfMonth: number;
            value: number;
            futureValue: number;
            overdueValue: number;
            futureTasks: TaskDetail[];
            overdueTasks: TaskDetail[];
            isToday: boolean;
            isFuture: boolean;
            isEmpty: boolean;
        }>> = [];

        let dayCounter = 1;

        for (let week = 0; week < numWeeks; week++) {
            const weekDays = [];
            for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
                const cellIndex = week * 7 + dayOfWeek;

                if (cellIndex < firstDayOfWeek || dayCounter > daysInMonth) {
                    // Empty cell (before first day or after last day)
                    weekDays.push({
                        date: null,
                        dateKey: '',
                        dayOfMonth: 0,
                        value: 0,
                        futureValue: 0,
                        overdueValue: 0,
                        futureTasks: [],
                        overdueTasks: [],
                        isToday: false,
                        isFuture: false,
                        isEmpty: true,
                    });
                } else {
                    const date = new Date(currentYear, currentMonth, dayCounter);
                    const dateKey = getDateKey(date);
                    const isFuture = date > todayDate;
                    const isToday = dateKey === todayKey;

                    const pastValue = dataMap.get(dateKey) || 0;
                    const futureEntry = futureDataMap.get(dateKey) || { value: 0, tasks: [] };
                    const overdueEntry = overdueDataMap.get(dateKey) || { value: 0, tasks: [] };

                    weekDays.push({
                        date,
                        dateKey,
                        dayOfMonth: dayCounter,
                        value: isFuture ? 0 : pastValue,
                        futureValue: isFuture ? futureEntry.value : 0,
                        overdueValue: isFuture ? 0 : overdueEntry.value,
                        futureTasks: isFuture ? futureEntry.tasks : [],
                        overdueTasks: isFuture ? [] : overdueEntry.tasks,
                        isToday,
                        isFuture,
                        isEmpty: false,
                    });

                    dayCounter++;
                }
            }
            weeks.push(weekDays);
        }

        const monthLabel = `${MONTHS[currentMonth]} ${currentYear}`;

        return {
            weeks,
            monthName: MONTHS[currentMonth],
            year: currentYear,
            monthLabel,
        };
    }, [dataMap, futureDataMap, overdueDataMap, monthOffset]);

    // Generate grid data based on view - organized by months with individual days
    const gridData = useMemo(() => {
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        let cellSize: number;
        let startDate: Date;
        let endDate: Date;

        if (activeView === 'range') {
            // Custom range view
            startDate = new Date(rangeStart);
            endDate = new Date(rangeEnd);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);

            const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            cellSize = diffDays <= 60 ? 14 : diffDays <= 180 ? 10 : 8;
        } else if (activeView === 'month') {
            const currentYear = todayDate.getFullYear();
            const currentMonth = todayDate.getMonth();
            startDate = new Date(currentYear, currentMonth, 1);
            endDate = new Date(currentYear, currentMonth + 1, 0);
            cellSize = 16;
        } else if (activeView === 'week') {
            startDate = getStartOfWeek(todayDate);
            endDate = addDays(startDate, 6);
            cellSize = 24;
        } else if (activeView === 'quarter') {
            const currentMonth = todayDate.getMonth();
            const quarterStart = Math.floor(currentMonth / 3) * 3;
            startDate = new Date(todayDate.getFullYear(), quarterStart, 1);
            endDate = new Date(todayDate.getFullYear(), quarterStart + 3, 0);
            cellSize = 15;
        } else {
            // Year view - show all 12 months
            startDate = new Date(todayDate.getFullYear(), 0, 1);
            endDate = new Date(todayDate.getFullYear(), 11, 31);
            cellSize = 12;
        }

        // Build month-based structure
        interface DayData {
            date: Date;
            dateKey: string;
            dayOfMonth: number;
            value: number;
            futureValue: number;
            overdueValue: number;
            futureTasks: TaskDetail[];
            overdueTasks: TaskDetail[];
            isToday: boolean;
            isFuture: boolean;
        }

        interface MonthData {
            month: number;
            year: number;
            monthName: string;
            days: DayData[];
            daysInMonth: number;
        }

        const monthsData: MonthData[] = [];
        let currentMonth = startDate.getMonth();
        let currentYear = startDate.getFullYear();

        // Iterate through all months in range
        while (new Date(currentYear, currentMonth, 1) <= endDate) {
            const monthStart = new Date(currentYear, currentMonth, 1);
            const monthEnd = new Date(currentYear, currentMonth + 1, 0);
            const daysInMonth = monthEnd.getDate();

            const days: DayData[] = [];

            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(currentYear, currentMonth, d);
                const dateKey = getDateKey(date);

                // Check if within display range
                if (date >= startDate && date <= endDate) {
                    const value = dataMap.get(dateKey) || 0;
                    const futureEntry = futureDataMap.get(dateKey) || { value: 0, tasks: [] };
                    const overdueEntry = overdueDataMap.get(dateKey) || { value: 0, tasks: [] };
                    const isToday = dateKey === getDateKey(todayDate);
                    const isFuture = date > todayDate;

                    days.push({
                        date,
                        dateKey,
                        dayOfMonth: d,
                        value: isFuture ? -2 : value,
                        futureValue: isFuture ? futureEntry.value : 0,
                        overdueValue: isFuture ? 0 : overdueEntry.value,
                        futureTasks: isFuture ? futureEntry.tasks : [],
                        overdueTasks: isFuture ? [] : overdueEntry.tasks,
                        isToday,
                        isFuture,
                    });
                }
            }

            if (days.length > 0) {
                monthsData.push({
                    month: currentMonth,
                    year: currentYear,
                    monthName: MONTHS[currentMonth],
                    days,
                    daysInMonth,
                });
            }

            // Move to next month
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
        }

        const maxValue = Math.max(...data.map((d) => d.value), 1);

        return {
            months: monthsData,
            maxValue,
            cellSize,
            viewLabel: activeView === 'range' ? 'Range' : VIEW_CONFIG[activeView]?.label || activeView,
        };
    }, [activeView, dataMap, futureDataMap, overdueDataMap, data, rangeStart, rangeEnd]);

    const handleCellMouseEnter = (
        e: React.MouseEvent<HTMLDivElement>,
        dateKey: string,
        value: number,
        isFuture: boolean = false,
        isOverdue: boolean = false,
        tasks?: TaskDetail[]
    ) => {
        if (value < 0 && !isFuture && !isOverdue) return; // Out of range
        const rect = e.currentTarget.getBoundingClientRect();

        // Use viewport coordinates for fixed positioning
        setTooltip({
            date: dateKey,
            value,
            isFuture,
            isOverdue,
            tasks,
            x: rect.left + rect.width / 2,
            y: rect.top,
        });
    };

    const handleCellMouseLeave = () => {
        setTooltip(null);
    };

    return (
        <div className="w-full">
            {/* Header with title and view toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                    </svg>
                    {title}
                </h3>

                {/* View Toggle */}
                <div className="flex bg-slate-700/50 rounded-lg p-0.5">
                    {(Object.keys(VIEW_CONFIG) as ViewType[]).map((viewKey) => (
                        <button
                            key={viewKey}
                            onClick={() => setActiveView(viewKey)}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 ${activeView === viewKey
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
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 ${activeView === 'range'
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

            {/* Statistics - Compact inline layout */}
            {showStats && (
                <div className="flex flex-wrap gap-2 mb-4">
                    <div className="bg-slate-700/30 rounded-lg px-3 py-1.5 border border-slate-700/50 flex items-center gap-2">
                        <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Activity</span>
                        <span className="text-base font-bold text-white">
                            {stats.total.toLocaleString()}
                        </span>
                    </div>

                    <div className="bg-slate-700/30 rounded-lg px-3 py-1.5 border border-slate-700/50 flex items-center gap-2">
                        <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Longest Streak</span>
                        <span className="text-base font-bold text-white">
                            {stats.longestStreak}
                        </span>
                        <span className="text-[10px] text-slate-500">days</span>
                    </div>

                    <div className="bg-slate-700/30 rounded-lg px-3 py-1.5 border border-slate-700/50 flex items-center gap-2">
                        <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Current Streak</span>
                        <span className="text-base font-bold text-white">
                            {stats.currentStreak}
                        </span>
                        <span className="text-[10px] text-slate-500">days</span>
                        {stats.currentStreak > 0 && (
                            <span className="text-xs text-emerald-400 flex items-center">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                </svg>
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Week View - Columnar Schedule Layout */}
            {activeView === 'week' ? (
                <div className="week-schedule-container">
                    {/* Navigation and Week Label */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => setWeekOffset(weekOffset - 1)}
                            className="p-2 rounded-lg bg-slate-700/50 hover:bg-cyan-600/30 text-cyan-400 hover:text-cyan-300 transition-colors"
                            title="Previous Week"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="text-center">
                            <span className="text-sm font-semibold text-white">{weekScheduleData.weekLabel}</span>
                            {weekOffset !== 0 && (
                                <button
                                    onClick={() => setWeekOffset(0)}
                                    className="ml-2 text-xs text-cyan-400 hover:text-cyan-300"
                                >
                                    Today
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setWeekOffset(weekOffset + 1)}
                            className="p-2 rounded-lg bg-slate-700/50 hover:bg-cyan-600/30 text-cyan-400 hover:text-cyan-300 transition-colors"
                            title="Next Week"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                        {weekScheduleData.days.map((day, index) => (
                            <div
                                key={day.dateKey}
                                className={`rounded-lg border ${day.colorClass} ${day.isToday ? 'ring-2 ring-cyan-400' : ''}`}
                            >
                                {/* Day Header */}
                                <div className={`px-3 py-2 border-b ${day.colorClass.replace('/20', '/30')}`}>
                                    <div className="text-sm font-bold text-white">{day.dayName}</div>
                                    <div className="text-xs text-slate-400">{day.month} {day.dayOfMonth}</div>
                                </div>

                                {/* Tasks List */}
                                <div className="p-2 min-h-[200px] max-h-[300px] overflow-y-auto space-y-1.5">
                                    {day.tasks.length === 0 ? (
                                        <div className="text-xs text-slate-500 italic text-center py-4">
                                            No tasks
                                        </div>
                                    ) : (
                                        day.tasks.map((task, taskIndex) => (
                                            <div
                                                key={`${day.dateKey}-task-${taskIndex}`}
                                                className={`px-2 py-2 rounded text-xs border transition-all duration-150 cursor-pointer hover:scale-[1.02] ${day.isFuture
                                                    ? 'bg-amber-900/20 border-amber-700/30 hover:border-amber-500/50'
                                                    : 'bg-rose-900/20 border-rose-700/30 hover:border-rose-500/50'
                                                    }`}
                                                onMouseEnter={(e) => {
                                                    // Calculate position for tooltip
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setTooltip({
                                                        date: day.dateKey,
                                                        value: 1,
                                                        isFuture: day.isFuture,
                                                        isOverdue: !day.isFuture,
                                                        tasks: [task],
                                                        x: rect.left + rect.width / 2,
                                                        y: rect.top,
                                                    });
                                                }}
                                                onMouseLeave={() => setTooltip(null)}
                                            >
                                                <div className="text-cyan-400 font-bold mb-0.5 truncate">{task.projectName}</div>
                                                <div className="text-white font-medium truncate mb-0.5">{task.taskName}</div>
                                                <div className="text-slate-400 truncate text-[10px]">
                                                    Section: {task.sectionName}
                                                </div>
                                                {task.assignees.length > 0 && (
                                                    <div className="text-slate-500 truncate text-[10px] mt-0.5">
                                                        👤 {task.assignees.slice(0, 2).join(', ')}
                                                        {task.assignees.length > 2 && ` +${task.assignees.length - 2}`}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Task Count Footer */}
                                {(day.futureCount > 0 || day.overdueCount > 0) && (
                                    <div className={`px-3 py-1.5 border-t ${day.colorClass.replace('/20', '/30')} text-xs`}>
                                        {day.isFuture ? (
                                            <span className="text-amber-400">{day.futureCount} task{day.futureCount !== 1 ? 's' : ''} due</span>
                                        ) : (
                                            <span className="text-rose-400">{day.overdueCount} overdue</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ) : activeView === 'month' ? (
                /* Month View - Calendar Grid Layout (7 columns x weeks) */
                <div className="month-calendar-container max-w-xl mx-auto">
                    {/* Navigation and Month Label */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => setMonthOffset(monthOffset - 1)}
                            className="p-2 rounded-lg bg-slate-700/50 hover:bg-cyan-600/30 text-cyan-400 hover:text-cyan-300 transition-colors"
                            title="Previous Month"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="text-center">
                            <span className="text-sm font-semibold text-white">{monthCalendarData.monthLabel}</span>
                            {monthOffset !== 0 && (
                                <button
                                    onClick={() => setMonthOffset(0)}
                                    className="ml-2 text-xs text-cyan-400 hover:text-cyan-300"
                                >
                                    Today
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setMonthOffset(monthOffset + 1)}
                            className="p-2 rounded-lg bg-slate-700/50 hover:bg-cyan-600/30 text-cyan-400 hover:text-cyan-300 transition-colors"
                            title="Next Month"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    {/* Day of week headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName) => (
                            <div
                                key={dayName}
                                className="text-center text-xs font-semibold text-slate-400 py-1"
                            >
                                {dayName}
                            </div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {monthCalendarData.weeks.flatMap((week, weekIndex) =>
                            week.map((day, dayIndex) => {
                                if (day.isEmpty) {
                                    return (
                                        <div
                                            key={`empty-${weekIndex}-${dayIndex}`}
                                            className="aspect-square rounded-lg bg-slate-800/30"
                                        />
                                    );
                                }

                                const hasFutureTasks = day.isFuture && day.futureValue > 0;
                                const hasOverdueTasks = !day.isFuture && day.overdueValue > 0;
                                const hasActivity = !day.isFuture && day.value > 0;
                                const isInteractive = hasActivity || hasFutureTasks || hasOverdueTasks;

                                // Determine background color
                                let bgColor = 'bg-slate-800/50';
                                let borderColor = 'border-slate-700/50';

                                if (hasOverdueTasks) {
                                    const intensity = getIntensityLevel(day.overdueValue, maxOverdueValue);
                                    bgColor = intensity >= 3 ? 'bg-rose-600/40' : intensity >= 2 ? 'bg-rose-700/40' : 'bg-rose-800/40';
                                    borderColor = 'border-rose-600/50';
                                } else if (hasActivity) {
                                    const intensity = getIntensityLevel(day.value, gridData.maxValue);
                                    bgColor = intensity >= 3 ? 'bg-cyan-600/40' : intensity >= 2 ? 'bg-cyan-700/40' : 'bg-cyan-800/40';
                                    borderColor = 'border-cyan-600/50';
                                } else if (hasFutureTasks) {
                                    const intensity = getIntensityLevel(day.futureValue, maxFutureValue);
                                    bgColor = intensity >= 3 ? 'bg-amber-600/40' : intensity >= 2 ? 'bg-amber-700/40' : 'bg-amber-800/40';
                                    borderColor = 'border-amber-600/50';
                                }

                                return (
                                    <div
                                        key={day.dateKey}
                                        className={`aspect-square rounded-lg border ${bgColor} ${borderColor} p-1.5 flex flex-col transition-all ${isInteractive ? 'cursor-pointer hover:scale-105 hover:shadow-lg' : ''
                                            } ${day.isToday ? 'ring-2 ring-cyan-400' : ''}`}
                                        onMouseEnter={(e) => {
                                            if (hasOverdueTasks) {
                                                handleCellMouseEnter(e, day.dateKey, day.overdueValue, false, true, day.overdueTasks);
                                            } else if (hasActivity) {
                                                handleCellMouseEnter(e, day.dateKey, day.value, false, false);
                                            } else if (hasFutureTasks) {
                                                handleCellMouseEnter(e, day.dateKey, day.futureValue, true, false, day.futureTasks);
                                            }
                                        }}
                                        onMouseLeave={handleCellMouseLeave}
                                    >
                                        {/* Day number */}
                                        <div className={`text-xs font-bold ${day.isToday ? 'text-cyan-400' : 'text-slate-300'}`}>
                                            {day.dayOfMonth}
                                        </div>

                                        {/* Task indicators */}
                                        <div className="flex-grow flex flex-col justify-end">
                                            {hasFutureTasks && (
                                                <div className="text-[10px] text-amber-400 truncate">
                                                    {day.futureValue} due
                                                </div>
                                            )}
                                            {hasOverdueTasks && (
                                                <div className="text-[10px] text-rose-400 truncate">
                                                    {day.overdueValue} overdue
                                                </div>
                                            )}
                                            {hasActivity && !hasOverdueTasks && (
                                                <div className="text-[10px] text-cyan-400 truncate">
                                                    {day.value} pts
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap items-center justify-end gap-4 mt-4 text-xs text-slate-400">
                        <div className="flex items-center gap-2">
                            <span>Tasks Due</span>
                            <div className="w-3 h-3 rounded bg-amber-600/60" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span>Overdue</span>
                            <div className="w-3 h-3 rounded bg-rose-600/60" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span>Activity</span>
                            <div className="w-3 h-3 rounded bg-cyan-600/60" />
                        </div>
                    </div>

                    {/* Tooltip */}
                    {tooltip && (
                        <Tooltip
                            date={tooltip.date}
                            value={tooltip.value}
                            isFuture={tooltip.isFuture}
                            isOverdue={tooltip.isOverdue}
                            tasks={tooltip.tasks}
                            x={tooltip.x}
                            y={tooltip.y}
                        />
                    )}
                </div>
            ) : (
                /* Heatmap Grid - Quarter/Year/Range layout */
                <div className="heatmap-container relative overflow-x-auto pb-2">
                    {/* Day of month header row */}
                    <div className="flex items-center mb-1">
                        <div className="w-8 flex-shrink-0" /> {/* Spacer for month labels */}
                        <div className="flex gap-[2px]" style={{ maxWidth: `${31 * (gridData.cellSize + 2)}px` }}>
                            {Array.from({ length: 31 }, (_, i) => (
                                <div
                                    key={`day-header-${i + 1}`}
                                    className="text-[9px] text-slate-500 text-center"
                                    style={{ width: gridData.cellSize }}
                                >
                                    {i + 1}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Month rows - each month shows its days horizontally */}
                    <div className="flex flex-col gap-1">
                        {gridData.months.map((month, monthIndex) => (
                            <div key={`${month.year}-${month.month}`} className="flex items-center">
                                {/* Month label */}
                                <div
                                    className="text-xs text-slate-400 font-medium w-8 flex-shrink-0 text-right pr-2"
                                >
                                    {month.monthName}
                                </div>

                                {/* Days grid for this month */}
                                <div className="flex gap-[2px] flex-wrap" style={{ maxWidth: `${31 * (gridData.cellSize + 2)}px` }}>
                                    {month.days.map((day) => {
                                        // Determine cell styling
                                        const isFutureDay = day.isFuture;
                                        const hasFutureTasks = isFutureDay && day.futureValue > 0;
                                        const hasOverdueTasks = !isFutureDay && day.overdueValue > 0;
                                        const hasActivity = !isFutureDay && day.value > 0;
                                        const isInteractive = hasActivity || hasFutureTasks || hasOverdueTasks;

                                        // Determine background color
                                        let bgColor = INTENSITY_COLORS[0]; // Default empty
                                        let hoverRingColor = 'hover:ring-cyan-400/50';

                                        if (hasOverdueTasks) {
                                            bgColor = OVERDUE_INTENSITY_COLORS[getIntensityLevel(day.overdueValue, maxOverdueValue)];
                                            hoverRingColor = 'hover:ring-rose-400/50';
                                        } else if (hasActivity) {
                                            bgColor = INTENSITY_COLORS[getIntensityLevel(day.value, gridData.maxValue)];
                                        } else if (hasFutureTasks) {
                                            bgColor = FUTURE_INTENSITY_COLORS[getIntensityLevel(day.futureValue, maxFutureValue)];
                                            hoverRingColor = 'hover:ring-amber-400/50';
                                        }

                                        return (
                                            <div
                                                key={day.dateKey}
                                                className={`rounded transition-all duration-150 relative ${isInteractive
                                                    ? `cursor-pointer hover:scale-125 hover:ring-2 ${hoverRingColor}`
                                                    : isFutureDay
                                                        ? 'opacity-50'
                                                        : ''
                                                    } ${day.isToday ? 'ring-2 ring-cyan-400' : ''}`}
                                                style={{
                                                    width: gridData.cellSize,
                                                    height: gridData.cellSize,
                                                    backgroundColor: bgColor,
                                                    borderRadius: gridData.cellSize >= 12 ? '3px' : '2px',
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (hasOverdueTasks) {
                                                        handleCellMouseEnter(e, day.dateKey, day.overdueValue, false, true, day.overdueTasks);
                                                    } else if (hasActivity) {
                                                        handleCellMouseEnter(e, day.dateKey, day.value, false, false);
                                                    } else if (hasFutureTasks) {
                                                        handleCellMouseEnter(e, day.dateKey, day.futureValue, true, false, day.futureTasks);
                                                    }
                                                }}
                                                onMouseLeave={handleCellMouseLeave}
                                                title={`${day.dayOfMonth}`}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
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

                </div>
            )}

            {/* Global Tooltip - renders for all views */}
            {tooltip && (
                <Tooltip
                    date={tooltip.date}
                    value={tooltip.value}
                    isFuture={tooltip.isFuture}
                    isOverdue={tooltip.isOverdue}
                    tasks={tooltip.tasks}
                    x={tooltip.x}
                    y={tooltip.y}
                />
            )}
        </div>
    );
};

export default TeamActivityHeatmap;
