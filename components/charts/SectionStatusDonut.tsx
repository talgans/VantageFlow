import React, { useMemo, useState, useEffect } from 'react';
import { Task, TaskStatus } from '../../types';

interface PhaseStatusDonutProps {
    tasks: Task[];
    size?: number;
    animationKey?: number; // Changes to this trigger animation restart
}

// Colors matching the status badge colors
const STATUS_COLORS = {
    [TaskStatus.Hundred]: '#22c55e',    // green-500
    [TaskStatus.SeventyFive]: '#6366f1', // indigo-500
    [TaskStatus.Fifty]: '#3b82f6',       // blue-500
    [TaskStatus.TwentyFive]: '#0ea5e9',  // sky-500
    [TaskStatus.Zero]: '#6b7280',        // gray-500
    [TaskStatus.AtRisk]: '#ef4444',      // red-500
};

// Ring order from outer to inner
const RING_ORDER = [
    TaskStatus.Hundred,
    TaskStatus.SeventyFive,
    TaskStatus.Fifty,
    TaskStatus.TwentyFive,
];

const countTasksByStatus = (tasks: Task[]): Record<string, number> => {
    const counts: Record<string, number> = {};

    const countRecursive = (taskList: Task[]) => {
        taskList.forEach(task => {
            const status = task.status as string;
            counts[status] = (counts[status] || 0) + 1;
            if (task.subTasks && task.subTasks.length > 0) {
                countRecursive(task.subTasks);
            }
        });
    };

    countRecursive(tasks);
    return counts;
};

const SectionStatusDonut: React.FC<PhaseStatusDonutProps> = ({ tasks, size = 36, animationKey = 0 }) => {
    const statusCounts = useMemo(() => countTasksByStatus(tasks), [tasks]);

    const totalTasks = useMemo(() => {
        return Object.values(statusCounts).reduce((sum: number, count: number) => sum + count, 0);
    }, [statusCounts]);

    // Animation state - resets when animationKey changes
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (animationKey > 0) {
            setIsAnimating(true);
            // Reset animation after it completes
            const timer = setTimeout(() => setIsAnimating(false), 600);
            return () => clearTimeout(timer);
        }
    }, [animationKey]);

    if (totalTasks === 0) {
        return (
            <div
                className="rounded-full bg-slate-700/50 flex items-center justify-center"
                style={{ width: size, height: size }}
            >
                <span className="text-slate-500 text-xs">-</span>
            </div>
        );
    }

    const center = size / 2;
    const maxRadius = (size / 2) - 2;
    const ringWidth = maxRadius / 5; // Divide by 5 to accommodate all rings
    const gapBetweenRings = 1;

    // Create SVG arcs for each status ring
    const createArc = (
        cx: number,
        cy: number,
        radius: number,
        startAngle: number,
        endAngle: number
    ): string => {
        const start = polarToCartesian(cx, cy, radius, endAngle);
        const end = polarToCartesian(cx, cy, radius, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

        return [
            'M', start.x, start.y,
            'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y
        ].join(' ');
    };

    const polarToCartesian = (cx: number, cy: number, radius: number, angleInDegrees: number) => {
        const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
        return {
            x: cx + radius * Math.cos(angleInRadians),
            y: cy + radius * Math.sin(angleInRadians),
        };
    };

    // Calculate stroke-dasharray for animation
    const getCircumference = (radius: number) => 2 * Math.PI * radius;

    return (
        <div
            className="relative flex-shrink-0"
            style={{ width: size, height: size }}
            title={`100%: ${statusCounts[TaskStatus.Hundred] || 0}, 75%: ${statusCounts[TaskStatus.SeventyFive] || 0}, 50%: ${statusCounts[TaskStatus.Fifty] || 0}, 25%: ${statusCounts[TaskStatus.TwentyFive] || 0}`}
        >
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                style={{ transform: 'rotate(-90deg)' }}
            >
                {/* Background rings */}
                {RING_ORDER.map((status, index) => {
                    const radius = maxRadius - (index * (ringWidth + gapBetweenRings));
                    return (
                        <circle
                            key={`bg-${status}`}
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="none"
                            stroke="rgba(71, 85, 105, 0.3)"
                            strokeWidth={ringWidth}
                        />
                    );
                })}

                {/* Filled arcs based on percentage of tasks in each status */}
                {RING_ORDER.map((status, index) => {
                    const count = statusCounts[status] || 0;
                    if (count === 0) return null;

                    const percentage = (count / totalTasks) * 100;
                    const radius = maxRadius - (index * (ringWidth + gapBetweenRings));
                    const circumference = getCircumference(radius);
                    const strokeDasharray = circumference;
                    const strokeDashoffset = isAnimating
                        ? circumference
                        : circumference - (circumference * percentage / 100);

                    return (
                        <circle
                            key={`${status}-${animationKey}`}
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="none"
                            stroke={STATUS_COLORS[status]}
                            strokeWidth={ringWidth}
                            strokeLinecap="round"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            style={{
                                transition: isAnimating ? 'none' : 'stroke-dashoffset 0.6s ease-out',
                            }}
                        />
                    );
                })}
            </svg>

            {/* Center text showing total completion percentage */}
            <div
                className="absolute inset-0 flex items-center justify-center"
            >
                <span className="text-[8px] font-bold text-white leading-none">
                    {Math.round(((statusCounts[TaskStatus.Hundred] || 0) / totalTasks) * 100)}%
                </span>
            </div>
        </div>
    );
};

export default SectionStatusDonut;
