import React from 'react';
import { CheckCircleIcon, XMarkIcon } from './icons';

interface ToastProps {
  message: string;
  onClose?: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  return (
    <div 
      className="fixed bottom-5 right-5 z-50 flex items-center w-full max-w-xs p-3.5 text-white bg-green-600 rounded-lg shadow-xl animate-toast-in cursor-pointer select-none group hover:bg-green-700 transition-colors" 
      role="alert"
      onClick={onClose}
      title="Click to dismiss"
    >
      <div className="inline-flex items-center justify-center flex-shrink-0 w-7 h-7 text-green-200 bg-green-800/60 rounded-lg">
        <CheckCircleIcon className="w-4 h-4" />
      </div>
      <div className="ml-3 text-sm font-medium flex-1 mr-2 leading-snug">{message}</div>
      {onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="text-green-200 hover:text-white p-1 rounded transition-colors"
          aria-label="Close"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default Toast;

