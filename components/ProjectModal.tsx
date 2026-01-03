
import React, { useState, useEffect } from 'react';
import { Project, Phase, Task, TaskStatus } from '../types';
import { XMarkIcon, PlusCircleIcon, TrashIcon } from './icons';
import { parseTextToProject } from '../utils/textParser';

interface ProjectModalProps {
  onClose: () => void;
  onSave: (projectData: Omit<Project, 'id'> & { id?: string }) => void;
  projectToEdit?: Project | null;
  openWithTextImport?: boolean;
}

type FormData = {
  name: string;
  description: string;
  coreSystem: string;
  startDate: string; // Date input value (YYYY-MM-DD)
  duration: string; // Duration in weeks
  teamName: string;
  teamSize: string;
  teamManager: string;
  cost: string;
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
      <label htmlFor={name} className="block mb-2 text-sm font-medium text-slate-300">
          {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
          type={type}
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);

const ProjectModal: React.FC<ProjectModalProps> = ({ onClose, onSave, projectToEdit, openWithTextImport = false }) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    coreSystem: '',
    startDate: new Date().toISOString().split('T')[0], // Default to today
    duration: '',
    teamName: '',
    teamSize: '',
    teamManager: '',
    cost: '',
  });

  const [phases, setPhases] = useState<Phase[]>([]);
  const [errors, setErrors] = useState<Partial<typeof formData>>({});
  const [showTextImport, setShowTextImport] = useState(false);
  const [importText, setImportText] = useState('');

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
            teamName: projectToEdit.team.name,
            teamSize: String(projectToEdit.team.size),
            teamManager: projectToEdit.team.manager,
            cost: projectToEdit.cost,
        });
        setPhases(JSON.parse(JSON.stringify(projectToEdit.phases || [])));
    }
  }, [projectToEdit]);

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

  const validate = () => {
    const newErrors: Partial<typeof formData> = {};
    if (!formData.name.trim()) newErrors.name = 'Project name is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.startDate) newErrors.startDate = 'Start date is required';
    if (!formData.duration || isNaN(Number(formData.duration)) || Number(formData.duration) <= 0) {
        newErrors.duration = 'Duration must be a positive number of weeks';
    }
    if (formData.teamSize && isNaN(Number(formData.teamSize))) {
        newErrors.teamSize = 'Team size must be a number';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSave({
        id: projectToEdit?.id,
        name: formData.name,
        description: formData.description,
        coreSystem: formData.coreSystem,
        startDate: new Date(formData.startDate),
        duration: Number(formData.duration),
        team: {
          name: formData.teamName,
          size: Number(formData.teamSize) || 0,
          manager: formData.teamManager,
        },
        cost: formData.cost,
        phases: phases,
      });
    }
  };

  // --- Structure Handlers ---

  const handleAddPhase = () => {
    const newPhase: Phase = {
      id: `new-phase-${Date.now()}`,
      name: `New Phase ${phases.length + 1}`,
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
          status: TaskStatus.NotStarted,
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
          status: TaskStatus.NotStarted,
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
      const parsed = parseTextToProject(importText);
      
      // Auto-fill form fields
      setFormData(prev => ({
        ...prev,
        name: parsed.name,
        description: parsed.description,
        coreSystem: parsed.coreSystem,
        duration: String(parsed.duration),
      }));
      
      // Set phases and tasks
      setPhases(parsed.phases);
      
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
        className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
          <h2 className="text-xl font-bold text-white">{projectToEdit ? 'Edit Project' : 'Create New Project'}</h2>
          <div className="flex items-center gap-3">
            {!projectToEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Import from Text clicked');
                  setShowTextImport(true);
                }}
                className="text-sm px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors"
              >
                📋 Import from Text
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto">
          <div className="p-6 space-y-4">
            <InputField 
              name="name" 
              label="Project Name" 
              value={formData.name}
              onChange={handleChange}
              error={errors.name}
              required 
            />
            <div>
              <label htmlFor="description" className="block mb-2 text-sm font-medium text-slate-300">
                  Description <span className="text-red-500">*</span>
              </label>
              <textarea
                  id="description"
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleChange}
                  className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
              />
              {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField 
                name="coreSystem" 
                label="Core System" 
                value={formData.coreSystem} 
                onChange={handleChange} 
                error={errors.coreSystem} 
              />
              <InputField 
                name="startDate" 
                label="Start Date" 
                type="date"
                value={formData.startDate} 
                onChange={handleChange} 
                error={errors.startDate}
                required 
              />
              <InputField 
                name="duration" 
                label="Duration (weeks)" 
                type="number"
                value={formData.duration} 
                onChange={handleChange} 
                error={errors.duration}
                required 
              />
              <InputField name="teamName" label="Team Name" value={formData.teamName} onChange={handleChange} error={errors.teamName} />
              <InputField name="teamSize" label="Team Size" type="number" value={formData.teamSize} onChange={handleChange} error={errors.teamSize} />
              <InputField name="teamManager" label="Team Manager" value={formData.teamManager} onChange={handleChange} error={errors.teamManager} />
              <InputField name="cost" label="Cost / Funding" value={formData.cost} onChange={handleChange} error={errors.cost} />
            </div>

            {/* --- Project Structure --- */}
            <div className="pt-4 border-t border-slate-600">
                <h3 className="text-lg font-semibold text-white mb-3">Project Structure</h3>
                <div className="space-y-3">
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
                        <PlusCircleIcon className="w-5 h-5" /> Add Phase
                    </button>
                </div>
            </div>
          </div>
          <div className="flex justify-end items-center p-4 bg-slate-800 border-t border-slate-700 sticky bottom-0 space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-secondary rounded-lg hover:bg-blue-500">
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
                <li>Questions or headings → Phases</li>
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
    </div>
    </>
  );
};

export default ProjectModal;
