import React, { useState } from 'react';
import { Project } from '../types';

export interface DeleteProjectModalProps {
  isOpen: boolean;
  project: Project | null;
  /**
   * 'soft' means user clicked delete from active list (offer Archive, Move to Trash, or Permanent Delete)
   * 'permanent' means user clicked delete from Trash (strict typed permanent deletion)
   */
  initialMode?: 'soft' | 'permanent';
  onClose: () => void;
  onMoveToTrash: (project: Project) => void;
  onArchive: (project: Project) => void;
  onPermanentDelete: (project: Project) => void;
  canPermanentDelete?: boolean;
}

const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({
  isOpen,
  project,
  initialMode = 'soft',
  onClose,
  onMoveToTrash,
  onArchive,
  onPermanentDelete,
  canPermanentDelete = true,
}) => {
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [isPermanentMode, setIsPermanentMode] = useState(initialMode === 'permanent');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when project changes or modal opens
  React.useEffect(() => {
    setTypedConfirmation('');
    setIsPermanentMode(initialMode === 'permanent');
    setIsSubmitting(false);
  }, [project, initialMode, isOpen]);

  if (!isOpen || !project) return null;

  const totalPhases = project.phases?.length || 0;
  const totalTasks = project.phases?.reduce((acc, p) => acc + (p.tasks?.length || 0), 0) || 0;
  const totalMembers = project.team?.members?.length || 0;

  const isTypedMatch = typedConfirmation.trim() === project.name.trim();

  const handleArchiveClick = () => {
    setIsSubmitting(true);
    onArchive(project);
    onClose();
  };

  const handleTrashClick = () => {
    setIsSubmitting(true);
    onMoveToTrash(project);
    onClose();
  };

  const handlePermanentDeleteClick = () => {
    if (!isTypedMatch) return;
    setIsSubmitting(true);
    onPermanentDelete(project);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4 overflow-y-auto"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl flex-shrink-0 ${isPermanentMode ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-grow">
              <h2 className="text-xl font-bold text-white">
                {isPermanentMode ? 'Permanently Delete Project' : 'Delete Project'}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Project: <span className="font-semibold text-white">{project.name}</span>
              </p>
            </div>
          </div>

          {/* Project Impact Badges */}
          <div className="grid grid-cols-3 gap-2 mt-4 bg-slate-800/40 p-3 rounded-xl border border-slate-800 text-xs text-center">
            <div>
              <div className="text-slate-400">Phases</div>
              <div className="font-bold text-white text-sm mt-0.5">{totalPhases}</div>
            </div>
            <div>
              <div className="text-slate-400">Tasks</div>
              <div className="font-bold text-white text-sm mt-0.5">{totalTasks}</div>
            </div>
            <div>
              <div className="text-slate-400">Team Members</div>
              <div className="font-bold text-white text-sm mt-0.5">{totalMembers}</div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {!isPermanentMode ? (
            /* SOFT DELETE / ARCHIVE OPTIONS */
            <>
              {/* Recommended: Archive Option */}
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📦</span>
                    <h3 className="font-semibold text-white text-sm">Archive Project</h3>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  Hides the project from active workflows while keeping all tasks, deliverables, and team performance metrics safely preserved and searchable.
                </p>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleArchiveClick}
                    disabled={isSubmitting}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm"
                  >
                    Archive Instead
                  </button>
                </div>
              </div>

              {/* Move to Trash Option */}
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80">
                <div className="flex items-center gap-2">
                  <span className="text-base">🗑️</span>
                  <h3 className="font-semibold text-white text-sm">Move to Trash</h3>
                </div>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  Moves this project to the <strong>Trash</strong> tab. The project will be hidden from dashboard views, but you can restore it anytime with a single click.
                </p>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleTrashClick}
                    disabled={isSubmitting}
                    className="px-3.5 py-1.5 text-xs font-semibold text-amber-200 bg-amber-600/80 hover:bg-amber-600 rounded-lg transition-colors shadow-sm"
                  >
                    Move to Trash
                  </button>
                </div>
              </div>

              {/* Permanent Deletion Accordion / Toggle for Owners/Admins */}
              {canPermanentDelete && (
                <div className="pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setIsPermanentMode(true)}
                    className="text-xs text-red-400 hover:text-red-300 underline underline-offset-4 flex items-center gap-1.5 transition-colors"
                  >
                    <span>Need to permanently delete this project immediately?</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </>
          ) : (
            /* STRICT PERMANENT DELETION MODE */
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 leading-relaxed">
                <strong className="block text-red-300 font-semibold mb-1">
                  ⚠️ Irreversible Action
                </strong>
                This will permanently delete <strong className="text-white">{project.name}</strong> from Firestore. All phases, tasks, subtasks, deliverables, and attachments will be permanently destroyed and cannot be recovered.
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  To confirm permanent deletion, type the exact project name below:
                </label>
                <div className="p-2 mb-2 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 select-all">
                  {project.name}
                </div>
                <input
                  type="text"
                  value={typedConfirmation}
                  onChange={(e) => setTypedConfirmation(e.target.value)}
                  placeholder="Type project name here"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  autoFocus
                />
              </div>

              {initialMode === 'soft' && (
                <button
                  type="button"
                  onClick={() => setIsPermanentMode(false)}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Back to safe options (Archive / Move to Trash)</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center p-4 bg-slate-950/80 border-t border-slate-800 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>

          {isPermanentMode && (
            <button
              type="button"
              onClick={handlePermanentDeleteClick}
              disabled={!isTypedMatch || isSubmitting}
              className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-all flex items-center gap-1.5 ${
                isTypedMatch && !isSubmitting
                  ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/30 cursor-pointer'
                  : 'bg-red-950/40 text-red-400/40 border border-red-900/30 cursor-not-allowed'
              }`}
            >
              <span>Permanently Delete</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeleteProjectModal;
