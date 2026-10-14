import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Task, Project, TeamMember, TaskFeedbackNote } from '../types';
import { XMarkIcon, UserIcon } from './icons';
import StatusBadge from './StatusBadge';

interface TaskFeedbackDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  project: Project;
  currentUser: TeamMember;
  onAddNote: (note: TaskFeedbackNote, notify: boolean, mentionedMembers?: TeamMember[]) => void;
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

  // Mention State
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionPosition, setMentionPosition] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionMenuRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const notes = task.feedbackNotes || [];
  const activeImpediment = task.impediment && !task.impediment.resolved ? task.impediment : null;

  // Filter available team members for mention suggestions
  const eligibleMembers = useMemo(() => {
    const list = (project.team?.members || []).filter(
      m => !m.isFormerMember && m.uid !== currentUser.uid
    );
    if (!mentionQuery) return list;
    const q = mentionQuery.toLowerCase();
    return list.filter(m => {
      const name = getUserDisplayName?.(m.uid, m.email) || m.displayName || m.email?.split('@')[0] || '';
      return name.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
    });
  }, [project.team?.members, currentUser.uid, mentionQuery, getUserDisplayName]);

  // Handle textarea text change and detect @ symbol
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const cursorPos = e.target.selectionStart;
    setNewNote(text);

    // Look back from cursor to find if we are in an @mention
    const textBeforeCursor = text.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_\.\s]{0,25})$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setMentionPosition(cursorPos - mentionMatch[1].length - 1);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
      setMentionPosition(null);
    }
  };

  // Insert selected mention into textarea
  const insertMention = (member: TeamMember) => {
    if (!textareaRef.current) return;
    const name = getUserDisplayName?.(member.uid, member.email) || member.displayName || member.email.split('@')[0];
    const mentionTag = `@${name} `;

    let updatedText = newNote;
    let newCursorPos = 0;

    if (mentionPosition !== null) {
      const cursorPos = textareaRef.current.selectionStart;
      const before = newNote.slice(0, mentionPosition);
      const after = newNote.slice(cursorPos);
      updatedText = `${before}${mentionTag}${after}`;
      newCursorPos = before.length + mentionTag.length;
    } else {
      updatedText = `${newNote}${mentionTag}`;
      newCursorPos = updatedText.length;
    }

    setNewNote(updatedText);
    setMentionQuery(null);
    setMentionPosition(null);

    // Refocus textarea and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  // Keyboard navigation for mention suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && eligibleMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % eligibleMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + eligibleMembers.length) % eligibleMembers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(eligibleMembers[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || submitting) return;

    setSubmitting(true);

    // Identify mentioned members
    const mentionedMembers = (project.team?.members || []).filter(m => {
      if (m.uid === currentUser.uid) return false;
      const name = getUserDisplayName?.(m.uid, m.email) || m.displayName || m.email?.split('@')[0];
      if (!name) return false;
      return (
        newNote.toLowerCase().includes(`@${name.toLowerCase()}`) ||
        (m.email && newNote.toLowerCase().includes(`@${m.email.toLowerCase()}`))
      );
    });

    const note: TaskFeedbackNote = {
      id: `fn_${Date.now()}`,
      author: currentUser,
      message: newNote.trim(),
      createdAt: new Date(),
      type: mentionedMembers.length > 0 ? 'mention' : 'general',
      mentionedUids: mentionedMembers.map(m => m.uid),
      mentionedNames: mentionedMembers.map(
        m => getUserDisplayName?.(m.uid, m.email) || m.displayName || m.email.split('@')[0]
      ),
    };

    onAddNote(note, notifyRecipients, mentionedMembers);
    setNewNote('');
    setMentionQuery(null);
    setSubmitting(false);
    onClose();
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

  // Helper to render message with styled @mentions
  const renderMessageWithMentions = (message: string) => {
    const parts = message.split(/(@[A-Za-z0-9_\.\-\s]+?(?=\s@|\s[,\.\!\?]|\s*$|[,\.\!\?]))/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={i}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-brand-light bg-brand-secondary/25 font-semibold border border-brand-secondary/40 text-[11px] shadow-xs"
          >
            {part}
          </span>
        );
      }
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
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
                Assignees and leads can post questions, progress notes, and feedback here. Use <span className="text-brand-light font-semibold">@</span> to mention a teammate.
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
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${isCurrentUser ? 'text-brand-light' : 'text-slate-200'}`}>
                          {authorName} {isCurrentUser && '(You)'}
                        </span>
                        {note.type === 'mention' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                            Direct @Mention
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {formatTime(note.createdAt)}
                      </span>
                    </div>
                    <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {renderMessageWithMentions(note.message)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* New Note Form */}
        <form onSubmit={handleSubmit} className="p-3.5 bg-slate-800/50 border-t border-slate-800 space-y-2 relative">
          {/* @ Mention Autocomplete Popover */}
          {mentionQuery !== null && eligibleMembers.length > 0 && (
            <div
              ref={mentionMenuRef}
              className="absolute bottom-full left-3 right-3 mb-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-20 max-h-48 overflow-y-auto"
            >
              <div className="px-3 py-1.5 border-b border-slate-700/70 bg-slate-900/60 flex items-center justify-between text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                <span>👥 Mention Team Member</span>
                <span className="text-[10px] lowercase text-slate-500 font-normal">↑↓ to navigate • enter to select</span>
              </div>
              <ul className="divide-y divide-slate-700/40">
                {eligibleMembers.map((member, idx) => {
                  const mName = getUserDisplayName?.(member.uid, member.email) || member.displayName || member.email.split('@')[0];
                  const mPhoto = getUserPhotoURL?.(member.uid, member.email) || member.photoURL;
                  const isSelected = idx === mentionIndex;

                  return (
                    <li
                      key={member.uid || member.email}
                      onClick={() => insertMention(member)}
                      onMouseEnter={() => setMentionIndex(idx)}
                      className={`px-3 py-2 flex items-center gap-2.5 cursor-pointer transition-colors ${
                        isSelected ? 'bg-brand-secondary/30 text-white' : 'hover:bg-slate-700/40 text-slate-300'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-[10px] font-bold overflow-hidden flex-shrink-0">
                        {mPhoto ? (
                          <img src={mPhoto} className="w-full h-full object-cover" alt="" />
                        ) : (
                          (mName[0] || 'U').toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">{mName}</span>
                          {member.leadRole && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase font-semibold">
                              {member.leadRole}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">{member.email}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={newNote}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Write a note, question, or type @ to mention a team member..."
              rows={2}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-secondary resize-none"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-400 select-none">
                <input
                  type="checkbox"
                  checked={notifyRecipients}
                  onChange={(e) => setNotifyRecipients(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-brand-secondary bg-slate-800 border-slate-700 focus:ring-0 focus:ring-offset-0"
                />
                <span>Notify team</span>
              </label>

              {/* Quick @ trigger button */}
              <button
                type="button"
                onClick={() => {
                  setMentionQuery('');
                  setMentionPosition(newNote.length);
                  setNewNote(prev => (prev.endsWith(' ') || prev.length === 0 ? `${prev}@` : `${prev} @`));
                  textareaRef.current?.focus();
                }}
                className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-brand-light border border-slate-700 transition-colors flex items-center gap-1"
                title="Mention a team member"
              >
                <span>@</span>
                <span>Mention</span>
              </button>
            </div>

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

