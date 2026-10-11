export const nivoTheme = {
    background: 'transparent',
    text: {
        fontSize: 11,
        fill: '#94a3b8', // slate-400
        outlineWidth: 0,
        outlineColor: 'transparent',
    },
    axis: {
        domain: {
            line: {
                stroke: '#334155', // slate-700
                strokeWidth: 1,
            },
        },
        legend: {
            text: {
                fontSize: 12,
                fill: '#94a3b8',
                outlineWidth: 0,
                outlineColor: 'transparent',
            },
        },
        ticks: {
            line: {
                stroke: '#334155',
                strokeWidth: 1,
            },
            text: {
                fontSize: 11,
                fill: '#94a3b8', // slate-400
                outlineWidth: 0,
                outlineColor: 'transparent',
            },
        },
    },
    grid: {
        line: {
            stroke: '#1e293b', // slate-800
            strokeWidth: 1,
        },
    },
    dots: {
        text: {
            fontSize: 11,
            fill: '#f8fafc',
            outlineWidth: 0,
            outlineColor: 'transparent',
        },
    },
    legends: {
        title: {
            text: {
                fontSize: 11,
                fill: '#94a3b8',
                outlineWidth: 0,
                outlineColor: 'transparent',
            },
        },
        text: {
            fontSize: 11,
            fill: '#94a3b8',
            outlineWidth: 0,
            outlineColor: 'transparent',
        },
        ticks: {
            line: {},
            text: {
                fontSize: 10,
                fill: '#94a3b8',
                outlineWidth: 0,
                outlineColor: 'transparent',
            },
        },
    },
    annotations: {
        text: {
            fontSize: 13,
            fill: '#f8fafc',
            outlineWidth: 2,
            outlineColor: '#0f172a',
            outlineOpacity: 1,
        },
        link: {
            stroke: '#64748b',
            strokeWidth: 1,
            outlineWidth: 2,
            outlineColor: '#0f172a',
            outlineOpacity: 1,
        },
        outline: {
            stroke: '#64748b',
            strokeWidth: 2,
            outlineWidth: 2,
            outlineColor: '#0f172a',
            outlineOpacity: 1,
        },
        symbol: {
            fill: '#38bdf8',
            outlineWidth: 2,
            outlineColor: '#0f172a',
            outlineOpacity: 1,
        },
    },
    tooltip: {
        container: {
            background: '#0f172a', // slate-900
            color: '#f8fafc', // slate-50
            fontSize: 12,
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.4)',
            border: '1px solid #334155', // slate-700
            padding: '8px 12px',
        },
        basic: {},
        chip: {},
        table: {},
        tableCell: {
            color: '#f8fafc',
            padding: '3px 6px',
        },
        tableCellValue: {
            color: '#f8fafc',
        },
    },
};

export const nivoColors = [
    '#3b82f6', // blue-500
    '#8b5cf6', // violet-500
    '#f43f5e', // rose-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#06b6d4', // cyan-500
    '#ec4899', // pink-500
    '#6366f1', // indigo-500
];
