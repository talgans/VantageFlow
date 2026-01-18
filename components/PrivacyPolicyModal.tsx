import React from 'react';

interface PrivacyPolicyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden border border-slate-700">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                    <h2 className="text-xl font-bold text-white">Privacy Policy</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors text-2xl leading-none"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 py-5 overflow-y-auto max-h-[calc(85vh-120px)] text-slate-300 space-y-6">
                    <p className="text-sm text-slate-400">Last Updated: January 18, 2026</p>

                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">1. Introduction</h3>
                        <p>
                            VantageFlow ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy
                            explains how we collect, use, and safeguard your information when you use our project management
                            platform.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">2. Information We Collect</h3>

                        <h4 className="font-medium text-slate-200 mt-3 mb-2">Account Information</h4>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>Name and email address</li>
                            <li>Profile photo (optional)</li>
                            <li>Organization affiliation</li>
                            <li>Role and permissions</li>
                        </ul>

                        <h4 className="font-medium text-slate-200 mt-3 mb-2">Project Data</h4>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>Project details and descriptions</li>
                            <li>Tasks, phases, and milestones</li>
                            <li>Team member assignments</li>
                            <li>Progress and status updates</li>
                        </ul>

                        <h4 className="font-medium text-slate-200 mt-3 mb-2">Usage Information</h4>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>Login timestamps and activity logs</li>
                            <li>Feature usage patterns</li>
                            <li>Device and browser information</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">3. How We Use Your Information</h3>
                        <p className="mb-2">We use collected information to:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>Provide and maintain the Service</li>
                            <li>Authenticate users and manage permissions</li>
                            <li>Send important notifications about your projects</li>
                            <li>Improve and optimize our platform</li>
                            <li>Ensure security and prevent unauthorized access</li>
                            <li>Generate analytics and performance insights</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">4. Data Storage and Security</h3>
                        <p>
                            Your data is stored securely using Firebase/Google Cloud infrastructure with industry-standard
                            encryption. We implement appropriate technical and organizational measures to protect your
                            information against unauthorized access, alteration, or destruction.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">5. Data Sharing</h3>
                        <p className="mb-2">We do not sell your personal information. We may share data only:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>With team members within your organization as part of Service functionality</li>
                            <li>With service providers who assist in operating our platform</li>
                            <li>When required by law or to protect our legal rights</li>
                            <li>With your explicit consent</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">6. Your Rights</h3>
                        <p className="mb-2">You have the right to:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>Access your personal data</li>
                            <li>Correct inaccurate information</li>
                            <li>Request deletion of your account and data</li>
                            <li>Export your project data</li>
                            <li>Opt out of non-essential communications</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">7. Cookies and Tracking</h3>
                        <p>
                            We use essential cookies to maintain your session and preferences. We may use analytics tools
                            to understand usage patterns and improve the Service. You can manage cookie preferences through
                            your browser settings.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">8. Data Retention</h3>
                        <p>
                            We retain your data for as long as your account is active or as needed to provide the Service.
                            Upon account deletion, we will remove your personal data within 30 days, except where retention
                            is required for legal purposes.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">9. Children's Privacy</h3>
                        <p>
                            VantageFlow is not intended for users under 16 years of age. We do not knowingly collect
                            information from children.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">10. Changes to This Policy</h3>
                        <p>
                            We may update this Privacy Policy periodically. We will notify you of significant changes
                            via email or through the Service.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">11. Contact Us</h3>
                        <p>
                            For privacy-related questions or to exercise your rights, please contact your organization
                            administrator.
                        </p>
                    </section>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-700">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicyModal;
