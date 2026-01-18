import React from 'react';

interface TermsOfServiceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden border border-slate-700">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                    <h2 className="text-xl font-bold text-white">Terms of Service</h2>
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
                        <h3 className="text-lg font-semibold text-white mb-2">1. Acceptance of Terms</h3>
                        <p>
                            By accessing and using VantageFlow ("Service"), you agree to be bound by these Terms of Service.
                            If you do not agree to these terms, please do not use the Service.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">2. Description of Service</h3>
                        <p>
                            VantageFlow is a project management and visualization platform designed to help teams track progress,
                            manage tasks, and achieve their goals. The Service is provided on an invitation-only basis.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">3. User Accounts</h3>
                        <ul className="list-disc list-inside space-y-2 ml-2">
                            <li>Access to VantageFlow is by invitation only</li>
                            <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                            <li>You agree to notify us immediately of any unauthorized use of your account</li>
                            <li>You must provide accurate and complete information during registration</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">4. Acceptable Use</h3>
                        <p className="mb-2">You agree not to:</p>
                        <ul className="list-disc list-inside space-y-2 ml-2">
                            <li>Use the Service for any unlawful purpose</li>
                            <li>Attempt to gain unauthorized access to any part of the Service</li>
                            <li>Interfere with or disrupt the Service or servers</li>
                            <li>Upload malicious content or code</li>
                            <li>Share your account credentials with unauthorized parties</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">5. Intellectual Property</h3>
                        <p>
                            All content, features, and functionality of the Service are owned by VantageFlow and are protected
                            by international copyright, trademark, and other intellectual property laws. Your project data
                            remains your property.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">6. Data and Content</h3>
                        <p>
                            You retain ownership of all data and content you create within VantageFlow. By using the Service,
                            you grant us a limited license to store, process, and display your content as necessary to provide
                            the Service.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">7. Service Availability</h3>
                        <p>
                            We strive to maintain high availability but do not guarantee uninterrupted access. We may
                            temporarily suspend access for maintenance, updates, or security reasons.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">8. Limitation of Liability</h3>
                        <p>
                            VantageFlow is provided "as is" without warranties of any kind. We shall not be liable for any
                            indirect, incidental, special, or consequential damages arising from your use of the Service.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">9. Termination</h3>
                        <p>
                            We reserve the right to suspend or terminate your access to the Service at any time for violation
                            of these terms or for any other reason at our discretion.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">10. Changes to Terms</h3>
                        <p>
                            We may update these Terms of Service from time to time. We will notify users of significant changes.
                            Continued use of the Service after changes constitutes acceptance of the new terms.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-white mb-2">11. Contact</h3>
                        <p>
                            For questions about these Terms of Service, please contact your organization administrator.
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

export default TermsOfServiceModal;
