import React from 'react';
import { Project } from '../../types';
import { generateRecommendations } from '../../utils/dashboardAnalytics';
import { LightBulbIcon, ExclamationTriangleIcon, ChatBubbleBottomCenterTextIcon } from '../icons';

interface RecommendationsPanelProps {
    projects: Project[];
}

const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({ projects }) => {
    const recommendations = generateRecommendations(projects);

    if (recommendations.length === 0) {
        return (
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 flex flex-col items-center justify-center h-full">
                <div className="p-3 bg-emerald-500/10 rounded-full mb-3">
                    <LightBulbIcon className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-slate-400 text-center">Everything looks good! No recommendations at this time.</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b border-slate-700 bg-slate-800/80">
                <div className="flex items-center gap-2">
                    <LightBulbIcon className="w-5 h-5 text-amber-400" />
                    <h3 className="font-semibold text-slate-200">Recommendations & Insights</h3>
                </div>
            </div>
            <div className="overflow-y-auto p-4 space-y-3 flex-grow max-h-[300px] custom-scrollbar">
                {recommendations.map(rec => (
                    <div
                        key={rec.id}
                        className={`p-3 rounded-lg border flex items-start gap-3 transition-colors ${rec.type === 'warning'
                                ? 'bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10'
                                : 'bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10'
                            }`}
                    >
                        {rec.type === 'warning' ? (
                            <ExclamationTriangleIcon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                        ) : (
                            <ChatBubbleBottomCenterTextIcon className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                            <p className="text-sm text-slate-300">{rec.message}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RecommendationsPanel;
