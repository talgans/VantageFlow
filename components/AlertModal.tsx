import React, { useEffect } from 'react';
import { InfoIcon, CheckCircleIcon, XMarkIcon } from './icons';

export interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: React.ReactNode;
  type?: 'info' | 'warning' | 'error' | 'success';
  confirmText?: string;
}

const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const defaultTitles: Record<string, string> = {
    info: 'Information',
    warning: 'Attention',
    error: 'Error',
    success: 'Success',
  };

  const displayTitle = title || defaultTitles[type] || 'Notification';

  const typeConfig = {
    info: {
      border: 'border-blue-500/30',
      badgeBg: 'bg-blue-500/20 text-blue-400',
      btnBg: 'bg-blue-600 hover:bg-blue-500 text-white',
      icon: <InfoIcon className="w-6 h-6 text-blue-400" />,
    },
    warning: {
      border: 'border-amber-500/40',
      badgeBg: 'bg-amber-500/20 text-amber-400',
      btnBg: 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20',
      icon: (
        <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
    },
    error: {
      border: 'border-red-500/40',
      badgeBg: 'bg-red-500/20 text-red-400',
      btnBg: 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20',
      icon: (
        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    success: {
      border: 'border-emerald-500/30',
      badgeBg: 'bg-emerald-500/20 text-emerald-400',
      btnBg: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20',
      icon: <CheckCircleIcon className="w-6 h-6 text-emerald-400" />,
    },
  }[type];

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fadeIn"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`bg-slate-800 rounded-xl border ${typeConfig.border} w-full max-w-md shadow-2xl overflow-hidden animate-scaleIn`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${typeConfig.badgeBg}`}>
              {typeConfig.icon}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white leading-snug">{displayTitle}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/60 transition-colors -mr-2 -mt-1"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-2 text-sm text-slate-300 leading-relaxed break-words">{message}</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end items-center px-6 py-3.5 bg-slate-900/60 border-t border-slate-700/80">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${typeConfig.btnBg}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;

