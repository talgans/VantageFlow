import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { signInWithCustomToken } from 'firebase/auth';
import { auth, app } from '../services/firebaseConfig';
import { ShieldCheckIcon, CheckIcon, XMarkIcon } from './icons';

interface AccountSetupModalProps {
  token: string;
  initialEmail?: string;
  isOpen: boolean;
  onClose: () => void;
  showToast: (message: string) => void;
  onSuccess?: () => void;
}

interface ValidateTokenResponse {
  valid: boolean;
  email?: string;
  role?: string;
  expiresAt?: string;
  reason?: string;
  message?: string;
}

interface CompleteSetupResponse {
  success: boolean;
  message: string;
  customToken: string;
  email: string;
  role: string;
}

const AccountSetupModal: React.FC<AccountSetupModalProps> = ({
  token,
  initialEmail,
  isOpen,
  onClose,
  showToast,
  onSuccess,
}) => {
  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [email, setEmail] = useState(initialEmail || '');
  const [role, setRole] = useState<string>('member');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Validate token on mount
  useEffect(() => {
    if (!token || !isOpen) return;

    let isMounted = true;
    const validate = async () => {
      setIsValidating(true);
      setValidationError(null);

      try {
        const functions = getFunctions(app, 'us-central1');
        const validateFn = httpsCallable<{ token: string }, ValidateTokenResponse>(functions, 'validateInviteToken');
        const result = await validateFn({ token });

        if (!isMounted) return;

        if (result.data.valid) {
          if (result.data.email) setEmail(result.data.email);
          if (result.data.role) setRole(result.data.role);
          if (result.data.expiresAt) setExpiresAt(result.data.expiresAt);
          // Set initial display name default from email prefix
          const defaultName = result.data.email?.split('@')[0] || '';
          setDisplayName(defaultName.charAt(0).toUpperCase() + defaultName.slice(1));
        } else {
          setValidationError(result.data.message || 'Invitation link is invalid or expired.');
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Error validating invitation token:', err);
        setValidationError(err.message || 'Failed to validate invitation link. Please check your internet connection.');
      } finally {
        if (isMounted) setIsValidating(false);
      }
    };

    validate();
    return () => {
      isMounted = false;
    };
  }, [token, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (password.length < 6) {
      setSubmitError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      const functions = getFunctions(app, 'us-central1');
      const completeFn = httpsCallable<
        { token: string; password: string; displayName?: string },
        CompleteSetupResponse
      >(functions, 'completeAccountSetup');

      const result = await completeFn({
        token,
        password,
        displayName: displayName.trim() || undefined,
      });

      if (result.data.success && result.data.customToken) {
        // Automatically sign in the user immediately
        await signInWithCustomToken(auth, result.data.customToken);

        // Remove token from URL so it doesn't linger in address bar
        const url = new URL(window.location.href);
        url.searchParams.delete('setupToken');
        url.searchParams.delete('email');
        window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));

        showToast(`Welcome to VantageFlow, ${displayName || email}! Your account is ready.`);
        onSuccess?.();
        onClose();
      } else {
        throw new Error(result.data.message || 'Account setup could not be completed.');
      }
    } catch (err: any) {
      console.error('Account setup error:', err);
      const msg = err.message || 'Failed to complete account setup. Please try again.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatRoleLabel = (r: string) => {
    const lower = r.toLowerCase();
    if (lower === 'superadmin') return 'Super Administrator';
    if (lower === 'admin') return 'Administrator';
    if (lower === 'manager') return 'Project Manager';
    return 'Team Member';
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-slate-800 rounded-2xl max-w-md w-full border border-slate-700 shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="p-6 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-secondary/20 border border-brand-secondary/40 flex items-center justify-center text-brand-light">
              <ShieldCheckIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Complete Account Setup</h2>
              <p className="text-xs text-slate-400">VantageFlow Project Platform</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-700/50"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {isValidating ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-2 border-brand-secondary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-slate-300">Validating 48-hour invitation link...</p>
            </div>
          ) : validationError ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm space-y-2">
                <div className="flex items-center gap-2 font-semibold text-red-200">
                  <XMarkIcon className="w-5 h-5 flex-shrink-0 text-red-400" />
                  <span>Invitation Link Inactive</span>
                </div>
                <p className="text-xs text-red-300/90 leading-relaxed">{validationError}</p>
              </div>

              <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-700 text-xs text-slate-400 space-y-1">
                <p className="font-medium text-slate-300">Need access?</p>
                <p>Contact your project administrator to request a fresh invitation or reminder link.</p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium text-sm transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Account Info Pill */}
              <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-700/80 flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <div className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">Account</div>
                  <div className="text-sm font-medium text-slate-200 truncate" title={email}>{email}</div>
                </div>
                <span className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30 flex-shrink-0">
                  {formatRoleLabel(role)}
                </span>
              </div>

              {/* 48-Hour Notice */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                <span className="font-semibold">⏳ 48-Hour Security Link:</span>
                <span>Active link valid for your initial account setup.</span>
              </div>

              {/* Display Name Input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary text-white text-sm rounded-xl px-3.5 py-2.5 outline-none transition-colors"
                />
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  New Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary text-white text-sm rounded-xl px-3.5 py-2.5 pr-10 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Confirm Password <span className="text-red-400">*</span>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  minLength={6}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary text-white text-sm rounded-xl px-3.5 py-2.5 outline-none transition-colors"
                />
                {password && confirmPassword && (
                  <div className="mt-1 text-[11px] flex items-center gap-1.5">
                    {password === confirmPassword ? (
                      <span className="text-green-400 flex items-center gap-1">
                        <CheckIcon className="w-3.5 h-3.5" /> Passwords match
                      </span>
                    ) : (
                      <span className="text-red-400">Passwords do not match</span>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Error */}
              {submitError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                  {submitError}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !password || password !== confirmPassword}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-brand-secondary hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all shadow-lg shadow-brand-secondary/20 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Completing Setup...</span>
                  </>
                ) : (
                  <span>Set Password & Sign In</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountSetupModal;
