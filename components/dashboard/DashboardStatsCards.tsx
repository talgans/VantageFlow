import React from 'react';
import { Project, TaskStatus } from '../../types';
import { getAllTasks, calculateTaskCompletion } from '../../utils/dashboardAnalytics';
import { PresentationChartLineIcon, CheckCircleIcon, ExclamationTriangleIcon, ClipboardDocumentListIcon } from '../icons';

interface DashboardStatsCardsProps {
    projects: Project[];
}

const DashboardStatsCards: React.FC<DashboardStatsCardsProps> = ({ projects }) => {
    const totalProjects = projects.length;

    const allTasks = projects.flatMap(getAllTasks);
    const totalTasks = allTasks.length;

    const completedTasks = allTasks.filter(t => t.status === TaskStatus.Hundred || (t.status as string) === 'Completed').length;
    const overallCompletion = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const atRiskProjects = projects.filter(p => getAllTasks(p).some(t => t.status === TaskStatus.AtRisk)).length;

    const cards = [
        {
            title: 'Total Projects',
            value: totalProjects,
            icon: PresentationChartLineIcon,
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/10',
        },
        {
            title: 'Total Tasks',
            value: totalTasks,
            icon: ClipboardDocumentListIcon,
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/10',
        },
        {
            title: 'Overall Completion',
            value: `${overallCompletion}%`,
            icon: CheckCircleIcon,
            color: 'text-emerald-400',
            bgColor: 'bg-emerald-500/10',
        },
        {
            title: 'Projects At Risk',
            value: atRiskProjects,
            icon: ExclamationTriangleIcon,
            color: 'text-rose-400',
            bgColor: 'bg-rose-500/10',
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {cards.map((card, index) => (
                <div key={index} className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-slate-400 font-medium text-sm">{card.title}</h3>
                        <div className={`p-2 rounded-lg ${card.bgColor}`}>
                            <card.icon className={`w-5 h-5 ${card.color}`} />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-white">{card.value}</p>
                </div>
            ))}
        </div>
    );
};

export default DashboardStatsCards;
