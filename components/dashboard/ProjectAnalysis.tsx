import React, { useMemo } from 'react';
import { Project, TaskStatus } from '../../types';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import { nivoTheme, nivoColors } from '../charts/NivoTheme';
import { getAllTasks } from '../../utils/dashboardAnalytics';

interface ProjectAnalysisProps {
    project: Project;
}

const ProjectAnalysis: React.FC<ProjectAnalysisProps> = ({ project }) => {
    const tasks = getAllTasks(project);

    const statusData = useMemo(() => {
        const counts: Record<string, number> = {
            'On Track': 0,
            'Completed': 0,
            'At Risk': 0,
        };

        tasks.forEach(t => {
            if (t.status === TaskStatus.AtRisk) counts['At Risk']++;
            else if (t.status === TaskStatus.Hundred || (t.status as string) === 'Completed') counts['Completed']++;
            else counts['On Track']++;
        });

        return Object.entries(counts)
            .filter(([, value]) => value > 0)
            .map(([id, value]) => ({ id, label: id, value }));
    }, [tasks]);

    const phaseData = useMemo(() => {
        return project.phases.map(ph => {
            const phTasks = ph.tasks.flatMap(t => t.subTasks ? [t, ...t.subTasks] : [t]);
            const completed = phTasks.filter(t => t.status === TaskStatus.Hundred || (t.status as string) === 'Completed').length;
            return {
                phase: ph.name.length > 12 ? ph.name.substring(0, 12) + '...' : ph.name,
                completed: completed,
                remaining: phTasks.length - completed
            };
        }).filter(d => d.completed + d.remaining > 0);
    }, [project]);

    if (tasks.length === 0) {
        return (
            <div className="p-6 text-center text-slate-500 bg-slate-900/30 rounded-lg">
                No tasks in this project yet.
            </div>
        );
    }

    return (
        <div className="p-4 bg-slate-900/30 rounded-lg space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Task Status */}
                {statusData.length > 0 && (
                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50 h-[280px] flex flex-col">
                        <h4 className="text-sm font-semibold text-slate-300 mb-3">Task Status</h4>
                        <div className="flex-grow">
                            <ResponsivePie
                                data={statusData}
                                margin={{ top: 10, right: 60, bottom: 10, left: 60 }}
                                innerRadius={0.5}
                                padAngle={0.7}
                                cornerRadius={3}
                                activeOuterRadiusOffset={8}
                                colors={nivoColors}
                                borderWidth={1}
                                borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
                                theme={nivoTheme}
                                enableArcLinkLabels={true}
                                arcLinkLabelsSkipAngle={10}
                                arcLinkLabelsTextColor="#94a3b8"
                                arcLinkLabelsThickness={2}
                                arcLinkLabelsColor={{ from: 'color' }}
                                enableArcLabels={true}
                                arcLabelsSkipAngle={10}
                                arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
                                animate={true}
                                motionConfig="gentle"
                                transitionMode="startAngle"
                            />
                        </div>
                    </div>
                )}

                {/* Phase Progress */}
                {phaseData.length > 0 && (
                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50 h-[280px] flex flex-col">
                        <h4 className="text-sm font-semibold text-slate-300 mb-3">Phase Progress</h4>
                        <div className="flex-grow">
                            <ResponsiveBar
                                data={phaseData}
                                keys={['completed', 'remaining']}
                                indexBy="phase"
                                margin={{ top: 10, right: 10, bottom: 40, left: 80 }}
                                padding={0.3}
                                layout="horizontal"
                                valueScale={{ type: 'linear' }}
                                indexScale={{ type: 'band', round: true }}
                                colors={[nivoColors[3], nivoColors[0]]}
                                borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
                                theme={nivoTheme}
                                axisTop={null}
                                axisRight={null}
                                axisBottom={{
                                    tickSize: 5,
                                    tickPadding: 5,
                                    tickRotation: 0,
                                    legend: 'Tasks',
                                    legendPosition: 'middle',
                                    legendOffset: 32
                                }}
                                axisLeft={{
                                    tickSize: 5,
                                    tickPadding: 5,
                                    tickRotation: 0,
                                }}
                                labelSkipWidth={12}
                                labelSkipHeight={12}
                                labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
                                animate={true}
                                motionConfig="gentle"
                                legends={[
                                    {
                                        dataFrom: 'keys',
                                        anchor: 'bottom-right',
                                        direction: 'row',
                                        justify: false,
                                        translateX: 0,
                                        translateY: 35,
                                        itemsSpacing: 2,
                                        itemWidth: 80,
                                        itemHeight: 20,
                                        itemDirection: 'left-to-right',
                                        itemOpacity: 0.85,
                                        symbolSize: 10,
                                        effects: [
                                            {
                                                on: 'hover',
                                                style: {
                                                    itemOpacity: 1
                                                }
                                            }
                                        ]
                                    }
                                ]}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectAnalysis;
