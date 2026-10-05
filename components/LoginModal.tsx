import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasInviteToken?: boolean;
  onOpenSetup?: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  hasInviteToken,
  onOpenSetup,
}) => {
  const { signIn, error: authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      await signIn(email, password);
      onClose();
    } catch (err: any) {
      // Firebase error messages
      const errorMessage = err.message || 'Authentication failed';
      if (
        errorMessage.includes('invalid-credential') ||
        errorMessage.includes('wrong-password') ||
        errorMessage.includes('user-not-found')
      ) {
        setError(
          'Invalid email or password. VantageFlow is invite-only — if you received an email invitation, please use the setup link in your invitation email to complete your account setup.'
        );
      } else if (errorMessage.includes('email-already-in-use')) {
        setError(
          'An account with this email already exists. If you were invited, please use the link in your invitation email to set your password.'
        );
      } else if (errorMessage.includes('invalid-email')) {
        setError('Invalid email address');
      } else if (errorMessage.includes('too-many-requests')) {
        setError('Too many failed login attempts. Please try again later or reset your password.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl max-w-md w-full border border-slate-700 shadow-2xl">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Sign In</h2>
              <p className="text-xs text-slate-400 mt-0.5">VantageFlow Project Platform</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {hasInviteToken && onOpenSetup && (
            <div className="mb-4 p-3 bg-blue-500/15 border border-blue-500/40 rounded-xl flex items-center justify-between gap-3">
              <div className="text-xs text-blue-200">
                <span className="font-semibold text-white">Have an invitation?</span> Complete your new account setup.
              </div>
              <button
                type="button"
                onClick={onOpenSetup}
                className="text-xs font-semibold text-white bg-brand-secondary hover:bg-blue-500 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
              >
                Sign Up
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:border-transparent"
                placeholder="you@example.com"
                disabled={loading}
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:border-transparent"
                placeholder="••••••••"
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            {(error || authError) && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                <p className="text-red-400 text-xs leading-relaxed">{error || authError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-secondary hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            {hasInviteToken && onOpenSetup ? (
              <p>
                New user with an invitation?{' '}
                <button
                  type="button"
                  onClick={onOpenSetup}
                  className="text-brand-light hover:text-white underline font-semibold transition-colors"
                >
                  Complete Sign Up
                </button>
              </p>
            ) : (
              <p className="text-slate-400">
                VantageFlow is invite-only. If you haven't received an invitation, please contact your administrator.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
