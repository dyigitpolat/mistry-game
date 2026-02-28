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
}: CaseCardProps) {
    const diffClass = difficultyColors[difficulty.toLowerCase()] || difficultyColors.medium;

    return (
        <Link href={`/game/${id}`} className="block">
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
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                </div>

                {/* Content */}
                <div className="p-4 flex flex-col gap-2">
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
                        {author && (
                            <span className={`font-bold px-2 py-0.5 rounded ${diffClass}`}>
                                {author}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
}
