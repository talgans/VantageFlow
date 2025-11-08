
import React, { useState } from 'react';
import { Project, UserRole, Phase, Task } from './types';
import { MOCK_PROJECTS } from './constants';
import MasterDashboard from './components/MasterDashboard';
import ProjectDetail from './components/ProjectDetail';
import Header from './components/Header';
import ProjectModal from './components/ProjectModal';
import ConfirmationModal from './components/ConfirmationModal';

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(UserRole.Manager);
  
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);


  const handleSelectProject = (project: Project) => {
    // Ensure we are selecting the most up-to-date project from the state
    const currentProject = projects.find(p => p.id === project.id) || project;
    setSelectedProject(currentProject);
  };

  const handleGoBack = () => {
    setSelectedProject(null);
  };
  
  const canModify = (role: UserRole) => {
    return role === UserRole.Admin || role === UserRole.Manager;
  }

  const handleUpdateProject = (updatedProject: Project) => {
    setProjects(currentProjects =>
      currentProjects.map(p => (p.id === updatedProject.id ? updatedProject : p))
    );
    setSelectedProject(updatedProject);
  };

  const handleShowCreateProjectModal = () => {
    setEditingProject(null);
    setIsProjectModalOpen(true);
  };

  const handleShowEditProjectModal = (project: Project) => {
    setEditingProject(project);
    setIsProjectModalOpen(true);
  };

  const handleCloseProjectModal = () => {
    setIsProjectModalOpen(false);
    setEditingProject(null);
  };

  const handleSaveProject = (projectData: Omit<Project, 'id' | 'phases'> & { id?: string }) => {
    if (projectData.id) { // Update
        const originalProject = projects.find(p => p.id === projectData.id);
        if (!originalProject) return;

        const updatedProjectData = { ...originalProject, ...projectData };

        setProjects(currentProjects =>
            currentProjects.map(p => (p.id === updatedProjectData.id ? updatedProjectData : p))
        );
        if (selectedProject?.id === updatedProjectData.id) {
            setSelectedProject(updatedProjectData);
        }
    } else { // Create
        const newProject: Project = {
            ...(projectData as Omit<Project, 'id' | 'phases'>),
            id: `proj-${Date.now()}`,
            phases: [],
        };
        setProjects(currentProjects => [newProject, ...currentProjects]);
    }
    handleCloseProjectModal();
  };

  const handleRequestDeleteProject = (project: Project) => {
    setProjectToDelete(project);
  };

  const handleConfirmDeleteProject = () => {
      if (!projectToDelete) return;
      setProjects(projects.filter(p => p.id !== projectToDelete.id));
      if (selectedProject?.id === projectToDelete.id) {
          setSelectedProject(null);
      }
      setProjectToDelete(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans">
      <Header currentUserRole={currentUserRole} setCurrentUserRole={setCurrentUserRole} />
      <main className="p-4 sm:p-6 lg:p-8">
        {selectedProject ? (
          <ProjectDetail 
            project={selectedProject} 
            onBack={handleGoBack}
            canEdit={canModify(currentUserRole)}
            onUpdateProject={handleUpdateProject}
          />
        ) : (
          <MasterDashboard 
            projects={projects} 
            onSelectProject={handleSelectProject}
            onShowCreateModal={handleShowCreateProjectModal}
            onEditProject={handleShowEditProjectModal}
            onDeleteProject={handleRequestDeleteProject}
            canModify={canModify(currentUserRole)}
          />
        )}
      </main>
      {isProjectModalOpen && (
        <ProjectModal 
          onClose={handleCloseProjectModal}
          onSave={handleSaveProject}
          projectToEdit={editingProject}
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
    </div>
  );
};

export default App;
