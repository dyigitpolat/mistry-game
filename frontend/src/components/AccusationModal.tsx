"use client";

import { useState } from "react";

interface AccusationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (suspect: string, weapon: string, motive: string) => void;
    characters: string[];
    loading?: boolean;
    result?: {
        correct: boolean;
        narrative: string;
        correct_suspect?: string;
        correct_weapon?: string;
        correct_motive?: string;
    } | null;
}

export default function AccusationModal({
    isOpen,
    onClose,
    onSubmit,
    characters,
    loading = false,
    result = null,
}: AccusationModalProps) {
    const [suspect, setSuspect] = useState("");
    const [weapon, setWeapon] = useState("");
    const [motive, setMotive] = useState("");

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (suspect && weapon && motive) {
            onSubmit(suspect, weapon, motive);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in">
            <div className="w-full max-w-lg bg-[#0d121c] border border-border-dark rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-border-dark bg-gradient-to-r from-red-900/30 to-transparent">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-red-400 text-2xl">gavel</span>
                            <h2 className="text-xl font-bold text-white">Final Accusation</h2>
                        </div>
                        {!result && (
                            <button
                                onClick={onClose}
                                className="text-text-secondary hover:text-white transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        )}
                    </div>
                    {!result && (
                        <p className="text-text-secondary text-sm mt-2">
                            Choose carefully — this will determine the outcome of the case.
                        </p>
                    )}
                </div>

                {result ? (
                    /* Result Screen */
                    <div className="p-6 space-y-4">
                        <div className={`p-4 rounded-lg border ${result.correct
                                ? "bg-green-900/20 border-green-500/30"
                                : "bg-red-900/20 border-red-500/30"
                            }`}>
                            <div className="flex items-center gap-2 mb-3">
                                <span className={`material-symbols-outlined text-2xl ${result.correct ? "text-green-400" : "text-red-400"
                                    }`}>
                                    {result.correct ? "emoji_events" : "close"}
                                </span>
                                <h3 className={`text-lg font-bold ${result.correct ? "text-green-400" : "text-red-400"
                                    }`}>
                                    {result.correct ? "Case Solved!" : "Incorrect Deduction"}
                                </h3>
                            </div>
                            <p className="text-slate-200 text-sm leading-relaxed">
                                {result.narrative}
                            </p>
                        </div>

                        {!result.correct && (
                            <div className="space-y-2 text-sm">
                                {result.correct_suspect && (
                                    <p className="text-text-secondary">
                                        <span className="text-red-400 font-semibold">Suspect:</span>{" "}
                                        {result.correct_suspect}
                                    </p>
                                )}
                                {result.correct_weapon && (
                                    <p className="text-text-secondary">
                                        <span className="text-red-400 font-semibold">Method:</span>{" "}
                                        {result.correct_weapon}
                                    </p>
                                )}
                                {result.correct_motive && (
                                    <p className="text-text-secondary">
                                        <span className="text-red-400 font-semibold">Motive:</span>{" "}
                                        {result.correct_motive}
                                    </p>
                                )}
                            </div>
                        )}

                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            {result.correct ? "View Case Summary" : "Continue Investigating"}
                        </button>
                    </div>
                ) : (
                    /* Accusation Form */
                    <div className="p-6 space-y-5">
                        {/* Suspect */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-red-400 mb-2">
                                <span className="material-symbols-outlined text-sm align-middle mr-1">person</span>
                                Accused
                            </label>
                            <select
                                value={suspect}
                                onChange={(e) => setSuspect(e.target.value)}
                                className="w-full bg-surface-dark border border-border-dark rounded-lg py-3 px-4 text-slate-100 focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none appearance-none cursor-pointer"
                            >
                                <option value="">Select the culprit...</option>
                                {characters.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        {/* Weapon */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-red-400 mb-2">
                                <span className="material-symbols-outlined text-sm align-middle mr-1">destruction</span>
                                Method / Weapon
                            </label>
                            <input
                                type="text"
                                value={weapon}
                                onChange={(e) => setWeapon(e.target.value)}
                                placeholder="How was the victim killed?"
                                className="w-full bg-surface-dark border border-border-dark rounded-lg py-3 px-4 text-slate-100 placeholder-text-secondary focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none"
                            />
                        </div>

                        {/* Motive */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-red-400 mb-2">
                                <span className="material-symbols-outlined text-sm align-middle mr-1">psychology</span>
                                Motive
                            </label>
                            <textarea
                                value={motive}
                                onChange={(e) => setMotive(e.target.value)}
                                placeholder="Why did the suspect commit the crime?"
                                rows={3}
                                className="w-full bg-surface-dark border border-border-dark rounded-lg py-3 px-4 text-slate-100 placeholder-text-secondary focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
                            />
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={!suspect || !weapon || !motive || loading}
                            className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold rounded-lg hover:from-red-500 hover:to-red-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                                    Evaluating...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-sm">gavel</span>
                                    Submit Final Deduction
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
