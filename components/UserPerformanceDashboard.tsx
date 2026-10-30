import React from 'react';
import { Project } from '../types';
import { useAuth } from '../contexts/AuthContext';
import ProjectPerformanceView from './ProjectPerformanceView';

interface UserPerformanceDashboardProps {
    projects: Project[];
    onSelectTask?: (projectId: string, taskId: string, phaseId?: string) => void;
    showToast?: (message: string) => void;
}

const UserPerformanceDashboard: React.FC<UserPerformanceDashboardProps> = ({
    projects,
    onSelectTask,
    showToast,
}) => {
    const { user } = useAuth();

    return (
        <ProjectPerformanceView
            projects={projects}
            currentUserId={user?.uid}
            currentUserName={user?.displayName || user?.email || undefined}
            onJumpToTask={onSelectTask}
            showToast={showToast}
        />
    );
};

export default UserPerformanceDashboard;
