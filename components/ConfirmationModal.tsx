import React, { useState, useEffect } from 'react';
import { XMarkIcon } from './icons';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary' | 'warning';
  isLoading?: boolean;
  loadingText?: string;
  requireTextConfirmation?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger',
  isLoading = false,
  loadingText,
  requireTextConfirmation,
}) => {
  const [typedConfirmation, setTypedConfirmation] = useState('');

  // Reset typed confirmation whenever modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setTypedConfirmation('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isLoading) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const isConfirmed = requireTextConfirmation
    ? typedConfirmation.trim().toUpperCase() === requireTextConfirmation.trim().toUpperCase()
    : true;

  const variantStyles = {
    danger: {
      border: 'border-red-500/40',
      badgeBg: 'bg-red-500/20 text-red-400',
      btn: 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 disabled:opacity-40 disabled:cursor-not-allowed',
      icon: (
        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      ),
    },
    warning: {
      border: 'border-amber-500/40',
      badgeBg: 'bg-amber-500/20 text-amber-400',
      btn: 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20 disabled:opacity-40 disabled:cursor-not-allowed',
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
    primary: {
      border: 'border-blue-500/30',
      badgeBg: 'bg-blue-500/20 text-blue-400',
      btn: 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed',
      icon: (
        <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  }[confirmVariant];

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fadeIn"
      onClick={isLoading ? undefined : onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`bg-slate-800 rounded-xl border ${variantStyles.border} w-full max-w-md shadow-2xl overflow-hidden animate-scaleIn`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${variantStyles.badgeBg}`}>
              {variantStyles.icon}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white leading-snug">{title}</h2>
                {!isLoading && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/60 transition-colors -mr-2 -mt-1"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="mt-2 text-sm text-slate-300 leading-relaxed break-words">{message}</div>

              {requireTextConfirmation && (
                <div className="mt-4 pt-3 border-t border-slate-700/60">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Type <span className="font-mono text-white bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 font-bold">{requireTextConfirmation}</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={typedConfirmation}
                    onChange={(e) => setTypedConfirmation(e.target.value)}
                    placeholder={requireTextConfirmation}
                    disabled={isLoading}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 font-mono focus:ring-2 focus:ring-brand-secondary focus:border-transparent uppercase"
                    autoFocus
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end items-center px-6 py-3.5 bg-slate-900/60 border-t border-slate-700/80 space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700/80 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading || !isConfirmed}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${variantStyles.btn}`}
          >
            {isLoading && (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            )}
            <span>{isLoading ? (loadingText || 'Processing...') : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
