"use client";

import Link from "next/link";

interface CaseCardProps {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    imageUrl?: string;
    solvedPercent?: number;
    author?: string;
    phaseCount?: number;
    progressPercent?: number;
    isComplete?: boolean;
}

const difficultyColors: Record<string, string> = {
    easy: "text-green-400 bg-green-500/10",
    medium: "text-primary bg-primary/10",
    hard: "text-red-400 bg-red-500/10",
    extreme: "text-orange-400 bg-orange-500/10",
};

export default function CaseCard({
    id,
    title,
    description,
    difficulty,
    imageUrl,
    solvedPercent,
    author,
    phaseCount,
    progressPercent,
    isComplete,
}: CaseCardProps) {
    const diffClass = difficultyColors[difficulty.toLowerCase()] || difficultyColors.medium;

    return (
        <Link href={`/case/${id}`} className="block">
            <div className="group relative flex flex-col bg-surface-dark rounded-xl overflow-hidden hover:scale-[1.02] transition-transform duration-300 shadow-lg border border-slate-800">
                {/* Image */}
                <div className="aspect-video bg-cover bg-center relative bg-border-dark">
                    {imageUrl && (
                        <div
                            className="absolute inset-0 bg-cover bg-center"
                            style={{ backgroundImage: `url(${imageUrl})` }}
                        />
                    )}
                    {!imageUrl && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-surface-dark">
                            <span className="material-symbols-outlined text-4xl text-primary/50">visibility</span>
                        </div>
                    )}
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded capitalize">
                        {difficulty}
                    </div>

                    {isComplete ? (
                        <div className="absolute top-2 left-2 bg-primary/90 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg uppercase tracking-wider flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">task_alt</span> Solved
                        </div>
                    ) : progressPercent !== undefined && progressPercent > 0 ? (
                        <div className="absolute top-2 left-2 bg-yellow-500/90 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg uppercase tracking-wider">
                            In Progress
                        </div>
                    ) : null}

                    {progressPercent !== undefined && (
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-black/40">
                            <div
                                className={`h-full ${isComplete ? 'bg-primary' : 'bg-yellow-500'} transition-all`}
                                style={{ width: `${Math.max(5, progressPercent)}%` }}
                            />
                        </div>
                    )}

                </div>

                {/* Content */}
                <div className="p-4 flex flex-col gap-2">
                    {author && (
                        <div className="text-[10px] uppercase font-black tracking-widest text-primary/80 mb-[-4px]">
                            {author}
                        </div>
                    )}
                    <h3 className="text-white font-bold text-lg leading-tight group-hover:text-primary transition-colors">
                        {title}
                    </h3>
                    <p className="text-slate-400 text-sm line-clamp-2">{description}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-700 pt-3">
                        {solvedPercent !== undefined && (
                            <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">group</span>
                                {solvedPercent}% Solved
                            </span>
                        )}
                        {phaseCount !== undefined && (
                            <span className={`font-bold px-2 py-0.5 rounded ${diffClass}`}>
                                {phaseCount} Phases
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
}
