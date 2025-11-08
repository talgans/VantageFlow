import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Project, Task, TaskStatus, Phase } from '../types';
import StatusBadge from './StatusBadge';
import { getProjectInsights } from '../services/geminiService';
import { ArrowLeftIcon, SparklesIcon, InfoIcon, TeamIcon, CalendarIcon, MoneyIcon, CheckCircleIcon, PlusCircleIcon, ChevronRightIcon, ChevronDownIcon, ListBulletIcon, ChartBarIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon } from './icons';
import GanttChart from './GanttChart';
import ConfirmationModal from './ConfirmationModal';

// Helper function to calculate task progress recursively
const calculateTaskProgress = (task: Task): number => {
    if (!task.subTasks || task.subTasks.length === 0) {
        switch (task.status) {
            case TaskStatus.Completed:
                return 100;
            case TaskStatus.InProgress:
            case TaskStatus.AtRisk:
                return 50;
            default:
                return 0;
        }
    }

    const totalProgress = task.subTasks.reduce((sum, subTask) => sum + calculateTaskProgress(subTask), 0);
    return Math.round(totalProgress / task.subTasks.length);
};

const TaskProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
    <div className="w-full bg-slate-700 rounded-full h-1.5 mt-1.5">
        <div 
            className="bg-brand-secondary h-1.5 rounded-full transition-all duration-500" 
            style={{ width: `${progress}%` }}
        ></div>
    </div>
);

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
  canEdit: boolean;
  onUpdateProject: (project: Project) => void;
}

type SortKey = 'name' | 'startDate' | 'status' | 'deliverables';
type SortDirection = 'ascending' | 'descending';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

const sortTasks = (tasks: Task[], config: SortConfig): Task[] => {
    if (!tasks) return [];
    
    const sorted = [...tasks].sort((a, b) => {
        let compareValue = 0;
        switch (config.key) {
            case 'name':
                compareValue = a.name.localeCompare(b.name);
                break;
            case 'startDate':
                // revive dates since they might be strings from JSON.parse
                const dateA = new Date(a.startDate);
                const dateB = new Date(b.startDate);
                compareValue = dateA.getTime() - dateB.getTime();
                break;
            case 'status':
                compareValue = a.status.localeCompare(b.status);
                break;
            case 'deliverables':
                const aLen = a.deliverables?.length || 0;
                const bLen = b.deliverables?.length || 0;
                compareValue = aLen - bLen;
                break;
        }
        return config.direction === 'ascending' ? compareValue : -compareValue;
    });

    return sorted.map(task => ({
        ...task,
        subTasks: task.subTasks ? sortTasks(task.subTasks, config) : undefined
    }));
};


const InlineTaskForm: React.FC<{
  onSave: (name: string) => void;
  onCancel: () => void;
  placeholder: string;
  className?: string;
}> = ({ onSave, onCancel, placeholder, className }) => {
  const [name, setName] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
      setName('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`flex items-center gap-2 ${className || ''}`}>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={placeholder}
        className="bg-slate-700 border border-slate-600 text-white text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
        autoFocus
      />
      <button type="submit" className="px-3 py-2 text-sm font-medium text-white bg-brand-secondary rounded-md hover:bg-blue-500">Save</button>
      <button type="button" onClick={onCancel} className="px-3 py-2 text-sm font-medium text-slate-300 bg-slate-700 rounded-md hover:bg-slate-600">Cancel</button>
    </form>
  )
}

const STATUS_BUTTON_STYLES: Record<TaskStatus, string> = {
  [TaskStatus.Completed]: 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/20',
  [TaskStatus.InProgress]: 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border-yellow-500/20',
  [TaskStatus.NotStarted]: 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/20 border-gray-500/20',
  [TaskStatus.AtRisk]: 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20',
};

const StatusEditButtons: React.FC<{
  onSelect: (status: TaskStatus) => void;
  onClose: () => void;
}> = ({ onSelect, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      onBlur={(e) => {
        // Close only if focus moves outside the component
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          onClose();
        }
      }}
      className="flex items-center space-x-1 outline-none p-1 bg-slate-900 rounded-lg"
    >
      {Object.values(TaskStatus).map((status) => (
        <button
          key={status}
          onClick={() => onSelect(status)}
          className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors border ${STATUS_BUTTON_STYLES[status]}`}
        >
          {status}
        </button>
      ))}
    </div>
  );
};


const TaskRow: React.FC<{
    task: Task;
    level: number;
    isExpanded: boolean;
    onToggleExpand: (taskId: string) => void;
    addingSubtaskTo: string | null;
    setAddingSubtaskTo: (taskId: string | null) => void;
    canEdit: boolean;
    handleSaveSubtask: (parentTaskId: string, subTaskName: string) => void;
    editingField: { taskId: string; field: string } | null;
    setEditingField: (field: { taskId: string; field: string } | null) => void;
    handleUpdateTaskField: (taskId: string, field: keyof Task, value: any) => void;
    onRequestDelete: (taskId: string) => void;
}> = ({ task, level, isExpanded, onToggleExpand, addingSubtaskTo, setAddingSubtaskTo, canEdit, handleSaveSubtask, editingField, setEditingField, handleUpdateTaskField, onRequestDelete }) => {
    const hasSubtasks = task.subTasks && task.subTasks.length > 0;
    const formatDate = (date: Date) => new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric' });
    const isEditing = (field: string) => editingField?.taskId === task.id && editingField?.field === field;
    const progress = calculateTaskProgress(task);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        } else if (e.key === 'Escape') {
            setEditingField(null);
        }
    }
    
    return (
      <>
        <li className="bg-slate-800 rounded-lg p-2 grid grid-cols-10 gap-4 items-center" style={{ marginLeft: `${level * 2}rem`}}>
            <div className="col-span-4 text-white font-medium flex items-center">
                {hasSubtasks ? (
                    <button onClick={() => onToggleExpand(task.id)} className="mr-2 text-slate-400 hover:text-white flex-shrink-0">
                        {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                    </button>
                ) : <div className="w-4 h-4 mr-2 flex-shrink-0"></div>}

                <div className="w-full">
                  {isEditing('name') ? (
                      <input
                          type="text"
                          defaultValue={task.name}
                          onBlur={(e) => handleUpdateTaskField(task.id, 'name', e.target.value)}
                          onKeyDown={handleKeyDown}
                          className="bg-slate-700 border border-slate-600 text-white text-sm rounded-md block w-full p-1"
                          autoFocus
                      />
                  ) : (
                      <span className="w-full cursor-pointer" onClick={() => canEdit && setEditingField({ taskId: task.id, field: 'name' })}>{task.name}</span>
                  )}
                  <TaskProgressBar progress={progress} />
                </div>
            </div>

            <div className="col-span-2 text-slate-300">
                {isEditing('startDate') ? (
                    <input
                        type="date"
                        defaultValue={new Date(task.startDate).toISOString().split('T')[0]}
                        onBlur={(e) => handleUpdateTaskField(task.id, 'startDate', new Date(e.target.value))}
                        onKeyDown={handleKeyDown}
                        className="bg-slate-700 border border-slate-600 text-white text-sm rounded-md block w-full p-1"
                        autoFocus
                    />
                ) : (
                    <span className="p-1 cursor-pointer" onClick={() => canEdit && setEditingField({ taskId: task.id, field: 'startDate' })}>{formatDate(task.startDate)}</span>
                )}
                <span className="mx-1">-</span>
                {isEditing('endDate') ? (
                    <input
                        type="date"
                        defaultValue={new Date(task.endDate).toISOString().split('T')[0]}
                        onBlur={(e) => handleUpdateTaskField(task.id, 'endDate', new Date(e.target.value))}
                        onKeyDown={handleKeyDown}
                        className="bg-slate-700 border border-slate-600 text-white text-sm rounded-md block w-full p-1"
                        autoFocus
                    />
                ) : (
                    <span className="p-1 cursor-pointer" onClick={() => canEdit && setEditingField({ taskId: task.id, field: 'endDate' })}>{formatDate(task.endDate)}</span>
                )}
            </div>
            
            <div className="col-span-2">
              {isEditing('status') ? (
                <StatusEditButtons
                  onSelect={(status) => {
                    handleUpdateTaskField(task.id, 'status', status);
                    setEditingField(null);
                  }}
                  onClose={() => setEditingField(null)}
                />
              ) : (
                <div
                  className="inline-block cursor-pointer"
                  onClick={() => canEdit && setEditingField({ taskId: task.id, field: 'status' })}
                >
                  <StatusBadge status={task.status} />
                </div>
              )}
            </div>

            <div className="col-span-2 flex items-center justify-between">
              <div className="text-slate-400 text-xs space-y-1">
                  {task.deliverables?.map(d => <div key={d} className="flex items-center"><CheckCircleIcon className="w-3 h-3 text-green-500 mr-1.5 flex-shrink-0" /> {d}</div>)}
              </div>
              {canEdit && (
                  <div className="flex items-center space-x-1">
                    <button onClick={() => setAddingSubtaskTo(task.id)} className="text-slate-500 hover:text-brand-light transition-colors p-1 rounded-full">
                        <PlusCircleIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => onRequestDelete(task.id)} className="text-slate-500 hover:text-red-500 transition-colors p-1 rounded-full">
                        <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
              )}
            </div>
        </li>
        {addingSubtaskTo === task.id && (
            <InlineTaskForm 
                onSave={(name) => handleSaveSubtask(task.id, name)} 
                onCancel={() => setAddingSubtaskTo(null)} 
                placeholder="New sub-task name"
                className="mt-2 ml-12"
            />
        )}
        {isExpanded && hasSubtasks && (
            task.subTasks?.map(subTask => (
                <TaskRow 
                    key={subTask.id}
                    task={subTask}
                    level={level + 1}
                    isExpanded={isExpanded}
                    onToggleExpand={onToggleExpand}
                    addingSubtaskTo={addingSubtaskTo}
                    setAddingSubtaskTo={setAddingSubtaskTo}
                    canEdit={canEdit}
                    handleSaveSubtask={handleSaveSubtask}
                    editingField={editingField}
                    setEditingField={setEditingField}
                    handleUpdateTaskField={handleUpdateTaskField}
                    onRequestDelete={onRequestDelete}
                />
            ))
        )}
      </>
    );
};


interface SortableHeaderCellProps {
  label: string;
  sortKey: SortKey;
  sortConfig: SortConfig;
  onSort: (key: SortKey) => void;
  className?: string;
}

const SortableHeaderCell: React.FC<SortableHeaderCellProps> = ({ label, sortKey, sortConfig, onSort, className }) => {
  const isSorted = sortConfig.key === sortKey;

  return (
    <div className={className}>
      <button onClick={() => onSort(sortKey)} className="flex items-center space-x-1 font-medium text-slate-400 hover:text-slate-200 transition-colors group">
        <span className="group-hover:text-white">{label}</span>
        {isSorted && (
          sortConfig.direction === 'ascending' 
            ? <ArrowUpIcon className="w-3 h-3 text-brand-light" /> 
            : <ArrowDownIcon className="w-3 h-3 text-brand-light" />
        )}
      </button>
    </div>
  );
};


const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, onBack, canEdit, onUpdateProject }) => {
  const [aiInsight, setAiInsight] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<string | null>(null);
  const [addingTaskToPhase, setAddingTaskToPhase] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ taskId: string; field: string } | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'gantt'>('list');
  const [taskToDeleteId, setTaskToDeleteId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'startDate', direction: 'ascending' });


  const sortedProject = useMemo(() => {
    // Deep copy project to avoid mutating props, and revive dates which are lost in stringify
    const projectCopy = JSON.parse(JSON.stringify(project), (key, value) => {
        if (key === 'startDate' || key === 'endDate') {
            return new Date(value);
        }
        return value;
    });

    projectCopy.phases.forEach((phase: Phase) => {
        phase.tasks = sortTasks(phase.tasks, sortConfig);
    });
    return projectCopy;
  }, [project, sortConfig]);


  const handleGetInsights = async () => {
    setIsLoading(true);
    setAiInsight('');
    const insight = await getProjectInsights(project);
    setAiInsight(insight);
    setIsLoading(false);
  };
  
  const handleToggleExpand = (taskId: string) => {
    setExpandedTasks(prev => {
        const newSet = new Set(prev);
        if (newSet.has(taskId)) {
            newSet.delete(taskId);
        } else {
            newSet.add(taskId);
        }
        return newSet;
    });
  };

  const handleSort = (key: SortKey) => {
    setSortConfig(prevConfig => {
      if (prevConfig.key === key) {
        return {
          key,
          direction: prevConfig.direction === 'ascending' ? 'descending' : 'ascending',
        };
      }
      return { key, direction: 'ascending' };
    });
  };

  const reviveDates = (key: string, value: any) => {
    if (key === 'startDate' || key === 'endDate') {
        return new Date(value);
    }
    return value;
  };
  
  const handleSaveTask = (phaseId: string, taskName: string) => {
    if (!taskName.trim()) return;

    const newTask: Task = {
        id: `task-${Date.now()}`,
        name: taskName.trim(),
        status: TaskStatus.NotStarted,
        startDate: new Date(),
        endDate: new Date(new Date().setDate(new Date().getDate() + 7)), // Default to 1 week duration
    };
    
    const updatedProject = JSON.parse(JSON.stringify(project), reviveDates);

    const phase = updatedProject.phases.find((p: Phase) => p.id === phaseId);
    if (phase) {
        phase.tasks.push(newTask);
    }
    
    onUpdateProject(updatedProject);
    setAddingTaskToPhase(null);
  };

  const handleSaveSubtask = (parentTaskId: string, subTaskName: string) => {
    if (!subTaskName.trim()) return;

    const newSubTask: Task = {
        id: `subtask-${Date.now()}`,
        name: subTaskName.trim(),
        status: TaskStatus.NotStarted,
        startDate: new Date(),
        endDate: new Date(new Date().setDate(new Date().getDate() + 7)), // Default to 1 week duration
    };

    const updatedProject = JSON.parse(JSON.stringify(project), reviveDates);

    const findAndAdd = (tasks: Task[]): boolean => {
        for (const task of tasks) {
            if (task.id === parentTaskId) {
                task.subTasks = task.subTasks ? [...task.subTasks, newSubTask] : [newSubTask];
                return true;
            }
            if (task.subTasks && findAndAdd(task.subTasks)) {
                return true;
            }
        }
        return false;
    };
    
    updatedProject.phases.forEach((phase: Phase) => {
        findAndAdd(phase.tasks);
    });

    onUpdateProject(updatedProject);
    setAddingSubtaskTo(null);
    setExpandedTasks(prev => new Set(prev).add(parentTaskId));
  };
  
  const handleUpdateTaskField = (taskId: string, field: keyof Task, value: any) => {
    // Prevent saving if the name is empty
    if (field === 'name' && !value.trim()) {
        setEditingField(null);
        return;
    }
    const updatedProject = JSON.parse(JSON.stringify(project), reviveDates);

    const findAndUpdate = (tasks: Task[]): boolean => {
        for (const task of tasks) {
            if (task.id === taskId) {
                (task as any)[field] = value;
                return true;
            }
            if (task.subTasks && findAndUpdate(task.subTasks)) {
                return true;
            }
        }
        return false;
    };

    for (const phase of updatedProject.phases) {
        if (findAndUpdate(phase.tasks)) {
            break;
        }
    }
    
    onUpdateProject(updatedProject);
    setEditingField(null);
  };

  const handleRequestDeleteTask = (taskId: string) => {
    setTaskToDeleteId(taskId);
  };

  const handleConfirmDeleteTask = () => {
    if (!taskToDeleteId) return;

    const updatedProject = JSON.parse(JSON.stringify(project), reviveDates);

    const findAndRemove = (tasks: Task[], id: string): Task[] => {
        return tasks.filter(task => {
            if (task.id === id) {
                return false; // remove this task
            }
            if (task.subTasks) {
                task.subTasks = findAndRemove(task.subTasks, id);
            }
            return true;
        });
    };
    
    updatedProject.phases.forEach((phase: Phase) => {
        phase.tasks = findAndRemove(phase.tasks, taskToDeleteId);
    });

    onUpdateProject(updatedProject);
    setTaskToDeleteId(null);
  };


  return (
    <div className="space-y-8">
      <button onClick={onBack} className="flex items-center space-x-2 text-brand-light hover:text-white transition-colors">
        <ArrowLeftIcon className="w-5 h-5" />
        <span>Back to Projects</span>
      </button>

      <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
        <h2 className="text-3xl font-bold text-white">{project.name}</h2>
        <p className="text-slate-400 mt-2 max-w-4xl">{project.description}</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <InfoCard icon={<InfoIcon/>} title="Core System" value={project.coreSystem} />
          <InfoCard icon={<CalendarIcon/>} title="Duration" value={project.duration} />
          <InfoCard icon={<TeamIcon/>} title="Team / Size" value={`${project.team.name} / ${project.team.size}`} />
          <InfoCard icon={<MoneyIcon/>} title="Cost / Funding" value={project.cost} />
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <h3 className="font-semibold text-lg text-white">Project Timeline</h3>
          <div className="flex items-center rounded-lg bg-slate-900 p-1">
              <ViewModeButton icon={<ListBulletIcon />} label="List" isActive={viewMode === 'list'} onClick={() => setViewMode('list')} />
              <ViewModeButton icon={<ChartBarIcon />} label="Gantt" isActive={viewMode === 'gantt'} onClick={() => setViewMode('gantt')} />
          </div>
        </div>

        {viewMode === 'list' ? (
          sortedProject.phases.map(phase => (
            <div key={phase.id} className="border-b border-slate-700 last:border-b-0">
              <div className="p-4 bg-slate-800 flex justify-between items-center">
                <h4 className="font-semibold text-md text-slate-300">{phase.name} <span className="text-sm text-slate-400 font-normal ml-2">{phase.weekRange}</span></h4>
                 {canEdit && (
                    <button onClick={() => setAddingTaskToPhase(phase.id)} className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-1 px-3 rounded-lg transition-colors text-sm">
                        <PlusCircleIcon className="w-4 h-4" />
                        <span>Add Item</span>
                    </button>
                )}
              </div>
              {addingTaskToPhase === phase.id && (
                  <div className="p-4 pb-0">
                      <InlineTaskForm
                          onSave={(name) => handleSaveTask(phase.id, name)}
                          onCancel={() => setAddingTaskToPhase(null)}
                          placeholder="New task name"
                      />
                  </div>
              )}
              <div className="p-4">
                <div className="grid grid-cols-10 gap-4 text-sm mb-2 px-2" style={{ paddingLeft: '2.5rem' }}>
                  <SortableHeaderCell label="Task" sortKey="name" sortConfig={sortConfig} onSort={handleSort} className="col-span-4" />
                  <SortableHeaderCell label="Timeline" sortKey="startDate" sortConfig={sortConfig} onSort={handleSort} className="col-span-2" />
                  <SortableHeaderCell label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} className="col-span-2" />
                  <SortableHeaderCell label="Details" sortKey="deliverables" sortConfig={sortConfig} onSort={handleSort} className="col-span-2" />
                </div>
                <ul className="space-y-2">
                  {phase.tasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      level={0}
                      isExpanded={expandedTasks.has(task.id)}
                      onToggleExpand={handleToggleExpand}
                      addingSubtaskTo={addingSubtaskTo}
                      setAddingSubtaskTo={setAddingSubtaskTo}
                      canEdit={canEdit}
                      handleSaveSubtask={handleSaveSubtask}
                      editingField={editingField}
                      setEditingField={setEditingField}
                      handleUpdateTaskField={handleUpdateTaskField}
                      onRequestDelete={handleRequestDeleteTask}
                    />
                  ))}
                </ul>
              </div>
            </div>
          ))
        ) : (
          <GanttChart project={project} />
        )}
      </div>
      
      <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center">
            <h3 className="text-xl font-bold text-white mb-2 sm:mb-0">AI-Powered Analytics</h3>
            {canEdit && <button 
              onClick={handleGetInsights} 
              disabled={isLoading}
              className="bg-brand-secondary hover:bg-blue-500 disabled:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-colors disabled:cursor-not-allowed"
            >
              <SparklesIcon className="w-5 h-5 mr-2"/>
              {isLoading ? 'Analyzing...' : 'Get Insights'}
            </button>}
        </div>
        {!canEdit && <p className="text-sm text-slate-400 mt-2">You don't have permission to run AI analysis.</p>}
        {isLoading && <div className="text-center p-8 text-slate-400">Generating insights, please wait...</div>}
        {aiInsight && (
          <div className="mt-4 prose prose-invert prose-sm max-w-none text-slate-300" dangerouslySetInnerHTML={{ __html: aiInsight.replace(/\n/g, '<br />') }}>
          </div>
        )}
      </div>
      
      <ConfirmationModal
        isOpen={!!taskToDeleteId}
        onClose={() => setTaskToDeleteId(null)}
        onConfirm={handleConfirmDeleteTask}
        title="Delete Task"
        message="Are you sure you want to delete this task and all its sub-tasks? This action cannot be undone."
      />

    </div>
  );
};

interface InfoCardProps {
    icon: React.ReactElement<{ className?: string }>;
    title: string;
    value: string;
}

const InfoCard: React.FC<InfoCardProps> = ({ icon, title, value }) => (
    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex items-start space-x-4">
        <div className="bg-slate-700 p-3 rounded-lg text-brand-light">
            {React.cloneElement(icon, { className: "w-6 h-6" })}
        </div>
        <div>
            <h4 className="text-sm text-slate-400 font-medium">{title}</h4>
            <p className="text-base font-semibold text-white mt-1">{value}</p>
        </div>
    </div>
);

interface ViewModeButtonProps {
    icon: React.ReactElement<{ className?: string }>;
    label: string;
    isActive: boolean;
    onClick: () => void;
}

const ViewModeButton: React.FC<ViewModeButtonProps> = ({ icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center space-x-2 px-3 py-1 text-sm rounded-md transition-colors ${
            isActive
                ? 'bg-brand-secondary text-white'
                : 'text-slate-400 hover:bg-slate-700 hover:text-white'
        }`}
    >
        {React.cloneElement(icon, { className: "w-4 h-4" })}
        <span>{label}</span>
    </button>
);


export default ProjectDetail;