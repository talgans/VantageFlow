import React from 'react';

interface MemberCountChartProps {
    count: number;
    size?: number;
}

/**
 * A small visual component showing a group icon with member count.
 * Uses inline SVG based on the provided group icon design.
 */
const MemberCountChart: React.FC<MemberCountChartProps> = ({ count, size = 40 }) => {
    return (
        <div
            className="flex items-center space-x-2 bg-slate-700/30 rounded-lg px-2.5 py-1.5"
            title={`${count} team member${count !== 1 ? 's' : ''}`}
        >
            {/* Group icon SVG - three person silhouettes */}
            <svg
                width={size * 0.8}
                height={size * 0.8}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-slate-400"
            >
                {/* Center person (front) */}
                <circle cx="12" cy="7" r="3" />
                <path d="M12 10c-3.5 0-6 2.5-6 5.5v1.5h12v-1.5c0-3-2.5-5.5-6-5.5z" />

                {/* Left person (back) */}
                <circle cx="6" cy="6" r="2.5" className="opacity-60" />
                <path d="M6 8.5c-2.5 0-4.5 1.8-4.5 4v1h4" className="opacity-60" />

                {/* Right person (back) */}
                <circle cx="18" cy="6" r="2.5" className="opacity-60" />
                <path d="M18 8.5c2.5 0 4.5 1.8 4.5 4v1h-4" className="opacity-60" />
            </svg>

            {/* Member count */}
            <span className="text-sm font-semibold text-slate-300">
                {count}
            </span>
        </div>
    );
};

export default MemberCountChart;
