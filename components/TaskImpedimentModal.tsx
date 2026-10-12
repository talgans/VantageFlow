import React, { useState } from 'react';
import { Task, Project, TeamMember, TaskStatus, TaskImpediment } from '../types';
import { XMarkIcon } from './icons';

interface TaskImpedimentModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  project: Project;
  currentUser: TeamMember;
  onSaveImpediment: (impediment: TaskImpediment, notify: boolean) => void;
  onResolveImpediment?: (resolutionNote: string, newStatus: TaskStatus, notify: boolean) => void;
}

const CATEGORIES: { id: TaskImpediment['category']; label: string; icon: string; desc: string }[] = [
  { id: 'dependency', label: 'Dependency', icon: '🔗', desc: 'Blocked by another task, team, or third party' },
  { id: 'resources', label: 'Missing Resources/Access', icon: '🔑', desc: 'Need credentials, assets, environment access' },
  { id: 'requirements', label: 'Requirements / Scope', icon: '📋', desc: 'Unclear specifications, design changes needed' },
  { id: 'technical', label: 'Technical Roadblock', icon: '⚡', desc: 'Bugs, build errors, performance hurdles' },
  { id: 'other', label: 'Other Blocker', icon: '⚠️', desc: 'Unforeseen roadblock or external delay' },
];

export const TaskImpedimentModal: React.FC<TaskImpedimentModalProps> = ({
  isOpen,
  onClose,
  task,
  project,
  currentUser,
  onSaveImpediment,
  onResolveImpediment,
}) => {
  const existingImpediment = task.impediment && !task.impediment.resolved ? task.impediment : null;
  const isResolving = Boolean(existingImpediment);

  const [category, setCategory] = useState<TaskImpediment['category']>(
    existingImpediment?.category || 'dependency'
  );
  const [description, setDescription] = useState(existingImpediment?.description || '');
  const [resolutionNote, setResolutionNote] = useState('');
  const [newStatus, setNewStatus] = useState<TaskStatus>(TaskStatus.Fifty);
  const [notifyRecipients, setNotifyRecipients] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (isResolving && onResolveImpediment) {
      onResolveImpediment(resolutionNote, newStatus, notifyRecipients);
    } else {
      const newImpediment: TaskImpediment = {
        id: `imp_${Date.now()}`,
        category,
        description: description.trim(),
        reportedBy: currentUser,
        reportedAt: new Date(),
        resolved: false,
      };
      onSaveImpediment(newImpediment, notifyRecipients);
    }

    setSubmitting(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-5 flex items-center justify-between border-b ${
          isResolving ? 'border-emerald-500/20 bg-emerald-950/20' : 'border-red-500/20 bg-red-950/20'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{isResolving ? '✅' : '⚠️'}</span>
            <div>
              <h3 className="text-lg font-bold text-white leading-snug">
                {isResolving ? 'Resolve Task Impediment' : 'Report Task Impediment / Blocker'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                {task.name} • {project.name}
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

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {isResolving ? (
            <>
              {/* Existing Blocker Summary */}
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold text-red-400 tracking-wider">
                    Current Blocker ({existingImpediment?.category})
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Reported by {existingImpediment?.reportedBy?.displayName || existingImpediment?.reportedBy?.email}
                  </span>
                </div>
                <p className="text-sm text-slate-200 italic">
                  "{existingImpediment?.description}"
                </p>
              </div>

              {/* Resolution Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Resolution Details & Actions Taken
                </label>
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="e.g., Access credentials granted, API schema aligned with backend team..."
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                />
              </div>

              {/* Target Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Restore Task Status To:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[TaskStatus.TwentyFive, TaskStatus.Fifty, TaskStatus.SeventyFive, TaskStatus.Hundred].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setNewStatus(st)}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                        newStatus === st
                          ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Category Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Blocker Category
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                        category === cat.id
                          ? 'bg-red-500/15 border-red-500 text-white ring-1 ring-red-500'
                          : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-base">{cat.icon}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold leading-snug">{cat.label}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-1">{cat.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Explain the Impediment / What is Needed to Unblock?
                </label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Blocked waiting for security audit sign-off; cannot deploy to staging without approved certs."
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
                />
              </div>
            </>
          )}

          {/* Notification Checkbox */}
          <div className="pt-2 border-t border-slate-800">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300 select-none">
              <input
                type="checkbox"
                checked={notifyRecipients}
                onChange={(e) => setNotifyRecipients(e.target.checked)}
                className="w-4 h-4 rounded text-brand-secondary bg-slate-800 border-slate-700 focus:ring-0 focus:ring-offset-0"
              />
              <span>
                Notify task assigner & project leads via <strong>email & in-app alert</strong>
              </span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (!isResolving && !description.trim())}
              className={`px-5 py-2 rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-1.5 ${
                isResolving
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                  : 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/30'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isResolving ? 'Resolve & Clear Blocker' : 'Flag Blocker (At Risk)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
