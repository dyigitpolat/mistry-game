"use client";

import { useEffect, useState } from "react";

interface PhaseTransitionProps {
    isOpen: boolean;
    phaseName: string;
    phaseObjective: string;
    phaseNumber: number;
    unlockedLocations?: string[];
    unlockedCharacters?: string[];
    onContinue: () => void;
}

export default function PhaseTransition({
    isOpen,
    phaseName,
    phaseObjective,
    phaseNumber,
    unlockedLocations = [],
    unlockedCharacters = [],
    onContinue,
}: PhaseTransitionProps) {
    const [animStage, setAnimStage] = useState(0);

    useEffect(() => {
        if (!isOpen) {
            setAnimStage(0);
            return;
        }
        const t1 = setTimeout(() => setAnimStage(1), 300);
        const t2 = setTimeout(() => setAnimStage(2), 800);
        const t3 = setTimeout(() => setAnimStage(3), 1300);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
            <div className="text-center max-w-lg px-8">
                {/* Phase number badge */}
                <div
                    className={`transition-all duration-700 ${animStage >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                        }`}
                >
                    <span className="inline-block px-4 py-1 bg-primary/20 text-primary text-xs font-bold uppercase tracking-[0.3em] rounded-full border border-primary/30">
                        Phase {phaseNumber}
                    </span>
                </div>

                {/* Phase name */}
                <h2
                    className={`text-3xl font-bold text-white mt-4 transition-all duration-700 delay-100 ${animStage >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                        }`}
                >
                    {phaseName}
                </h2>

                {/* Divider */}
                <div
                    className={`mx-auto mt-4 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent transition-all duration-700 ${animStage >= 2 ? "w-48 opacity-100" : "w-0 opacity-0"
                        }`}
                />

                {/* Objective */}
                <p
                    className={`text-slate-300 text-base mt-4 leading-relaxed transition-all duration-700 ${animStage >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                        }`}
                >
                    {phaseObjective}
                </p>

                {/* Unlocked content */}
                {animStage >= 3 && (unlockedLocations.length > 0 || unlockedCharacters.length > 0) && (
                    <div className="mt-6 flex flex-wrap justify-center gap-2 animate-in">
                        {unlockedLocations.map((loc) => (
                            <span
                                key={loc}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-full border border-blue-500/20"
                            >
                                <span className="material-symbols-outlined text-xs">place</span>
                                {loc}
                            </span>
                        ))}
                        {unlockedCharacters.map((char) => (
                            <span
                                key={char}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500/10 text-amber-400 text-xs font-medium rounded-full border border-amber-500/20"
                            >
                                <span className="material-symbols-outlined text-xs">person</span>
                                {char}
                            </span>
                        ))}
                    </div>
                )}

                {/* Continue button */}
                {animStage >= 3 && (
                    <button
                        onClick={onContinue}
                        className="mt-8 px-8 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-all animate-in"
                    >
                        Continue Investigation
                    </button>
                )}
            </div>
        </div>
    );
}
