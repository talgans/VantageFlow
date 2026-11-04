
import React, { useState, useEffect, useMemo } from 'react';
import { Project, Phase, Task, TaskStatus, DurationUnit, Currency, TeamMember } from '../types';
import { XMarkIcon, PlusCircleIcon, TrashIcon } from './icons';
import { parseProjectText } from '../utils/projectParser';
import TeamMemberSelector from './TeamMemberSelector';
import { notificationService } from '../services/notificationService';
import { formatProjectTimeline } from '../services/userService';

export type ProjectModalTab = 'overview' | 'team' | 'structure';

interface ProjectModalProps {
  onClose: () => void;
  onSave: (projectData: Omit<Project, 'id'> & { id?: string }) => void;
  projectToEdit?: Project | null;
  openWithTextImport?: boolean;
  currentUserId?: string; // The current user's ID - will be primary lead for new projects
  currentUserEmail?: string; // The current user's email
  currentUserRole?: string;
  showToast?: (message: string) => void;
  initialTab?: ProjectModalTab;
}

type FormData = {
  name: string;
  description: string;
  coreSystem: string;
  startDate: string;
  duration: string;
  durationUnit: DurationUnit;
  cost: string;
  currency: Currency;
};

interface InputFieldProps {
  name: keyof FormData;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  required?: boolean;
  type?: string;
}

const InputField: React.FC<InputFieldProps> = ({ name, label, value, onChange, error, required, type = "text" }) => (
  <div>
    <label htmlFor={name} className="block mb-1 text-xs font-semibold text-slate-300">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    <input
      type={type}
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      className="bg-slate-700/80 border border-slate-600 text-white text-sm rounded-lg focus:ring-brand-secondary focus:border-brand-secondary block w-full px-3 py-2"
    />
    {error && <p className="mt-0.5 text-[11px] text-red-400">{error}</p>}
  </div>
);

const ProjectModal: React.FC<ProjectModalProps> = ({
  onClose,
  onSave,
  projectToEdit,
  openWithTextImport = false,
  currentUserId,
  currentUserEmail,
  currentUserRole,
  showToast,
  initialTab = 'overview',
}) => {
  const [activeTab, setActiveTab] = useState<ProjectModalTab>(initialTab);
  const [currentOwner, setCurrentOwner] = useState<{
    uid?: string;
    email?: string;
    displayName?: string;
    photoURL?: string;
  }>({
    uid: projectToEdit?.ownerId || currentUserId,
    email: projectToEdit?.ownerEmail || currentUserEmail,
    displayName: projectToEdit?.ownerName,
    photoURL: projectToEdit?.ownerPhotoURL,
  });

  const projectOwnerId = currentOwner.uid || projectToEdit?.ownerId || currentUserId;
  const [invitedInSessionUids, setInvitedInSessionUids] = useState<string[]>([]);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    coreSystem: '',
    startDate: new Date().toISOString().split('T')[0],
    duration: '',
    durationUnit: DurationUnit.Weeks,
    cost: '',
    currency: Currency.NGN,
  });

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [formerMembers, setFormerMembers] = useState<TeamMember[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [errors, setErrors] = useState<Partial<typeof formData>>({});
  const [showTextImport, setShowTextImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [showPrivacyWarning, setShowPrivacyWarning] = useState(false);

  useEffect(() => {
    if (projectToEdit) {
      setFormData({
        name: projectToEdit.name,
        description: projectToEdit.description,
        coreSystem: projectToEdit.coreSystem,
        startDate: projectToEdit.startDate instanceof Date
          ? projectToEdit.startDate.toISOString().split('T')[0]
          : new Date(projectToEdit.startDate).toISOString().split('T')[0],
        duration: String(projectToEdit.duration),
        durationUnit: projectToEdit.durationUnit || DurationUnit.Weeks,
        cost: String(projectToEdit.cost || ''),
        currency: projectToEdit.currency || Currency.NGN,
      });
      setIsPublic(projectToEdit.isPublic === true);
      setCurrentOwner({
        uid: projectToEdit.ownerId,
        email: projectToEdit.ownerEmail,
        displayName: projectToEdit.ownerName,
        photoURL: projectToEdit.ownerPhotoURL,
      });
      // Load team members or use legacy format
      if (projectToEdit.team?.members) {
        setTeamMembers(projectToEdit.team.members);
      }
      setFormerMembers(projectToEdit.team?.formerMembers || []);
      setPhases(JSON.parse(JSON.stringify(projectToEdit.phases || [])));
    } else if (currentUserId && currentUserEmail) {
      setIsPublic(false);
      setFormerMembers([]);
      setCurrentOwner({
        uid: currentUserId,
        email: currentUserEmail,
      });
      // For new projects, auto-add creator as primary lead
      setTeamMembers([{
        uid: currentUserId,
        email: currentUserEmail,
        leadRole: 'primary',
      }]);
    }
  }, [projectToEdit, currentUserId, currentUserEmail]);

  // Determine if the current user is a Project Lead (1st Lead, 2nd Lead) or Admin/SuperAdmin
  const { canInviteUsers, canTransferOwnership } = useMemo(() => {
    const isAdminOrSuperAdmin =
      currentUserEmail?.toLowerCase() === 'talgans@gmail.com' ||
      currentUserRole === 'superadmin' ||
      currentUserRole === 'admin';

    const isPrimary = Boolean(
      (currentUserId && projectOwnerId === currentUserId) ||
      teamMembers.some(
        (m) =>
          ((currentUserId && m.uid === currentUserId) ||
            (currentUserEmail && m.email?.toLowerCase() === currentUserEmail.toLowerCase())) &&
          m.leadRole === 'primary'
      )
    );

    const isSecondary = Boolean(
      teamMembers.some(
        (m) =>
          ((currentUserId && m.uid === currentUserId) ||
            (currentUserEmail && m.email?.toLowerCase() === currentUserEmail.toLowerCase())) &&
          m.leadRole === 'secondary'
      )
    );

    return {
      canInviteUsers: !projectToEdit || isAdminOrSuperAdmin || isPrimary || isSecondary,
      canTransferOwnership: Boolean(isAdminOrSuperAdmin || isPrimary),
    };
  }, [projectToEdit, currentUserId, currentUserEmail, currentUserRole, projectOwnerId, teamMembers]);

  const handleTransferOwnership = (newOwner: TeamMember) => {
    setCurrentOwner({
      uid: newOwner.uid,
      email: newOwner.email,
      displayName: newOwner.displayName,
      photoURL: newOwner.photoURL,
    });
  };

  const handleSelectPublic = () => {
    if (!isPublic) {
      setShowPrivacyWarning(true);
    }
  };

  const handleConfirmMakePublic = () => {
    setIsPublic(true);
    setShowPrivacyWarning(false);
  };

  const handleCancelMakePublic = () => {
    setShowPrivacyWarning(false);
  };

  const handleSelectPrivate = () => {
    setIsPublic(false);
  };

  // Auto-open text import if requested
  useEffect(() => {
    if (openWithTextImport && !projectToEdit) {
      setShowTextImport(true);
    }
  }, [openWithTextImport, projectToEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const [teamError, setTeamError] = useState<string | null>(null);

  const validate = () => {
    const newErrors: Partial<typeof formData> = {};
    if (!formData.name.trim()) newErrors.name = 'Project name is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.coreSystem) newErrors.coreSystem = 'Project type is required';
    if (!formData.startDate) newErrors.startDate = 'Start date is required';
    if (!formData.duration || isNaN(Number(formData.duration)) || Number(formData.duration) <= 0) {
      newErrors.duration = 'Duration must be a positive number';
    }
    if (formData.cost && isNaN(Number(formData.cost))) {
      newErrors.cost = 'Cost must be a number';
    }

    // Validate team members
    if (teamMembers.length === 0) {
      setTeamError('At least one team member is required');
    } else {
      setTeamError(null);
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      setActiveTab('overview');
      return false;
    }
    if (teamMembers.length === 0) {
      setActiveTab('team');
      return false;
    }

    return true;
  };

  const handleMemberRemovedWithChoice = (member: TeamMember, choice: 'former' | 'clear') => {
    if (choice === 'former') {
      // Add to formerMembers with isFormerMember flag
      setFormerMembers(prev => {
        if (prev.some(m => m.uid === member.uid)) return prev;
        return [...prev, { ...member, isFormerMember: true, departedAt: new Date() }];
      });
      // Mark them as former member on tasks in phases
      setPhases(prevPhases => prevPhases.map(phase => ({
        ...phase,
        assignees: phase.assignees?.map(a => a.uid === member.uid ? { ...a, isFormerMember: true } : a),
        tasks: phase.tasks.map(task => ({
          ...task,
          assignees: task.assignees?.map(a => a.uid === member.uid ? { ...a, isFormerMember: true } : a),
          subTasks: task.subTasks?.map(sub => ({
            ...sub,
            assignees: sub.assignees?.map(a => a.uid === member.uid ? { ...a, isFormerMember: true } : a),
          })),
        })),
      })));
    } else if (choice === 'clear') {
      // Unassign them completely from all tasks and phases
      setFormerMembers(prev => prev.filter(m => m.uid !== member.uid));
      setPhases(prevPhases => prevPhases.map(phase => ({
        ...phase,
        assignees: phase.assignees?.filter(a => a.uid !== member.uid),
        tasks: phase.tasks.map(task => ({
          ...task,
          assignees: task.assignees?.filter(a => a.uid !== member.uid),
          subTasks: task.subTasks?.map(sub => ({
            ...sub,
            assignees: sub.assignees?.filter(a => a.uid !== member.uid),
          })),
        })),
      })));
    }
  };

  const handleRestoreFormerMember = (member: TeamMember) => {
    // Remove from formerMembers and add back to teamMembers
    setFormerMembers(prev => prev.filter(m => m.uid !== member.uid));
    const restoredMember = { ...member, isFormerMember: false, departedAt: undefined };
    setTeamMembers(prev => [...prev, restoredMember]);
    // Update in phases as active member again
    setPhases(prevPhases => prevPhases.map(phase => ({
      ...phase,
      assignees: phase.assignees?.map(a => a.uid === member.uid ? { ...a, isFormerMember: false } : a),
      tasks: phase.tasks.map(task => ({
        ...task,
        assignees: task.assignees?.map(a => a.uid === member.uid ? { ...a, isFormerMember: false } : a),
        subTasks: task.subTasks?.map(sub => ({
          ...sub,
          assignees: sub.assignees?.map(a => a.uid === member.uid ? { ...a, isFormerMember: false } : a),
        })),
      })),
    })));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSave({
        ...(projectToEdit || {}),
        id: projectToEdit?.id,
        name: formData.name,
        description: formData.description,
        coreSystem: formData.coreSystem,
        startDate: new Date(formData.startDate),
        duration: Number(formData.duration),
        durationUnit: formData.durationUnit,
        ownerId: currentOwner.uid || projectToEdit?.ownerId || currentUserId,
        ownerEmail: currentOwner.email || projectToEdit?.ownerEmail || currentUserEmail,
        ownerName: currentOwner.displayName ?? projectToEdit?.ownerName,
        ownerPhotoURL: currentOwner.photoURL ?? projectToEdit?.ownerPhotoURL,
        team: {
          ...(projectToEdit?.team || {}),
          members: teamMembers,
          formerMembers: formerMembers,
        },
        cost: Number(formData.cost) || 0,
        currency: formData.currency,
        phases: phases,
        isPublic: isPublic,
      });

      // Check for newly added existing members and notify them with project context & timeline
      // (Exclude users who were already invited via the inline "Send Invite" button in this session)
      if (projectToEdit) {
        const originalMembers = projectToEdit.team?.members || [];
        const newMembers = teamMembers.filter(
          (tm) =>
            !originalMembers.some((om) => om.uid === tm.uid) &&
            !invitedInSessionUids.includes(tm.uid)
        );

        if (newMembers.length > 0) {
          const projectContext: any = {
            id: projectToEdit.id,
            name: formData.name,
            description: formData.description,
            startDate: new Date(formData.startDate),
            duration: Number(formData.duration),
            durationUnit: formData.durationUnit,
            team: { members: teamMembers },
          };

          newMembers.forEach((member) => {
            notificationService.notifyTeamMemberJoined(projectContext, member);
          });
        }
      }
    }
  };

  // --- Structure Handlers ---

  const handleAddPhase = () => {
    const newPhase: Phase = {
      id: `new-phase-${Date.now()}`,
      name: `New Section ${phases.length + 1}`,
      weekRange: 'TBD',
      tasks: [],
    };
    setPhases(p => [...p, newPhase]);
  };

  const handleUpdatePhase = (phaseId: string, newName: string) => {
    setPhases(p => p.map(phase => phase.id === phaseId ? { ...phase, name: newName } : phase));
  };

  const handleDeletePhase = (phaseId: string) => {
    setPhases(p => p.filter(phase => phase.id !== phaseId));
  };

  const handleAddTask = (phaseId: string) => {
    const newTask: Task = {
      id: `new-task-${Date.now()}`,
      name: 'New Task',
      status: TaskStatus.Zero,
      startDate: new Date(),
      endDate: new Date(),
      subTasks: [],
    };
    setPhases(p => p.map(phase => {
      if (phase.id === phaseId) {
        return { ...phase, tasks: [...phase.tasks, newTask] };
      }
      return phase;
    }));
  };

  const handleUpdateTask = (phaseId: string, taskId: string, newName: string) => {
    setPhases(p => p.map(phase => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          tasks: phase.tasks.map(task => task.id === taskId ? { ...task, name: newName } : task)
        };
      }
      return phase;
    }));
  };

  const handleDeleteTask = (phaseId: string, taskId: string) => {
    setPhases(p => p.map(phase => {
      if (phase.id === phaseId) {
        return { ...phase, tasks: phase.tasks.filter(task => task.id !== taskId) };
      }
      return phase;
    }));
  };

  const handleAddSubtask = (phaseId: string, taskId: string) => {
    const newSubtask: Task = {
      id: `new-subtask-${Date.now()}`,
      name: 'New Sub-task',
      status: TaskStatus.Zero,
      startDate: new Date(),
      endDate: new Date(),
    };
    setPhases(p => p.map(phase => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          tasks: phase.tasks.map(task => {
            if (task.id === taskId) {
              return { ...task, subTasks: [...(task.subTasks || []), newSubtask] };
            }
            return task;
          })
        };
      }
      return phase;
    }));
  };

  const handleUpdateSubtask = (phaseId: string, taskId: string, subtaskId: string, newName: string) => {
    setPhases(p => p.map(phase => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          tasks: phase.tasks.map(task => {
            if (task.id === taskId) {
              return {
                ...task,
                subTasks: (task.subTasks || []).map(sub => sub.id === subtaskId ? { ...sub, name: newName } : sub)
              };
            }
            return task;
          })
        };
      }
      return phase;
    }));
  };

  const handleDeleteSubtask = (phaseId: string, taskId: string, subtaskId: string) => {
    setPhases(p => p.map(phase => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          tasks: phase.tasks.map(task => {
            if (task.id === taskId) {
              return { ...task, subTasks: (task.subTasks || []).filter(sub => sub.id !== subtaskId) };
            }
            return task;
          })
        };
      }
      return phase;
    }));
  };

  const handleImportText = () => {
    if (!importText.trim()) return;

    try {
      const result = parseProjectText(importText);
      const parsed = result.project;

      // Auto-fill form fields
      setFormData(prev => ({
        ...prev,
        name: parsed.name || prev.name,
        description: parsed.description || prev.description,
        coreSystem: parsed.coreSystem || prev.coreSystem,
        duration: String(parsed.duration || prev.duration),
        cost: String(parsed.cost || 0),
        currency: parsed.currency || prev.currency,
      }));

      // Set phases and tasks
      if (parsed.phases && parsed.phases.length > 0) {
        setPhases(parsed.phases);
      }

      // Set team members if extracted
      if (parsed.team?.members && parsed.team.members.length > 0) {
        setTeamMembers(prev => {
          // Merge with existing, keeping current user if present
          const existingUids = prev.map(m => m.uid);
          const newMembers = parsed.team!.members.filter(m => !existingUids.includes(m.uid));
          return [...prev, ...newMembers];
        });
      }

      // Log parsing metadata
      console.log('Parse result:', {
        confidence: result.metadata.confidence,
        warnings: result.metadata.warnings,
        phases: parsed.phases?.length,
        tasks: parsed.phases?.reduce((acc, p) => acc + p.tasks.length, 0)
      });

      // Close import modal
      setShowTextImport(false);
      setImportText('');
    } catch (error) {
      console.error('Error parsing text:', error);
      alert('Failed to parse text. Please check the format and try again.');
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center px-6 py-3.5 border-b border-slate-700 sticky top-0 bg-slate-800 z-10 rounded-t-xl">
            <div className="min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary bg-brand-secondary/15 px-2 py-0.5 rounded border border-brand-secondary/30">
                  {projectToEdit ? 'Edit Project' : 'Create New Project'}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${isPublic
                    ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                    : 'bg-slate-700/80 text-slate-300 border border-slate-600'
                  }`}>
                  {isPublic ? '🌐 Public' : '🔒 Private'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white truncate leading-tight">
                {formData.name || (projectToEdit ? 'Untitled Project' : 'New Project Plan')}
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!projectToEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowTextImport(true);
                  }}
                  className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors font-medium"
                >
                  📋 Import from Text
                </button>
              )}
              <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/60 transition-colors">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="border-b border-slate-700 bg-slate-800/95 px-6 flex overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'overview'
                  ? 'border-brand-secondary text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
                }`}
            >
              <span>Overview</span>
              {Object.keys(errors).length > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500" title="Validation errors in Overview" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('team')}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'team'
                  ? 'border-brand-secondary text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
                }`}
            >
              <span>Team, Access & Invites</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300">
                {teamMembers.length}
              </span>
              {teamError && (
                <span className="w-2 h-2 rounded-full bg-red-500" title={teamError} />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('structure')}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'structure'
                  ? 'border-brand-secondary text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
                }`}
            >
              <span>Structure</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300">
                {phases.length}
              </span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto flex flex-col">
            <div className="p-5 space-y-3 flex-grow">
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="name" className="block mb-1 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Project Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g. CU Digital Learning Office"
                      className="bg-slate-700/90 border border-slate-600 text-white text-base font-semibold rounded-lg focus:ring-2 focus:ring-brand-secondary focus:border-transparent block w-full px-3.5 py-2 transition-colors placeholder-slate-400"
                    />
                    {errors.name && <p className="mt-0.5 text-[11px] text-red-400">{errors.name}</p>}
                  </div>

                  <div>
                    <label htmlFor="description" className="block mb-1 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Description <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      rows={2}
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Describe project goals, scope, and key deliverables..."
                      className="bg-slate-700/80 border border-slate-600 text-white text-sm rounded-lg focus:ring-2 focus:ring-brand-secondary focus:border-transparent block w-full px-3 py-1.5 placeholder-slate-400 resize-none"
                    />
                    {errors.description && <p className="mt-0.5 text-xs text-red-400">{errors.description}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="coreSystem" className="block mb-1 text-xs font-semibold text-slate-300">
                        Project Type <span className="text-red-400">*</span>
                      </label>
                      <select
                        id="coreSystem"
                        name="coreSystem"
                        value={formData.coreSystem}
                        onChange={(e) => setFormData(prev => ({ ...prev, coreSystem: e.target.value }))}
                        className="bg-slate-700/80 border border-slate-600 text-white text-sm rounded-lg focus:ring-brand-secondary focus:border-brand-secondary block w-full px-3 py-2"
                      >
                        <option value="">Select Type</option>
                        <option value="Technical">Technical</option>
                        <option value="Business">Business</option>
                        <option value="Creative">Creative</option>
                        <option value="Research">Research</option>
                        <option value="Compliance">Compliance</option>
                      </select>
                      {errors.coreSystem && <p className="mt-0.5 text-[11px] text-red-400">{errors.coreSystem}</p>}
                    </div>

                    <InputField
                      name="startDate"
                      label="Start Date"
                      type="date"
                      value={formData.startDate}
                      onChange={handleChange}
                      error={errors.startDate}
                      required
                    />

                    {/* Duration with Unit */}
                    <div>
                      <label className="block mb-1 text-xs font-semibold text-slate-300">
                        Duration <span className="text-red-400">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          name="duration"
                          value={formData.duration}
                          onChange={handleChange}
                          className="bg-slate-700/80 border border-slate-600 text-white text-sm rounded-lg focus:ring-brand-secondary focus:border-brand-secondary block w-24 px-3 py-2"
                          min="1"
                        />
                        <select
                          value={formData.durationUnit}
                          onChange={(e) => setFormData(prev => ({ ...prev, durationUnit: e.target.value as DurationUnit }))}
                          className="bg-slate-700/80 border border-slate-600 text-white text-sm rounded-lg focus:ring-brand-secondary focus:border-brand-secondary block flex-1 px-3 py-2"
                        >
                          <option value={DurationUnit.Hours}>Hours</option>
                          <option value={DurationUnit.Days}>Days</option>
                          <option value={DurationUnit.Weeks}>Weeks</option>
                          <option value={DurationUnit.Months}>Months</option>
                        </select>
                      </div>
                      {errors.duration && <p className="mt-0.5 text-xs text-red-400">{errors.duration}</p>}
                    </div>

                    {/* Cost with Currency */}
                    <div>
                      <label className="block mb-1 text-xs font-semibold text-slate-300">
                        Cost / Funding
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={formData.currency}
                          onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value as Currency }))}
                          className="bg-slate-700/80 border border-slate-600 text-white text-sm rounded-lg focus:ring-brand-secondary focus:border-brand-secondary block w-24 px-2.5 py-2"
                        >
                          <option value={Currency.NGN}>₦ NGN</option>
                          <option value={Currency.USD}>$ USD</option>
                        </select>
                        <input
                          type="number"
                          name="cost"
                          value={formData.cost}
                          onChange={handleChange}
                          placeholder="0.00"
                          className="bg-slate-700/80 border border-slate-600 text-white text-sm rounded-lg focus:ring-brand-secondary focus:border-brand-secondary block flex-1 px-3 py-2"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      {errors.cost && <p className="mt-0.5 text-xs text-red-400">{errors.cost}</p>}
                    </div>
                  </div>

                  {/* Return Privacy to Overview Tab as a Toggle */}
                  <div className="pt-0.5">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/40 border border-slate-600/70 hover:border-slate-500/70 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-xl select-none">{isPublic ? '🌐' : '🔒'}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white uppercase tracking-wider">
                              Project Privacy
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${isPublic
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                : 'bg-slate-700 text-slate-300 border border-slate-600'
                              }`}>
                              {isPublic ? 'Public Project' : 'Private (Recommended)'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {isPublic
                              ? 'Visible to all authenticated team members across the organization'
                              : 'Only the project owner and designated team members can view this project'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={isPublic}
                        onClick={() => {
                          if (!isPublic) {
                            setShowPrivacyWarning(true);
                          } else {
                            setIsPublic(false);
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:ring-offset-2 focus:ring-offset-slate-800 ${isPublic ? 'bg-blue-600' : 'bg-slate-600'
                          }`}
                        title={isPublic ? 'Click to make Private' : 'Click to make Public'}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${isPublic ? 'translate-x-5' : 'translate-x-0'
                            }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: TEAM, ACCESS & INVITES */}
              {activeTab === 'team' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      Team Members <span className="text-red-500">*</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Manage active team members, assign 2nd Leads, transfer 1st Lead ownership, or invite users via email.
                    </p>
                  </div>
                  <TeamMemberSelector
                    selectedMembers={teamMembers}
                    onChange={setTeamMembers}
                    projectOwnerId={projectOwnerId}
                    phases={phases}
                    formerMembers={formerMembers}
                    onMemberRemovedWithChoice={handleMemberRemovedWithChoice}
                    onRestoreFormerMember={handleRestoreFormerMember}
                    canInviteUsers={canInviteUsers}
                    canTransferOwnership={canTransferOwnership}
                    onTransferOwnership={handleTransferOwnership}
                    projectContext={{
                      projectId: projectToEdit?.id,
                      projectName: formData.name.trim(),
                      projectDescription: formData.description.trim(),
                      projectTimeline: formatProjectTimeline(formData.startDate, formData.duration, formData.durationUnit),
                    }}
                    onRequireProjectContext={() => setActiveTab('overview')}
                    onUserInvited={(newMember) => {
                      setInvitedInSessionUids((prev) => [...prev, newMember.uid]);
                    }}
                    showToast={showToast}
                    defaultExpanded={true}
                  />
                  {teamError && <p className="mt-2 text-xs text-red-500">{teamError}</p>}
                </div>
              )}

              {/* TAB 3: STRUCTURE */}
              {activeTab === 'structure' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-white">Project Structure</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Organize your project into sections, tasks, and subtasks.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTextImport(true)}
                      className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors"
                    >
                      📋 Import from Text
                    </button>
                  </div>
                  <div className="space-y-3">
                    {phases.length === 0 && (
                      <div className="bg-slate-900/40 border border-slate-700/70 rounded-lg p-6 text-center text-sm text-slate-400">
                        No sections added yet. Click <strong className="text-white">Add Section</strong> below or use <strong className="text-white">Import from Text</strong> to build your project structure.
                      </div>
                    )}
                    {phases.map(phase => (
                      <div key={phase.id} className="bg-slate-700/50 p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                          <input value={phase.name} onChange={(e) => handleUpdatePhase(phase.id, e.target.value)} className="flex-grow bg-transparent text-white font-semibold text-sm p-1 rounded-md focus:bg-slate-600" />
                          <button type="button" onClick={() => handleDeletePhase(phase.id)} className="text-slate-500 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                        <div className="pl-4 mt-2 space-y-2">
                          {phase.tasks.map(task => (
                            <div key={task.id}>
                              <div className="flex items-center gap-2 group">
                                <input value={task.name} onChange={(e) => handleUpdateTask(phase.id, task.id, e.target.value)} className="flex-grow bg-transparent text-slate-200 text-sm p-1 rounded-md focus:bg-slate-600" />
                                <button type="button" onClick={() => handleAddSubtask(phase.id, task.id)} className="text-slate-500 hover:text-brand-light opacity-0 group-hover:opacity-100 transition-opacity"><PlusCircleIcon className="w-4 h-4" /></button>
                                <button type="button" onClick={() => handleDeleteTask(phase.id, task.id)} className="text-slate-500 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                              </div>
                              <div className="pl-6 mt-1 space-y-1">
                                {(task.subTasks || []).map(subtask => (
                                  <div key={subtask.id} className="flex items-center gap-2">
                                    <input value={subtask.name} onChange={(e) => handleUpdateSubtask(phase.id, task.id, subtask.id, e.target.value)} className="flex-grow bg-transparent text-slate-400 text-sm p-1 rounded-md focus:bg-slate-600" />
                                    <button type="button" onClick={() => handleDeleteSubtask(phase.id, task.id, subtask.id)} className="text-slate-500 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                          <button type="button" onClick={() => handleAddTask(phase.id)} className="flex items-center gap-1 text-sm text-brand-light hover:text-white mt-2">
                            <PlusCircleIcon className="w-4 h-4" /> Add Task
                          </button>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={handleAddPhase} className="flex items-center gap-2 text-sm font-semibold text-white bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg">
                      <PlusCircleIcon className="w-5 h-5" /> Add Section
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end items-center px-6 py-3.5 bg-slate-800 border-t border-slate-700 sticky bottom-0 space-x-3 rounded-b-xl">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600">
                Cancel
              </button>
              <button type="submit" className="px-5 py-2 text-sm font-semibold text-white bg-brand-secondary rounded-lg hover:bg-blue-500 transition-colors shadow-md">
                {projectToEdit ? 'Save Changes' : 'Save Project'}
              </button>
            </div>
          </form>
        </div>

        {/* Text Import Modal */}
        {showTextImport && (
          <div
            className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
            onClick={(e) => {
              e.stopPropagation();
              console.log('Text import modal backdrop clicked');
              if (e.target === e.currentTarget) {
                setShowTextImport(false);
              }
            }}
          >
            <div
              className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-3xl max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-4 border-b border-slate-700">
                <h3 className="text-lg font-bold text-white">Import Project from Text</h3>
                <button
                  type="button"
                  onClick={() => {
                    console.log('Close text import clicked');
                    setShowTextImport(false);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 flex-grow overflow-y-auto">
                <p className="text-sm text-slate-400 mb-3">
                  Paste any text with project information. The system will automatically detect:
                </p>
                <ul className="text-xs text-slate-500 mb-4 space-y-1 list-disc list-inside">
                  <li>Questions or headings → Sections</li>
                  <li>Bullet points or lists → Tasks</li>
                  <li>Indented items → Subtasks</li>
                  <li>Keywords → Project type and duration</li>
                </ul>

                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Paste your project text here...\n\nExample:\nDoes it reflect a holistic strategy?\nYes – technically strong and comprehensive\n\nWhat's missing:\n- System vision\n- Inclusivity lens\n- Change management"
                  className="w-full h-64 bg-slate-900 border border-slate-600 text-white text-sm rounded-lg p-3 font-mono resize-none focus:ring-2 focus:ring-brand-secondary focus:border-transparent"
                />
              </div>

              <div className="flex justify-end gap-3 p-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowTextImport(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    console.log('Import & Parse clicked, text length:', importText.length);
                    handleImportText();
                  }}
                  disabled={!importText.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-secondary rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import & Parse
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Privacy Warning Modal */}
        {showPrivacyWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-slate-800 border border-amber-500/40 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center space-x-3 text-amber-400">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-xl font-bold">
                  ⚠️
                </div>
                <h3 className="text-lg font-bold text-white">Project Privacy Warning</h3>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                You are about to make this project <strong className="text-white">Public</strong>.
              </p>

              <p className="text-sm text-slate-300 leading-relaxed">
                Making this project public means that <span className="text-amber-300 font-semibold">all members and staff across the organization</span> will be able to discover and view its schedule, tasks, deliverables, budget, and team assignments.
              </p>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-200/90">
                🔒 If this project contains sensitive or confidential deliverables, we strongly recommend keeping it <strong>Private</strong>.
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={handleCancelMakePublic}
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors cursor-pointer"
                >
                  Keep Private
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMakePublic}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors shadow-lg shadow-amber-600/30 cursor-pointer font-semibold"
                >
                  I Understand, Make Public
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ProjectModal;
