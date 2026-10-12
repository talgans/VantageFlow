import React, { useState } from 'react';
import { Task, Project, TeamMember, TaskFeedbackNote } from '../types';
import { XMarkIcon, UserIcon } from './icons';
import StatusBadge from './StatusBadge';

interface TaskFeedbackDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  project: Project;
  currentUser: TeamMember;
  onAddNote: (note: TaskFeedbackNote, notify: boolean) => void;
  onOpenImpedimentModal?: () => void;
  getUserDisplayName?: (uid: string, email?: string) => string | undefined;
  getUserPhotoURL?: (uid: string, email?: string) => string | undefined;
}

export const TaskFeedbackDrawer: React.FC<TaskFeedbackDrawerProps> = ({
  isOpen,
  onClose,
  task,
  project,
  currentUser,
  onAddNote,
  onOpenImpedimentModal,
  getUserDisplayName,
  getUserPhotoURL,
}) => {
  const [newNote, setNewNote] = useState('');
  const [notifyRecipients, setNotifyRecipients] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const notes = task.feedbackNotes || [];
  const activeImpediment = task.impediment && !task.impediment.resolved ? task.impediment : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setSubmitting(true);
    const note: TaskFeedbackNote = {
      id: `fn_${Date.now()}`,
      author: currentUser,
      message: newNote.trim(),
      createdAt: new Date(),
      type: 'general',
    };

    onAddNote(note, notifyRecipients);
    setNewNote('');
    setSubmitting(false);
  };

  const formatTime = (dateInput: Date | string) => {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl">💬</span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">
                {task.name}
              </h3>
              <p className="text-xs text-slate-400">
                Task Notes & Feedback • {project.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={task.status} />
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Active Blocker Alert (if any) */}
        {activeImpediment && (
          <div className="p-3.5 bg-red-950/30 border-b border-red-500/20 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-red-400">
                  ⚠️ Active Blocker: {activeImpediment.category}
                </span>
                <span className="text-[10px] text-slate-400">
                  by {activeImpediment.reportedBy.displayName || activeImpediment.reportedBy.email}
                </span>
              </div>
              <p className="text-xs text-slate-300 italic">
                "{activeImpediment.description}"
              </p>
            </div>
            {onOpenImpedimentModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenImpedimentModal();
                }}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white whitespace-nowrap transition-colors"
              >
                Resolve
              </button>
            )}
          </div>
        )}

        {/* Notes Timeline / History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 divide-y divide-slate-800/40">
          {notes.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto text-lg">
                📝
              </div>
              <p className="text-sm font-semibold text-slate-300">No notes or feedback yet</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Assignees and leads can post questions, progress notes, and feedback here.
              </p>
            </div>
          ) : (
            notes.map((note) => {
              const authorName =
                getUserDisplayName?.(note.author?.uid || '', note.author?.email) ||
                note.author?.displayName ||
                note.author?.email?.split('@')[0] ||
                'Team Member';
              const photo =
                getUserPhotoURL?.(note.author?.uid || '', note.author?.email) ||
                note.author?.photoURL;
              const isCurrentUser = note.author?.uid === currentUser.uid;

              return (
                <div key={note.id} className="pt-3 first:pt-0 flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-7 h-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-200 overflow-hidden flex-shrink-0 mt-0.5">
                    {photo ? (
                      <img src={photo} className="w-full h-full object-cover" alt="" />
                    ) : (
                      (authorName[0] || 'U').toUpperCase()
                    )}
                  </div>

                  {/* Bubble */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isCurrentUser ? 'text-brand-light' : 'text-slate-200'}`}>
                        {authorName} {isCurrentUser && '(You)'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {formatTime(note.createdAt)}
                      </span>
                    </div>
                    <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {note.message}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* New Note Form */}
        <form onSubmit={handleSubmit} className="p-3.5 bg-slate-800/50 border-t border-slate-800 space-y-2">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Write a note, question, or progress update..."
            rows={2}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-secondary resize-none"
          />
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-400 select-none">
              <input
                type="checkbox"
                checked={notifyRecipients}
                onChange={(e) => setNotifyRecipients(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-brand-secondary bg-slate-800 border-slate-700 focus:ring-0 focus:ring-offset-0"
              />
              <span>Notify team</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={submitting || !newNote.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-brand-secondary hover:bg-blue-600 text-white shadow-md disabled:opacity-50 transition-all"
              >
                Post Note
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
