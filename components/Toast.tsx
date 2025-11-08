import React from 'react';
import { CheckCircleIcon } from './icons';

interface ToastProps {
  message: string;
}

const Toast: React.FC<ToastProps> = ({ message }) => {
  return (
    <div 
      className="fixed bottom-5 right-5 z-50 flex items-center w-full max-w-xs p-4 text-white bg-green-600 rounded-lg shadow-lg animate-toast-in" 
      role="alert"
    >
      <div className="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 text-green-200 bg-green-700 rounded-lg">
        <CheckCircleIcon className="w-5 h-5" />
      </div>
      <div className="ml-3 text-sm font-normal">{message}</div>
    </div>
  );
};

export default Toast;
