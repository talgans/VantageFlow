import React, { useState, useEffect } from 'react';
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
import WelcomeScreen from './components/WelcomeScreen';
import UserAdministrationPage from './components/UserAdministrationPage';
import UserProfilePage from './components/UserProfilePage';
import { useAuth } from './contexts/AuthContext';
import {
    subscribeToProjects,
    createProject,
    updateProject as updateFirestoreProject,
    deleteProject as deleteFirestoreProject,
    isFirestoreAvailable,
} from './services/firestoreService';

const App: React.FC = () => {
    const { user, loading: authLoading, signOut } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState<string>('dashboard');

    // Track previous user to detect login vs token refresh
    const [prevUser, setPrevUser] = useState<typeof user>(null);

    // Reset to dashboard only when user logs in (null -> user), not on token refresh updates
    useEffect(() => {
        // Only reset navigation when user transitions from null to logged-in
        if (user && !prevUser) {
            setCurrentPage('dashboard');
            setSelectedProject(null);
        }
        setPrevUser(user);
    }, [user, prevUser]);
    const [isSideNavOpen, setIsSideNavOpen] = useState(false);

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

        const unsubscribe = subscribeToProjects(
            (projectsFromDb) => {
                setProjects(projectsFromDb);
                setLoading(false);
            },
            (error) => {
                console.error('Firestore subscription error:', error);
                showToast('Failed to load projects from database');
                // Fallback to mock data
                setProjects(MOCK_PROJECTS);
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

    const canModify = (role: UserRole) => {
        return role === UserRole.Admin || role === UserRole.Manager;
    }

    const canEditProject = (project: Project): boolean => {
        // Admin can edit everything
        if (currentUserRole === UserRole.Admin) return true;
        // Owner can edit their own project
        if (user && project.ownerId === user.uid) return true;
        // Any team member can create/edit items (item-level CRUD checked in ProjectDetail)
        if (user && project.team?.members) {
            const isMember = project.team.members.some(m => m.uid === user.uid);
            if (isMember) {
                return true;
            }
        }
        return false;
    }

    // Get current user role, default to Member if not authenticated
    const currentUserRole = user?.role || UserRole.Member;

    const handleUpdateProject = async (updatedProject: Project) => {
        try {
            await updateFirestoreProject(updatedProject);
            // Real-time listener will update the state automatically
            setSelectedProject(updatedProject);
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
                // Update existing project
                await updateFirestoreProject(projectData as Project);
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
                    onRequestAccess={() => setIsLoginModalOpen(true)}
                    onLogin={() => setIsLoginModalOpen(true)}
                />
                <LoginModal
                    isOpen={isLoginModalOpen}
                    onClose={() => setIsLoginModalOpen(false)}
                />
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
                    ) : currentPage === 'projects' ? (
                        <ProjectsList
                            projects={projects}
                            onSelectProject={handleSelectProject}
                            onShowCreateModal={handleShowCreateProjectModal}
                            onShowPasteModal={handleShowPasteModal}
                            onEditProject={handleShowEditProjectModal}
                            onDeleteProject={handleRequestDeleteProject}
                            canModify={canModify(currentUserRole)}
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
                        />
                    )}
                </main>
            </div>
            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
            />
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
        </div>
    );
};

export default App;