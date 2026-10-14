import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from './firebaseConfig';
import { Project, TeamMember, Task, Phase } from '../types';

export const notificationService = {
    /**
     * Show confirmation dialog before sending emails
     */
    getSendConfirmationMessage: (count: number, itemType: string) => {
        return `You are about to assign ${count} member${count !== 1 ? 's' : ''} to this ${itemType}. Notification emails will be sent. Continue?`;
    },

    /**
     * Notify team members when a new member joins the project
     */
    notifyTeamMemberJoined: async (project: Project, newMember: TeamMember) => {
        console.log(`[NotificationService] Notifying team of new member: ${newMember.email}`);

        // Ensure auth token is fresh (matching pattern from working inviteUser)
        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.error('[NotificationService] No authenticated user');
            return false;
        }
        await currentUser.getIdToken(true);

        const functions = getFunctions(app, 'us-central1');
        const notifyProjectMemberAdded = httpsCallable(functions, 'notifyProjectMemberAdded');

        try {
            await notifyProjectMemberAdded({
                projectId: project.id,
                projectName: project.name,
                newMemberEmail: newMember.email,
                newMemberName: newMember.displayName,
                teamEmails: project.team.members.map(m => m.email)
            });
            return true;
        } catch (error) {
            console.error('Failed to notify team member joined:', error);
            // Don't block UI flow if notification fails
            return false;
        }
    },

    /**
     * Notify members when they are assigned responsibility
     */
    notifyResponsibilityAssigned: async (
        assignees: TeamMember[],
        project: Project,
        itemType: 'phase' | 'task',
        itemName: string,
        itemId?: string
    ) => {
        console.log(`[NotificationService] Notifying assignees for ${itemType}: ${itemName}`);

        if (assignees.length === 0) return;

        // Ensure auth token is fresh (matching pattern from working inviteUser)
        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.error('[NotificationService] No authenticated user');
            return false;
        }
        await currentUser.getIdToken(true);

        const functions = getFunctions(app, 'us-central1');
        const notifyResponsibilityAssigned = httpsCallable(functions, 'notifyResponsibilityAssigned');
        const origin = typeof window !== 'undefined' ? window.location.origin : undefined;

        try {
            await notifyResponsibilityAssigned({
                projectId: project.id,
                projectName: project.name,
                itemType,
                itemName,
                itemId,
                origin,
                assignees: assignees.map(a => ({
                    uid: a.uid,
                    email: a.email,
                    displayName: a.displayName
                }))
            });
            return true;
        } catch (error) {
            console.error('Failed to notify responsibility assigned:', error);
            // Don't block UI flow if notification fails
            return false;
        }
    },

    /**
     * Notify assigner / project owner of an impediment reported by an assignee
     */
    notifyTaskImpediment: async (
        project: Project,
        task: Task,
        category: string,
        description: string,
        recipients: TeamMember[]
    ) => {
        console.log(`[NotificationService] Notifying impediment on task: ${task.name}`);
        if (!recipients || recipients.length === 0) return false;

        const currentUser = auth.currentUser;
        if (!currentUser) return false;
        await currentUser.getIdToken(true);

        const functions = getFunctions(app, 'us-central1');
        const notify = httpsCallable(functions, 'notifyTaskImpediment');
        const origin = typeof window !== 'undefined' ? window.location.origin : undefined;

        try {
            await notify({
                projectId: project.id,
                projectName: project.name,
                taskName: task.name,
                taskId: task.id,
                origin,
                category,
                description,
                recipients: recipients.map(r => ({
                    uid: r.uid,
                    email: r.email,
                    displayName: r.displayName
                }))
            });
            return true;
        } catch (error) {
            console.error('Failed to notify task impediment:', error);
            return false;
        }
    },

    /**
     * Notify assignees/leads that an impediment has been resolved
     */
    notifyTaskImpedimentResolved: async (
        project: Project,
        task: Task,
        resolutionNote: string,
        recipients: TeamMember[]
    ) => {
        console.log(`[NotificationService] Notifying impediment resolved on task: ${task.name}`);
        if (!recipients || recipients.length === 0) return false;

        const currentUser = auth.currentUser;
        if (!currentUser) return false;
        await currentUser.getIdToken(true);

        const functions = getFunctions(app, 'us-central1');
        const notify = httpsCallable(functions, 'notifyTaskImpedimentResolved');
        const origin = typeof window !== 'undefined' ? window.location.origin : undefined;

        try {
            await notify({
                projectId: project.id,
                projectName: project.name,
                taskName: task.name,
                taskId: task.id,
                origin,
                resolutionNote,
                recipients: recipients.map(r => ({
                    uid: r.uid,
                    email: r.email,
                    displayName: r.displayName
                }))
            });
            return true;
        } catch (error) {
            console.error('Failed to notify task impediment resolved:', error);
            return false;
        }
    },

    /**
     * Notify assigner/owner that a task has reached 100% completion
     */
    notifyTaskCompleted: async (
        project: Project,
        task: Task,
        deliverablesSummary: string,
        recipients: TeamMember[]
    ) => {
        console.log(`[NotificationService] Notifying task completion: ${task.name}`);
        if (!recipients || recipients.length === 0) return false;

        const currentUser = auth.currentUser;
        if (!currentUser) return false;
        await currentUser.getIdToken(true);

        const functions = getFunctions(app, 'us-central1');
        const notify = httpsCallable(functions, 'notifyTaskCompleted');
        const origin = typeof window !== 'undefined' ? window.location.origin : undefined;

        try {
            await notify({
                projectId: project.id,
                projectName: project.name,
                taskName: task.name,
                taskId: task.id,
                origin,
                deliverablesSummary,
                recipients: recipients.map(r => ({
                    uid: r.uid,
                    email: r.email,
                    displayName: r.displayName
                }))
            });
            return true;
        } catch (error) {
            console.error('Failed to notify task completion:', error);
            return false;
        }
    },

    /**
     * Notify task collaborators of a new feedback note or direct mention
     */
    notifyTaskFeedback: async (
        project: Project,
        task: Task,
        message: string,
        recipients: TeamMember[],
        mentionedUids?: string[]
    ) => {
        console.log(`[NotificationService] Notifying task feedback on: ${task.name}`);
        if (!recipients || recipients.length === 0) return false;

        const currentUser = auth.currentUser;
        if (!currentUser) return false;
        await currentUser.getIdToken(true);

        const functions = getFunctions(app, 'us-central1');
        const notify = httpsCallable(functions, 'notifyTaskFeedback');
        const origin = typeof window !== 'undefined' ? window.location.origin : undefined;

        try {
            await notify({
                projectId: project.id,
                projectName: project.name,
                taskName: task.name,
                taskId: task.id,
                origin,
                message,
                mentionedUids: mentionedUids || [],
                recipients: recipients.map(r => ({
                    uid: r.uid,
                    email: r.email,
                    displayName: r.displayName
                }))
            });
            return true;
        } catch (error) {
            console.error('Failed to notify task feedback:', error);
            return false;
        }
    }
};

