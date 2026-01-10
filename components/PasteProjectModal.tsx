import React, { useState } from 'react';
import { Project } from '../types';
import { parseProjectText, ParseResult } from '../utils/projectParser';
import { XMarkIcon, ArrowPathIcon, CheckIcon } from './icons';

interface PasteProjectModalProps {
    onClose: () => void;
    onParsed: (projectData: Partial<Project>) => void;
}

const PasteProjectModal: React.FC<PasteProjectModalProps> = ({ onClose, onParsed }) => {
    const [text, setText] = useState('');
    const [parsedResult, setParsedResult] = useState<ParseResult | null>(null);

    const handleParse = () => {
        const result = parseProjectText(text);
        setParsedResult(result);
    };

    const handleConfirm = () => {
        if (parsedResult && parsedResult.project) {
            onParsed(parsedResult.project);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-4 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
                    <h2 className="text-xl font-bold text-white">Paste Project Details</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto p-6 space-y-6">
                    <div>
                        <label htmlFor="paste-area" className="block mb-2 text-sm font-medium text-slate-300">
                            Paste your project text here
                        </label>
                        <textarea
                            id="paste-area"
                            rows={10}
                            className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 font-mono"
                            placeholder="Paste your project outline, strategy, or notes..."
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={handleParse}
                            disabled={!text.trim()}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ArrowPathIcon className="w-4 h-4" />
                            Parse Text
                        </button>
                    </div>

                    {parsedProject && (
                        <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 space-y-4">
                            <h3 className="text-lg font-semibold text-white border-b border-slate-600 pb-2">Preview</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <span className="text-xs text-slate-400 uppercase font-bold">Project Name</span>
                                    <p className="text-white font-medium">{parsedProject.name || 'Untitled Project'}</p>
                                </div>

                                <div className="col-span-2">
                                    <span className="text-xs text-slate-400 uppercase font-bold">Description</span>
                                    <p className="text-slate-300 text-sm whitespace-pre-wrap line-clamp-3">{parsedProject.description || 'No description found'}</p>
                                </div>

                                <div>
                                    <span className="text-xs text-slate-400 uppercase font-bold">Est. Cost</span>
                                    <p className="text-brand-secondary font-medium">
                                        {parsedProject.currency} {parsedProject.cost?.toLocaleString()}
                                    </p>
                                </div>

                                <div>
                                    <span className="text-xs text-slate-400 uppercase font-bold">Est. Duration</span>
                                    <p className="text-brand-secondary font-medium">
                                        {parsedProject.duration} {parsedProject.durationUnit}
                                    </p>
                                </div>

                                <div className="col-span-2">
                                    <span className="text-xs text-slate-400 uppercase font-bold">Phases Found ({parsedProject.phases?.length || 0})</span>
                                    <div className="mt-1 space-y-2 max-h-60 overflow-y-auto pr-1">
                                        {parsedProject.phases && parsedProject.phases.length > 0 ? (
                                            parsedProject.phases.map((phase, idx) => (
                                                <div key={idx} className="bg-slate-800 p-2 rounded border border-slate-700">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <p className="text-brand-light font-medium text-sm">{phase.name}</p>
                                                        <span className="text-xs text-slate-500">{phase.tasks.length} tasks</span>
                                                    </div>
                                                    <ul className="list-disc list-inside pl-2 space-y-1">
                                                        {phase.tasks.map((task, tIdx) => (
                                                            <li key={tIdx} className="text-slate-400 text-xs">
                                                                {task.name}
                                                                {task.subTasks && task.subTasks.length > 0 && (
                                                                    <ul className="list-[circle] list-inside pl-4 mt-0.5 opacity-80">
                                                                        {task.subTasks.map((st, stIdx) => (
                                                                            <li key={stIdx}>{st.name}</li>
                                                                        ))}
                                                                    </ul>
                                                                )}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-slate-500 text-sm italic">No phases detected</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end items-center p-4 bg-slate-800 border-t border-slate-700 sticky bottom-0 space-x-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!parsedResult}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-secondary rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <CheckIcon className="w-4 h-4" />
                        Create Project
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PasteProjectModal;
