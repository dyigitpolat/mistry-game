"use client";

interface GameHeaderProps {
    sessionTime: string;
    scenarioTitle?: string;
}

export default function GameHeader({ sessionTime, scenarioTitle }: GameHeaderProps) {
    return (
        <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-border-dark px-6 py-3 bg-surface-dark shrink-0 z-20">
            <div className="flex items-center gap-4">
                <div className="size-8 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl">fingerprint</span>
                </div>
                <h2 className="text-slate-100 text-xl font-bold leading-tight tracking-[-0.015em]">
                    Whodunit Engine
                </h2>
            </div>
            <div className="flex flex-1 justify-end gap-6 items-center">
                {/* Clock */}
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-background-dark border border-border-dark">
                    <span className="material-symbols-outlined text-text-secondary text-sm">schedule</span>
                    <span className="text-slate-100 font-bold font-mono">{sessionTime}</span>
                </div>
                {/* Call Watson */}
                <div className="flex gap-3">
                    <button className="flex cursor-pointer items-center justify-center overflow-hidden rounded-lg h-9 px-4 bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors">
                        <span className="material-symbols-outlined mr-2 text-[18px]">smart_toy</span>
                        <span>Call Watson</span>
                    </button>
                    <button className="flex cursor-pointer items-center justify-center overflow-hidden rounded-lg h-9 w-9 bg-border-dark text-white hover:bg-[#324467] transition-colors">
                        <span className="material-symbols-outlined text-[20px]">settings</span>
                    </button>
                </div>
                {/* Avatar */}
                <div className="size-9 rounded-full bg-surface-dark border-2 border-border-dark flex items-center justify-center">
                    <span className="material-symbols-outlined text-slate-400 text-lg">person</span>
                </div>
            </div>
        </header>
    );
}
