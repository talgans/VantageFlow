import React, { useState } from 'react';
import { Task, Project, TeamMember } from '../types';
import { XMarkIcon, CheckCircleIcon } from './icons';

interface TaskCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  project: Project;
  currentUser: TeamMember;
  onConfirmComplete: (notify: boolean) => void;
}

export const TaskCompletionModal: React.FC<TaskCompletionModalProps> = ({
  isOpen,
  onClose,
  task,
  project,
  currentUser,
  onConfirmComplete,
}) => {
  const [notifyRecipients, setNotifyRecipients] = useState(true);

  if (!isOpen) return null;

  const deliverablesCount = task.deliverables?.length || 0;

  const handleConfirm = () => {
    onConfirmComplete(notifyRecipients);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b border-emerald-500/20 bg-emerald-950/25">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <h3 className="text-lg font-bold text-white leading-snug">
                Mark Task 100% Complete?
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                {task.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-300">
            You are marking <strong className="text-white">"{task.name}"</strong> as fully complete.
          </p>

          {deliverablesCount > 0 && (
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <span>Deliverables Scope</span>
                <span className="text-emerald-400 font-bold">{deliverablesCount} Total</span>
              </div>
              <ul className="space-y-1 text-xs text-slate-300">
                {task.deliverables?.map((d, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span className="truncate">{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gamification Reminder */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-center gap-2.5 text-xs text-blue-300">
            <span className="text-base">⭐</span>
            <span>Completing this task will award <strong>10 points</strong> to all assigned team members.</span>
          </div>

          {/* Notification Checkbox */}
          <div className="pt-2 border-t border-slate-800">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300 select-none">
              <input
                type="checkbox"
                checked={notifyRecipients}
                onChange={(e) => setNotifyRecipients(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-brand-secondary bg-slate-800 border-slate-700 focus:ring-0 focus:ring-offset-0"
              />
              <span>
                <strong>Send completion report</strong> to task assigner and project leads via <strong>email & in-app notification</strong>
              </span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-800/50 border-t border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-1.5"
          >
            <CheckCircleIcon className="w-4 h-4" />
            <span>Mark Complete {notifyRecipients ? '& Notify' : ''}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
