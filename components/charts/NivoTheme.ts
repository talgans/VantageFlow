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
                fill: '#64748b', // slate-500
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
                fill: '#333333',
                outlineWidth: 0,
                outlineColor: 'transparent',
            },
        },
    },
    annotations: {
        text: {
            fontSize: 13,
            fill: '#333333',
            outlineWidth: 2,
            outlineColor: '#ffffff',
            outlineOpacity: 1,
        },
        link: {
            stroke: '#000000',
            strokeWidth: 1,
            outlineWidth: 2,
            outlineColor: '#ffffff',
            outlineOpacity: 1,
        },
        outline: {
            stroke: '#000000',
            strokeWidth: 2,
            outlineWidth: 2,
            outlineColor: '#ffffff',
            outlineOpacity: 1,
        },
        symbol: {
            fill: '#000000',
            outlineWidth: 2,
            outlineColor: '#ffffff',
            outlineOpacity: 1,
        },
    },
    tooltip: {
        container: {
            background: '#1e293b', // slate-800
            color: '#f1f5f9', // slate-100
            fontSize: 12,
            borderRadius: '6px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            border: '1px solid #334155', // slate-700
        },
        basic: {},
        chip: {},
        table: {},
        tableCell: {},
        tableCellValue: {},
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
