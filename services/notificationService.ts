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
        itemName: string
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

        try {
            await notifyResponsibilityAssigned({
                projectId: project.id,
                projectName: project.name,
                itemType,
                itemName,
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
    }
};
