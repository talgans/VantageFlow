import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const RoleChangeNotification: React.FC = () => {
    const { pendingLogout, acknowledgePendingLogout, signOut } = useAuth();
    const [countdown, setCountdown] = useState(60);

    useEffect(() => {
        if (!pendingLogout) {
            setCountdown(60);
            return;
        }

        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    // Auto logout when countdown reaches 0
                    handleLogoutNow();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [pendingLogout]);

    const handleLogoutNow = async () => {
        await acknowledgePendingLogout();
        await signOut();
    };

    if (!pendingLogout) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
            <div className="bg-slate-800 rounded-xl border border-amber-500/50 max-w-md w-full p-6 shadow-2xl animate-pulse-subtle">
                {/* Warning Icon */}
                <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center">
                        <svg
                            className="w-10 h-10 text-amber-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                </div>

                {/* Title */}
                <h2 className="text-xl font-bold text-white text-center mb-2">
                    Role Changed
                </h2>

                {/* Message */}
                <p className="text-slate-300 text-center mb-4">
                    {pendingLogout.message}
                </p>

                {/* Role Change Display */}
                <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-center space-x-4">
                        <div className="text-center">
                            <span className="text-xs text-slate-500 uppercase">Previous</span>
                            <p className="text-slate-400 font-medium capitalize">
                                {pendingLogout.previousRole}
                            </p>
                        </div>
                        <svg
                            className="w-6 h-6 text-amber-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 7l5 5m0 0l-5 5m5-5H6"
                            />
                        </svg>
                        <div className="text-center">
                            <span className="text-xs text-slate-500 uppercase">New</span>
                            <p className="text-white font-medium capitalize">
                                {pendingLogout.newRole}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Countdown */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-4 border-amber-500/30 bg-slate-900/50">
                        <span className="text-3xl font-bold text-amber-500">{countdown}</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-2">
                        seconds until automatic logout
                    </p>
                </div>

                {/* Actions */}
                <button
                    onClick={handleLogoutNow}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                    Log Out Now
                </button>
            </div>
        </div>
    );
};

export default RoleChangeNotification;
