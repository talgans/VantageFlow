import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Project, UserRole, Phase, Task } from './types';
import { MOCK_PROJECTS } from './constants';
import MasterDashboard from './components/MasterDashboard';
import ProjectsList from './components/ProjectsList';
import ProjectDetail from './components/ProjectDetail';
import Header from './components/Header';
import SideNav from './components/SideNav';
import ProjectModal from './components/ProjectModal';
import ConfirmationModal from './components/ConfirmationModal';
import Toast from './components/Toast';
import LoginModal from './components/LoginModal';
import AccountSetupModal from './components/AccountSetupModal';
import WelcomeScreen from './components/WelcomeScreen';
import UserAdministrationPage from './components/UserAdministrationPage';
import UserProfilePage from './components/UserProfilePage';
import UserPerformanceDashboard from './components/UserPerformanceDashboard';
import RoleChangeNotification from './components/RoleChangeNotification';
import { useAuth } from './contexts/AuthContext';
import { presenceService } from './services/presenceService';
import {
    subscribeToProjects,
    subscribeToUserProjects,
    createProject,
    updateProject as updateFirestoreProject,
    deleteProject as deleteFirestoreProject,
    isFirestoreAvailable,
} from './services/firestoreService';

const App: React.FC = () => {
    const { user, loading: authLoading, signOut } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState<string>('dashboard');
    const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);

    // Track previous user to detect login vs token refresh
    const [prevUser, setPrevUser] = useState<typeof user>(null);

    // Account setup token from email invite link (?setupToken=...)
    const [setupToken, setSetupToken] = useState<string | null>(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('setupToken');
    });
    const [setupEmail, setSetupEmail] = useState<string | undefined>(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('email') || undefined;
    });
    const [isSetupModalOpen, setIsSetupModalOpen] = useState<boolean>(() => {
        const params = new URLSearchParams(window.location.search);
        return Boolean(params.get('setupToken'));
    });

    // Handle deep links from notification emails (e.g., /project/:id)
    useEffect(() => {
        const match = location.pathname.match(/^\/project\/([^/]+)$/);
        if (match) {
            const projectId = match[1];
            console.log('[DeepLink] Detected project deep link:', projectId);
            setPendingProjectId(projectId);
            // Clear the URL to prevent the match from triggering repeatedly
            navigate('/', { replace: true });
        }
    }, [location.pathname, navigate]);

    // Once projects are loaded and we have a pending project ID, navigate to it
    useEffect(() => {
        if (pendingProjectId && projects.length > 0) {
            const project = projects.find(p => p.id === pendingProjectId);
            if (project) {
                console.log('[DeepLink] Found project, navigating to:', project.name);
                setSelectedProject(project);
                setCurrentPage('projects');
                showToast(`Opened project: ${project.name}`);
            } else {
                console.warn('[DeepLink] Project not found:', pendingProjectId);
                showToast('Project not found or you do not have access');
            }
            setPendingProjectId(null);
        }
    }, [pendingProjectId, projects]);

    // Reset to dashboard only when user logs in (null -> user), not on token refresh updates
    useEffect(() => {
        // Only reset navigation when user transitions from null to logged-in (and no pending deep link)
        if (user && !prevUser && !pendingProjectId) {
            setCurrentPage('dashboard');
            setSelectedProject(null);
        }
        setPrevUser(user);
    }, [user, prevUser, pendingProjectId]);

    // Keep presence service informed of the actively viewed project
    useEffect(() => {
        if (user) {
            presenceService.updateCurrentProject(selectedProject?.id || null);
        }
    }, [user, selectedProject]);

    const [isSideNavOpen, setIsSideNavOpen] = useState(false);
    const [isSideNavCollapsed, setIsSideNavCollapsed] = useState(false);

    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [openWithTextImport, setOpenWithTextImport] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => {
            setToast(null);
        }, 3000);
    };

    /**
     * Subscribe to Firestore real-time updates (only when user is authenticated)
     */
    useEffect(() => {
        // Don't subscribe if user is not authenticated
        if (!user) {
            setLoading(false);
            return;
        }

        if (!isFirestoreAvailable()) {
            console.warn('Firestore not available, using mock data');
            setProjects(MOCK_PROJECTS);
            setLoading(false);
            return;
        }

        // Privacy & RBAC: SuperAdmins see all projects; all others see assigned + public projects
        const isMainSuperAdmin = user.email?.toLowerCase() === 'talgans@gmail.com';
        const isSuperAdmin = user.role === UserRole.SuperAdmin || isMainSuperAdmin;

        const unsubscribe = subscribeToUserProjects(
            user.uid,
            isSuperAdmin,
            (projectsFromDb) => {
                setProjects(projectsFromDb);
                setLoading(false);
            },
            (error) => {
                console.error('Firestore subscription error:', error);
                showToast('Failed to load projects from database');
                // Fallback to mock data (filtered client-side for safety)
                const filtered = isSuperAdmin
                    ? MOCK_PROJECTS
                    : MOCK_PROJECTS.filter(p => p.isPublic || p.ownerId === user.uid || p.team?.members?.some(m => m.uid === user.uid));
                setProjects(filtered);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user]);

    /**
     * Sync selected project with real-time updates from Firestore
     */
    useEffect(() => {
        if (selectedProject) {
            const updatedProject = projects.find(p => p.id === selectedProject.id);
            if (updatedProject) {
                setSelectedProject(updatedProject);
            }
        }
    }, [projects]);

    const handleSelectProject = (project: Project) => {
        // Ensure we are selecting the most up-to-date project from the state
        const currentProject = projects.find(p => p.id === project.id) || project;
        setSelectedProject(currentProject);
        setCurrentPage('projects'); // Ensure we're on the projects page
    };

    const handleGoBack = () => {
        setSelectedProject(null);
        setCurrentPage('projects'); // Ensure we're on the projects page when going back
    };

    const isMainSuperAdmin = user?.email?.toLowerCase() === 'talgans@gmail.com';
    const isSuperAdminUser = user?.role === UserRole.SuperAdmin || isMainSuperAdmin;

    const canModify = (role: UserRole) => {
        return role === UserRole.SuperAdmin || role === UserRole.Admin || role === UserRole.Manager;
    };

    const canDeleteProject = (project: Project): boolean => {
        if (!user) return false;
        // Primary SuperAdmin can delete ANY project
        if (isMainSuperAdmin) return true;

        // SuperAdmin can delete any project EXCEPT those created by talgans@gmail.com
        if (isSuperAdminUser) {
            return project.ownerEmail?.toLowerCase() !== 'talgans@gmail.com';
        }

        // Project owner can delete if manager or admin
        if (project.ownerId === user.uid && (user.role === UserRole.Manager || user.role === UserRole.Admin)) {
            return true;
        }

        return false;
    };

    const isProjectDeleteProtected = (project: Project): boolean => {
        if (!user) return false;
        if (isMainSuperAdmin) return false;
        // If user is a SuperAdmin and project was created by talgans@gmail.com
        if (isSuperAdminUser && project.ownerEmail?.toLowerCase() === 'talgans@gmail.com') {
            return true;
        }
        return false;
    };

    // Get current user role, default to Member if not authenticated
    const currentUserRole = user?.role || UserRole.Member;

    const normalizedUserRole: 'admin' | 'manager' | 'member' =
        currentUserRole === UserRole.SuperAdmin || currentUserRole === UserRole.Admin
            ? 'admin'
            : currentUserRole === UserRole.Manager
            ? 'manager'
            : 'member';

    const canEditProject = (project: Project): boolean => {
        if (!user) return false;
        // SuperAdmin and Admin can edit projects they have access to
        if (currentUserRole === UserRole.SuperAdmin || currentUserRole === UserRole.Admin) return true;
        // Owner can edit their own project
        if (project.ownerId === user.uid || (project.ownerEmail && user.email && project.ownerEmail.toLowerCase() === user.email.toLowerCase())) return true;
        // Check if user is in memberUids
        if (project.memberUids && project.memberUids.includes(user.uid)) return true;
        // Any team member belonging to the project can edit/add tasks
        if (project.team?.members) {
            const isMember = project.team.members.some(m =>
                (m.uid && m.uid === user.uid) ||
                (m.email && user.email && m.email.toLowerCase() === user.email.toLowerCase())
            );
            if (isMember) {
                return true;
            }
        }
        return false;
    };

    const handleUpdateProject = async (updatedProject: Project) => {
        try {
            await updateFirestoreProject(updatedProject);
            // Real-time listener will update the state
            showToast('Project updated successfully');
        } catch (error) {
            console.error('Error updating project:', error);
            showToast('Failed to update project');
        }
    };

    const handleShowCreateProjectModal = () => {
        setEditingProject(null);
        setOpenWithTextImport(false);
        setIsProjectModalOpen(true);
    };

    const handleShowPasteModal = () => {
        setEditingProject(null);
        setOpenWithTextImport(true);
        setIsProjectModalOpen(true);
    };

    const handleShowEditProjectModal = (project: Project) => {
        setEditingProject(project);
        setIsProjectModalOpen(true);
    };

    const handleCloseProjectModal = () => {
        setIsProjectModalOpen(false);
        setEditingProject(null);
        setOpenWithTextImport(false);
    };

    const handleSaveProject = async (projectData: Omit<Project, 'id'> & { id?: string }) => {
        try {
            console.log('Saving project data:', projectData);

            if (projectData.id) {
                // Update existing project - merge with existing project to preserve metadata like ownerId
                const existingProject = projects.find(p => p.id === projectData.id);
                const updatedPayload: Project = {
                    ...(existingProject || {}),
                    ...(projectData as Project),
                    ownerId: projectData.ownerId || existingProject?.ownerId || user?.uid,
                    ownerEmail: projectData.ownerEmail || existingProject?.ownerEmail || user?.email || undefined,
                };
                await updateFirestoreProject(updatedPayload);
                showToast('Project updated successfully');
            } else {
                // Create new project - set owner
                const newProjectData = {
                    ...projectData,
                    ownerId: user?.uid,
                    ownerEmail: user?.email || undefined,
                    ownerName: user?.displayName || undefined,
                    ownerPhotoURL: user?.photoURL || undefined,
                };
                console.log('Creating new project with owner:', newProjectData);
                await createProject(newProjectData);
                showToast('Project created successfully');
            }
            handleCloseProjectModal();
        } catch (error) {
            console.error('Error saving project:', error);
            console.error('Error details:', error instanceof Error ? error.message : error);
            showToast(`Failed to save project: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleRequestDeleteProject = (project: Project) => {
        setProjectToDelete(project);
    };

    const handleConfirmDeleteProject = async () => {
        if (!projectToDelete) return;

        if (!canDeleteProject(projectToDelete)) {
            showToast('You do not have permission to delete this project');
            setProjectToDelete(null);
            return;
        }

        try {
            await deleteFirestoreProject(projectToDelete.id);

            if (selectedProject?.id === projectToDelete.id) {
                setSelectedProject(null);
            }

            setProjectToDelete(null);
            showToast('Project deleted successfully');
        } catch (error) {
            console.error('Error deleting project:', error);
            showToast('Failed to delete project');
        }
    };

    const handleSignOut = async () => {
        try {
            if (user?.uid) {
                await presenceService.setOffline(user.uid);
            }
            await signOut();
            showToast('Signed out successfully');
        } catch (error) {
            console.error('Error signing out:', error);
            showToast('Failed to sign out');
        }
    };

    // Show loading state
    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-secondary mx-auto"></div>
                    <p className="text-slate-400 mt-4">Loading...</p>
                </div>
            </div>
        );
    }

    // Show loading spinner while checking authentication
    if (authLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    // Show welcome screen if user is not authenticated
    if (!user) {
        return (
            <>
                <WelcomeScreen
                    onLogin={() => setIsLoginModalOpen(true)}
                    isInvited={Boolean(setupToken)}
                    onOpenSetup={() => setIsSetupModalOpen(true)}
                />
                <LoginModal
                    isOpen={isLoginModalOpen}
                    onClose={() => setIsLoginModalOpen(false)}
                    hasInviteToken={Boolean(setupToken)}
                    onOpenSetup={() => {
                        setIsLoginModalOpen(false);
                        setIsSetupModalOpen(true);
                    }}
                />
                {setupToken && (
                    <AccountSetupModal
                        isOpen={isSetupModalOpen}
                        token={setupToken}
                        initialEmail={setupEmail}
                        onClose={() => setIsSetupModalOpen(false)}
                        showToast={showToast}
                        onSuccess={() => {
                            setSetupToken(null);
                            setIsSetupModalOpen(false);
                        }}
                    />
                )}
                {toast && <Toast message={toast} />}
            </>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 font-sans">
            <Header
                currentUserRole={currentUserRole}
                onSignOut={handleSignOut}
                onSignInClick={() => setIsLoginModalOpen(true)}
                onMenuClick={() => setIsSideNavOpen(true)}
                onNavigateToProfile={() => {
                    setCurrentPage('profile');
                    setSelectedProject(null);
                }}
                projects={projects}
            />
            <div className="flex">
                <SideNav
                    currentPage={currentPage}
                    onNavigate={(page) => {
                        setCurrentPage(page);
                        setSelectedProject(null); // Reset selected project when navigating
                        setIsSideNavOpen(false);
                    }}
                    isOpen={isSideNavOpen}
                    onClose={() => setIsSideNavOpen(false)}
                    userRole={currentUserRole}
                    isCollapsed={isSideNavCollapsed}
                    onToggleCollapse={() => setIsSideNavCollapsed(!isSideNavCollapsed)}
                />
                <main className="flex-1 p-4 sm:p-6 lg:p-8">
                    {selectedProject ? (
                        <ProjectDetail
                            project={selectedProject}
                            onBack={handleGoBack}
                            canEdit={canEditProject(selectedProject)}
                            onUpdateProject={handleUpdateProject}
                            showToast={showToast}
                            currentUserId={user?.uid}
                            currentUserEmail={user?.email || undefined}
                            userRole={normalizedUserRole}
                            onEditProject={() => handleShowEditProjectModal(selectedProject)}
                        />
                    ) : currentPage === 'users' ? (
                        <UserAdministrationPage
                            currentUserEmail={user?.email || ''}
                            showToast={showToast}
                        />
                    ) : currentPage === 'profile' ? (
                        <UserProfilePage
                            projects={projects}
                            onSelectProject={handleSelectProject}
                            showToast={showToast}
                        />
                    ) : currentPage === 'performance' ? (
                        <UserPerformanceDashboard projects={projects} />
                    ) : currentPage === 'projects' ? (
                        <ProjectsList
                            projects={projects}
                            onSelectProject={handleSelectProject}
                            onShowCreateModal={handleShowCreateProjectModal}
                            onShowPasteModal={handleShowPasteModal}
                            onEditProject={handleShowEditProjectModal}
                            onDeleteProject={handleRequestDeleteProject}
                            canModify={canModify(currentUserRole)}
                            canDeleteProject={canDeleteProject}
                            isProjectDeleteProtected={isProjectDeleteProtected}
                        />
                    ) : (
                        <MasterDashboard
                            projects={projects}
                            onSelectProject={handleSelectProject}
                            onShowCreateModal={handleShowCreateProjectModal}
                            onShowPasteModal={handleShowPasteModal}
                            onEditProject={handleShowEditProjectModal}
                            onDeleteProject={handleRequestDeleteProject}
                            canModify={canModify(currentUserRole)}
                            canDeleteProject={canDeleteProject}
                            isProjectDeleteProtected={isProjectDeleteProtected}
                        />
                    )}
                </main>
            </div>
            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
                hasInviteToken={Boolean(setupToken)}
                onOpenSetup={() => {
                    setIsLoginModalOpen(false);
                    setIsSetupModalOpen(true);
                }}
            />
            {setupToken && (
                <AccountSetupModal
                    isOpen={isSetupModalOpen}
                    token={setupToken}
                    initialEmail={setupEmail}
                    onClose={() => setIsSetupModalOpen(false)}
                    showToast={showToast}
                    onSuccess={() => {
                        setSetupToken(null);
                        setIsSetupModalOpen(false);
                        setCurrentPage('dashboard');
                    }}
                />
            )}
            {isProjectModalOpen && (
                <ProjectModal
                    onClose={handleCloseProjectModal}
                    onSave={handleSaveProject}
                    projectToEdit={editingProject}
                    openWithTextImport={openWithTextImport}
                    currentUserId={user?.uid}
                    currentUserEmail={user?.email || undefined}
                />
            )}
            {projectToDelete && (
                <ConfirmationModal
                    isOpen={!!projectToDelete}
                    onClose={() => setProjectToDelete(null)}
                    onConfirm={handleConfirmDeleteProject}
                    title="Delete Project"
                    message={<>Are you sure you want to delete the project "<strong>{projectToDelete.name}</strong>"? This action cannot be undone.</>}
                />
            )}
            {toast && <Toast message={toast} />}
            <RoleChangeNotification />
        </div>
    );
};

export default App;