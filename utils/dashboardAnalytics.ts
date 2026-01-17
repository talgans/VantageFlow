import { Project, Task, TaskStatus } from '../types';

export const calculateTaskCompletion = (tasks: Task[]) => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.status === TaskStatus.Hundred || (t.status as string) === 'Completed').length;
    return Math.round((completed / tasks.length) * 100);
};

export const getAllTasks = (project: Project): Task[] => {
    return project.phases.flatMap(ph =>
        ph.tasks.flatMap(t => t.subTasks ? [t, ...t.subTasks] : [t])
    );
};

export const getProjectsAtRisk = (projects: Project[]) => {
    return projects.filter(p => {
        const tasks = getAllTasks(p);
        return tasks.some(t => t.status === TaskStatus.AtRisk);
    });
};

export const getTeamWorkload = (projects: Project[]) => {
    const workload: Record<string, { name: string; count: number }> = {};

    projects.forEach(p => {
        const tasks = getAllTasks(p);
        tasks.forEach(t => {
            // Assuming tasks might have an 'assignee' field or we infer from project team
            // The current types might need checking. If tasks don't have explicit assignees,
            // we might count project membership as "load" or look for assignedTo fields.
            // For now, let's assume we are counting tasks per project owner if task assignee is missing
            // Or we will skip this if we can't determine task assignment accurately.

            // Checking actual Task type structure might be needed. 
            // Based on previous files, Task has 'assignedTo' (string[] of user IDs)

            if (t.assignedTo && t.assignedTo.length > 0) {
                t.assignedTo.forEach(uid => {
                    if (!workload[uid]) {
                        // We need a way to look up names. We might need to pass in a map or just use ID for now.
                        workload[uid] = { name: uid, count: 0 };
                    }
                    workload[uid].count++;
                });
            }
        });
    });

    return Object.values(workload).map(w => ({ id: w.name, value: w.count }));
};

export const getProjectStatusDistribution = (projects: Project[]) => {
    const distribution: Record<string, number> = {
        'Completed': 0,
        'In Progress': 0,
        'Not Started': 0,
        'At Risk': 0
    };

    projects.forEach(p => {
        const tasks = getAllTasks(p);
        if (tasks.length === 0) {
            distribution['Not Started']++;
            return;
        }

        const hasAtRisk = tasks.some(t => t.status === TaskStatus.AtRisk);
        if (hasAtRisk) {
            distribution['At Risk']++;
            return;
        }

        const pct = calculateTaskCompletion(tasks);
        if (pct === 100) distribution['Completed']++;
        else if (pct > 0) distribution['In Progress']++;
        else distribution['Not Started']++;
    });

    return Object.entries(distribution).map(([label, value]) => ({
        id: label,
        label,
        value
    }));
};

export interface Recommendation {
    id: string;
    type: 'warning' | 'info' | 'success';
    message: string;
    projectId?: string;
}

export const generateRecommendations = (projects: Project[]): Recommendation[] => {
    const recommendations: Recommendation[] = [];

    // Check for empty projects
    projects.forEach(p => {
        const tasks = getAllTasks(p);
        if (tasks.length === 0) {
            recommendations.push({
                id: `empty-${p.id}`,
                type: 'info',
                message: `Project "${p.name}" has no tasks. Add tasks to get started.`,
                projectId: p.id
            });
        }
    });

    // Check for projects at risk
    projects.forEach(p => {
        const tasks = getAllTasks(p);
        const atRiskTasks = tasks.filter(t => t.status === TaskStatus.AtRisk);
        if (atRiskTasks.length > 0) {
            recommendations.push({
                id: `risk-${p.id}`,
                type: 'warning',
                message: `Project "${p.name}" has ${atRiskTasks.length} task(s) at risk.`,
                projectId: p.id
            });
        }
    });

    // Check for stalled projects (created > 7 days ago, 0% progress)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    projects.forEach(p => {
        if (p.createdAt) {
            const created = new Date(p.createdAt);
            const tasks = getAllTasks(p);
            const pct = calculateTaskCompletion(tasks);
            if (created < oneWeekAgo && pct === 0 && tasks.length > 0) {
                recommendations.push({
                    id: `stalled-${p.id}`,
                    type: 'warning',
                    message: `Project "${p.name}" seems stalled. No progress in over a week.`,
                    projectId: p.id
                });
            }
        }
    });

    return recommendations;
};
