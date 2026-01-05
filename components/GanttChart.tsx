import React, { useState, useMemo } from 'react';
import { Project, Task, TaskStatus, DurationUnit } from '../types';
import { ChevronRightIcon, ChevronDownIcon } from './icons';

const COLUMN_WIDTH = 40;
const TASK_COLUMN_WIDTH = 300;

const STATUS_COLORS: Record<string, { bg: string; border: string }> = {
    [TaskStatus.Hundred]: { bg: 'bg-green-500/70', border: 'border-green-500' },
    [TaskStatus.SeventyFive]: { bg: 'bg-indigo-500/70', border: 'border-indigo-500' },
    [TaskStatus.Fifty]: { bg: 'bg-blue-500/70', border: 'border-blue-500' },
    [TaskStatus.TwentyFive]: { bg: 'bg-sky-500/70', border: 'border-sky-500' },
    [TaskStatus.Zero]: { bg: 'bg-gray-500/70', border: 'border-gray-500' },
    [TaskStatus.AtRisk]: { bg: 'bg-red-500/70', border: 'border-red-500' },
    'Completed': { bg: 'bg-green-500/70', border: 'border-green-500' },
    'In Progress': { bg: 'bg-blue-500/70', border: 'border-blue-500' },
    'Not Started': { bg: 'bg-gray-500/70', border: 'border-gray-500' },
};

type TimelineUnit = 'day' | 'week' | 'month';

const flattenTasks = (tasks: Task[]): Task[] => {
    let allTasks: Task[] = [];
    for (const task of tasks) {
        allTasks.push(task);
        if (task.subTasks) {
            allTasks = allTasks.concat(flattenTasks(task.subTasks));
        }
    }
    return allTasks;
};

const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const getMonthStart = (date: Date): Date => {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
};

const getWeekDiff = (start: Date, end: Date): number => {
    const msPerWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.ceil((end.getTime() - start.getTime()) / msPerWeek);
};

const getMonthDiff = (start: Date, end: Date): number => {
    return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
};

interface TimelineConfig {
    startDate: Date;
    totalUnits: number;
    unit: TimelineUnit;
}

const getProjectTimeline = (project: Project): TimelineConfig => {
    const allTasks = flattenTasks(project.phases.flatMap(p => p.tasks));
    const unit: TimelineUnit =
        project.durationUnit === DurationUnit.Months ? 'month' :
            project.durationUnit === DurationUnit.Weeks ? 'week' : 'day';

    if (allTasks.length === 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return { startDate: today, totalUnits: 7, unit };
    }

    const startDates = allTasks.map(t => new Date(t.startDate).getTime());
    const endDates = allTasks.map(t => new Date(t.endDate).getTime());
    const minTimestamp = Math.min(...startDates);
    const maxTimestamp = Math.max(...endDates);

    let startDate = new Date(minTimestamp);
    const endDate = new Date(maxTimestamp);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    let totalUnits: number;

    if (unit === 'month') {
        startDate = getMonthStart(startDate);
        totalUnits = getMonthDiff(startDate, endDate) + 1;
    } else if (unit === 'week') {
        startDate = getWeekStart(startDate);
        totalUnits = getWeekDiff(startDate, endDate) + 1;
    } else {
        totalUnits = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;
    }

    return { startDate, totalUnits: Math.max(totalUnits, 1), unit };
};

// --- Calculate bar position ---
const getBarPosition = (
    taskStart: Date,
    taskEnd: Date,
    projectStart: Date,
    unit: TimelineUnit,
    totalUnits: number
): { left: number; width: number } => {
    const tStart = new Date(taskStart);
    const tEnd = new Date(taskEnd);
    tStart.setHours(0, 0, 0, 0);
    tEnd.setHours(0, 0, 0, 0);

    let startOffset: number;
    let duration: number;

    if (unit === 'month') {
        startOffset = getMonthDiff(projectStart, tStart);
        duration = getMonthDiff(tStart, tEnd) + 1;
    } else if (unit === 'week') {
        const msPerWeek = 1000 * 60 * 60 * 24 * 7;
        startOffset = (tStart.getTime() - projectStart.getTime()) / msPerWeek;
        duration = (tEnd.getTime() - tStart.getTime()) / msPerWeek + 1;
    } else {
        const msPerDay = 1000 * 60 * 60 * 24;
        startOffset = (tStart.getTime() - projectStart.getTime()) / msPerDay;
        duration = (tEnd.getTime() - tStart.getTime()) / msPerDay + 1;
    }

    // Clamp and convert to pixels
    startOffset = Math.max(0, startOffset);
    duration = Math.max(0.5, Math.min(duration, totalUnits - startOffset));

    return {
        left: startOffset * COLUMN_WIDTH,
        width: duration * COLUMN_WIDTH,
    };
};

// --- GANTT CHART ---
const GanttChart: React.FC<{ project: Project }> = ({ project }) => {
    const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
    const { startDate, totalUnits, unit } = useMemo(() => getProjectTimeline(project), [project]);

    const handleToggleExpand = (taskId: string) => {
        setExpandedTasks(prev => {
            const newSet = new Set(prev);
            if (newSet.has(taskId)) newSet.delete(taskId);
            else newSet.add(taskId);
            return newSet;
        });
    };

    const timelineWidth = totalUnits * COLUMN_WIDTH;

    // Generate timeline columns for header
    const generateTimelineColumns = () => {
        const columns: { label: string; width: number }[] = [];
        const groupHeaders: { label: string; width: number }[] = [];

        if (unit === 'day') {
            let currentMonth = '';
            let monthWidth = 0;

            for (let i = 0; i < totalUnits; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                const monthLabel = d.toLocaleString('default', { month: 'short', year: 'numeric' });

                if (monthLabel !== currentMonth) {
                    if (currentMonth) groupHeaders.push({ label: currentMonth, width: monthWidth });
                    currentMonth = monthLabel;
                    monthWidth = COLUMN_WIDTH;
                } else {
                    monthWidth += COLUMN_WIDTH;
                }

                columns.push({ label: String(d.getDate()), width: COLUMN_WIDTH });
            }
            if (currentMonth) groupHeaders.push({ label: currentMonth, width: monthWidth });

        } else if (unit === 'week') {
            let currentMonth = '';
            let monthWidth = 0;

            for (let i = 0; i < totalUnits; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i * 7);
                const monthLabel = d.toLocaleString('default', { month: 'short', year: 'numeric' });

                if (monthLabel !== currentMonth) {
                    if (currentMonth) groupHeaders.push({ label: currentMonth, width: monthWidth });
                    currentMonth = monthLabel;
                    monthWidth = COLUMN_WIDTH;
                } else {
                    monthWidth += COLUMN_WIDTH;
                }

                columns.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, width: COLUMN_WIDTH });
            }
            if (currentMonth) groupHeaders.push({ label: currentMonth, width: monthWidth });

        } else {
            let currentYear = -1;
            let yearWidth = 0;

            for (let i = 0; i < totalUnits; i++) {
                const d = new Date(startDate);
                d.setMonth(d.getMonth() + i);
                const year = d.getFullYear();

                if (year !== currentYear) {
                    if (currentYear !== -1) groupHeaders.push({ label: String(currentYear), width: yearWidth });
                    currentYear = year;
                    yearWidth = COLUMN_WIDTH;
                } else {
                    yearWidth += COLUMN_WIDTH;
                }

                columns.push({ label: d.toLocaleString('default', { month: 'short' }), width: COLUMN_WIDTH });
            }
            if (currentYear !== -1) groupHeaders.push({ label: String(currentYear), width: yearWidth });
        }

        return { columns, groupHeaders };
    };

    const { columns, groupHeaders } = generateTimelineColumns();

    const renderTaskRow = (task: Task, level: number): React.ReactNode => {
        const hasSubtasks = task.subTasks && task.subTasks.length > 0;
        const isExpanded = expandedTasks.has(task.id);
        const { left, width } = getBarPosition(task.startDate, task.endDate, startDate, unit, totalUnits);
        const statusColor = STATUS_COLORS[task.status as string] || STATUS_COLORS[TaskStatus.Zero];

        return (
            <React.Fragment key={task.id}>
                <div className="flex border-b border-slate-700">
                    {/* Task Name Column */}
                    <div
                        className="flex items-center py-1 px-2 border-r border-slate-700 text-xs text-white bg-slate-800/30 flex-shrink-0"
                        style={{ width: TASK_COLUMN_WIDTH, paddingLeft: `${level * 1 + 0.5}rem` }}
                    >
                        {hasSubtasks ? (
                            <button onClick={() => handleToggleExpand(task.id)} className="mr-2 text-slate-400 hover:text-white">
                                {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                            </button>
                        ) : <div className="w-3 h-3 mr-1" />}
                        <span className="truncate text-xs">{task.name}</span>
                    </div>

                    {/* Timeline Column with Bar */}
                    <div className="relative flex-shrink-0" style={{ width: timelineWidth, height: 20 }}>
                        <div
                            className={`absolute top-1 h-3 rounded border ${statusColor.bg} ${statusColor.border}`}
                            style={{ left, width: Math.max(width, 6) }}
                            title={`${task.name}: ${new Date(task.startDate).toLocaleDateString()} - ${new Date(task.endDate).toLocaleDateString()}`}
                        />
                    </div>
                </div>

                {isExpanded && hasSubtasks && task.subTasks?.map(subTask => renderTaskRow(subTask, level + 1))}
            </React.Fragment>
        );
    };

    return (
        <div className="p-4">
            <div className="overflow-x-auto border border-slate-700 rounded-lg bg-slate-900">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-slate-900">
                    <div className="flex">
                        <div className="p-2 border-b border-r border-slate-700 text-sm font-semibold text-slate-300 flex-shrink-0" style={{ width: TASK_COLUMN_WIDTH }}>
                            Tasks
                        </div>
                        <div className="flex-shrink-0" style={{ width: timelineWidth }}>
                            {/* Group headers (months or years) */}
                            <div className="flex border-b border-slate-700">
                                {groupHeaders.map((h, i) => (
                                    <div key={i} className="text-center text-xs font-semibold text-slate-400 p-1" style={{ width: h.width }}>
                                        {h.label}
                                    </div>
                                ))}
                            </div>
                            {/* Individual columns (days, weeks, or months) */}
                            <div className="flex border-b border-slate-700">
                                {columns.map((c, i) => (
                                    <div key={i} className="text-center text-xs text-slate-500 border-r border-slate-800" style={{ width: c.width }}>
                                        {c.label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Body */}
                {project.phases.map(phase => (
                    <React.Fragment key={phase.id}>
                        {/* Phase Header */}
                        <div className="flex border-b border-slate-700 bg-slate-800">
                            <div className="p-2 font-semibold text-slate-300" style={{ width: TASK_COLUMN_WIDTH + timelineWidth }}>
                                {phase.name}
                            </div>
                        </div>
                        {/* Phase Tasks */}
                        {phase.tasks.map(task => renderTaskRow(task, 0))}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

export default GanttChart;