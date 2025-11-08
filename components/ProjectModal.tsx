
import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import { XMarkIcon } from './icons';

interface ProjectModalProps {
  onClose: () => void;
  onSave: (projectData: Omit<Project, 'id' | 'phases'> & { id?: string }) => void;
  projectToEdit?: Project | null;
}

// Define the shape of the form data for type safety
type FormData = {
  name: string;
  description: string;
  coreSystem: string;
  duration: string;
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

const ProjectModal: React.FC<ProjectModalProps> = ({ onClose, onSave, projectToEdit }) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    coreSystem: '',
    duration: '',
    teamName: '',
    teamSize: '',
    teamManager: '',
    cost: '',
  });

  const [errors, setErrors] = useState<Partial<typeof formData>>({});

  useEffect(() => {
    if (projectToEdit) {
        setFormData({
            name: projectToEdit.name,
            description: projectToEdit.description,
            coreSystem: projectToEdit.coreSystem,
            duration: projectToEdit.duration,
            teamName: projectToEdit.team.name,
            teamSize: String(projectToEdit.team.size),
            teamManager: projectToEdit.team.manager,
            cost: projectToEdit.cost,
        });
    }
  }, [projectToEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    const newErrors: Partial<typeof formData> = {};
    if (!formData.name.trim()) newErrors.name = 'Project name is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
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
        duration: formData.duration,
        team: {
          name: formData.teamName,
          size: Number(formData.teamSize) || 0,
          manager: formData.teamManager,
        },
        cost: formData.cost,
      });
    }
  };
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-700 sticky top-0 bg-slate-800">
          <h2 className="text-xl font-bold text-white">{projectToEdit ? 'Edit Project' : 'Create New Project'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
            <InputField name="coreSystem" label="Core System" value={formData.coreSystem} onChange={handleChange} error={errors.coreSystem} />
            <InputField name="duration" label="Duration" value={formData.duration} onChange={handleChange} error={errors.duration} />
            <InputField name="teamName" label="Team Name" value={formData.teamName} onChange={handleChange} error={errors.teamName} />
            <InputField name="teamSize" label="Team Size" type="number" value={formData.teamSize} onChange={handleChange} error={errors.teamSize} />
            <InputField name="teamManager" label="Team Manager" value={formData.teamManager} onChange={handleChange} error={errors.teamManager} />
            <InputField name="cost" label="Cost / Funding" value={formData.cost} onChange={handleChange} error={errors.cost} />
          </div>

          <div className="flex justify-end items-center pt-4 space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-secondary rounded-lg hover:bg-blue-500">
              {projectToEdit ? 'Save Changes' : 'Save Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectModal;
