import React, { useState, useMemo } from 'react';
import { Project, Task, TaskStatus } from '../types';
import { ChevronRightIcon, ChevronDownIcon } from './icons';

const GANTT_DAY_WIDTH = 32; // width of a day column in pixels

const STATUS_COLORS: Record<TaskStatus, { bg: string; border: string }> = {
  [TaskStatus.Completed]: { bg: 'bg-status-completed/70', border: 'border-status-completed' },
  [TaskStatus.InProgress]: { bg: 'bg-status-inprogress/70', border: 'border-status-inprogress' },
  [TaskStatus.NotStarted]: { bg: 'bg-status-notstarted/70', border: 'border-status-notstarted' },
  [TaskStatus.AtRisk]: { bg: 'bg-status-atrisk/70', border: 'border-status-atrisk' },
};

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

const getProjectTimeline = (project: Project) => {
    const allTasks = flattenTasks(project.phases.flatMap(p => p.tasks));
    if (allTasks.length === 0) {
        const today = new Date();
        return { startDate: today, endDate: today, totalDays: 1 };
    }
    const startDates = allTasks.map(t => t.startDate.getTime());
    const endDates = allTasks.map(t => t.endDate.getTime());
    const minTimestamp = Math.min(...startDates);
    const maxTimestamp = Math.max(...endDates);
    const startDate = new Date(minTimestamp);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(maxTimestamp);
    endDate.setHours(0, 0, 0, 0);

    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;
    return { startDate, endDate, totalDays };
};

const GanttHeader: React.FC<{ startDate: Date, totalDays: number }> = ({ startDate, totalDays }) => {
    const months: { name: string, days: number, year: number }[] = [];
    const dateCursor = new Date(startDate);

    for (let i = 0; i < totalDays; i++) {
        const month = dateCursor.toLocaleString('default', { month: 'short' });
        const year = dateCursor.getFullYear();
        const lastMonth = months[months.length - 1];
        if (!lastMonth || lastMonth.name !== month || lastMonth.year !== year) {
            months.push({ name: month, year, days: 1 });
        } else {
            lastMonth.days++;
        }
        dateCursor.setDate(dateCursor.getDate() + 1);
    }

    dateCursor.setTime(startDate.getTime());

    return (
        <div className="sticky top-0 z-10 bg-slate-900">
            <div className="grid grid-cols-[300px_1fr]">
                <div className="p-2 border-b border-r border-slate-700 text-sm font-semibold text-slate-300">Tasks</div>
                <div className="relative">
                    <div className="flex">
                        {months.map(({ name, year, days }, index) => (
                            <div key={`${name}-${year}`} className="p-1 border-b border-slate-700 text-center text-xs font-semibold text-slate-400" style={{ width: days * GANTT_DAY_WIDTH }}>
                                {name} {year}
                            </div>
                        ))}
                    </div>
                    <div className="flex border-b border-slate-700">
                        {Array.from({ length: totalDays }).map((_, i) => {
                            const day = new Date(startDate);
                            day.setDate(day.getDate() + i);
                            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                            return (
                                <div key={i} className={`flex-shrink-0 text-center text-xs text-slate-500 border-r border-slate-800 ${isWeekend ? 'bg-slate-800/50' : ''}`} style={{ width: GANTT_DAY_WIDTH }}>
                                    {day.getDate()}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

const GanttTaskRow: React.FC<{
    task: Task;
    level: number;
    projectStartDate: Date;
    isExpanded: boolean;
    onToggleExpand: (taskId: string) => void;
    totalDays: number;
}> = ({ task, level, projectStartDate, isExpanded, onToggleExpand, totalDays }) => {
    const hasSubtasks = task.subTasks && task.subTasks.length > 0;
    
    const startOffset = Math.round((task.startDate.getTime() - projectStartDate.getTime()) / (1000 * 3600 * 24));
    const duration = Math.round((task.endDate.getTime() - task.startDate.getTime()) / (1000 * 3600 * 24)) + 1;

    const barStyle = {
        gridColumn: `${startOffset + 1} / span ${duration}`,
    };
    
    const statusColor = STATUS_COLORS[task.status] || STATUS_COLORS[TaskStatus.NotStarted];

    return (
        <>
            <div className="contents group">
                 <div className="flex items-center p-2 border-b border-r border-slate-700 text-sm text-white bg-slate-800/30" style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}>
                    {hasSubtasks ? (
                        <button onClick={() => onToggleExpand(task.id)} className="mr-2 text-slate-400 hover:text-white">
                            {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                        </button>
                    ) : <div className="w-4 h-4 mr-2"></div>}
                    <span className="truncate">{task.name}</span>
                </div>
                <div className="relative border-b border-slate-700 grid" style={{ gridTemplateColumns: `repeat(${totalDays}, minmax(0, 1fr))` }}>
                    <div className={`relative h-6 my-1 rounded-md border ${statusColor.bg} ${statusColor.border}`} style={barStyle}>
                         <div className="absolute left-0 -top-10 w-max max-w-xs scale-0 group-hover:scale-100 transition-transform origin-bottom-left bg-slate-900 text-white text-xs rounded py-1 px-2 shadow-lg border border-slate-700 z-20">
                            <p className="font-bold">{task.name}</p>
                            <p>{task.startDate.toLocaleDateString()} - {task.endDate.toLocaleDateString()}</p>
                            <p>Status: {task.status}</p>
                         </div>
                    </div>
                </div>
            </div>
            {isExpanded && hasSubtasks && task.subTasks?.map(subTask => (
                <GanttTaskRow
                    key={subTask.id}
                    task={subTask}
                    level={level + 1}
                    projectStartDate={projectStartDate}
                    isExpanded={isExpanded} // Simplification: sub-task visibility is tied to parent
                    onToggleExpand={onToggleExpand}
                    totalDays={totalDays}
                />
            ))}
        </>
    );
};


const GanttChart: React.FC<{ project: Project }> = ({ project }) => {
    const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
    
    const { startDate, totalDays } = useMemo(() => getProjectTimeline(project), [project]);
    
    const handleToggleExpand = (taskId: string) => {
        setExpandedTasks(prev => {
            const newSet = new Set(prev);
            if (newSet.has(taskId)) newSet.delete(taskId);
            else newSet.add(taskId);
            return newSet;
        });
    };

    return (
        <div className="p-4">
            <div className="overflow-x-auto border border-slate-700 rounded-lg bg-slate-900">
                <GanttHeader startDate={startDate} totalDays={totalDays} />
                <div className="grid grid-cols-[300px_1fr]">
                    <div className="relative" style={{ gridColumn: '1 / -1' }}>
                       {project.phases.map(phase => (
                           <React.Fragment key={phase.id}>
                                <div className="contents">
                                    <div className="col-span-2 text-left p-2 font-semibold text-slate-300 bg-slate-800 border-b border-slate-700">{phase.name}</div>
                                </div>
                                {phase.tasks.map(task => (
                                    <GanttTaskRow
                                        key={task.id}
                                        task={task}
                                        level={0}
                                        projectStartDate={startDate}
                                        isExpanded={expandedTasks.has(task.id)}
                                        onToggleExpand={handleToggleExpand}
                                        totalDays={totalDays}
                                    />
                                ))}
                           </React.Fragment>
                       ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GanttChart;