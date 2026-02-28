"use client";

import { useState, useRef, useEffect } from "react";

interface LogEntry {
    time: string;
    speaker?: string;
    message: string;
    isAction?: boolean;
    isHighlighted?: boolean;
    type?: "narrator" | "character" | "clue" | "item" | "phase" | "error";
}

interface NarrativeLogProps {
    entries: LogEntry[];
    onCommand: (cmd: string) => void;
    quickActions?: string[];
    loading?: boolean;
    loadingContext?: string;
}

export default function NarrativeLog({
    entries,
    onCommand,
    quickActions = [],
    loading = false,
    loadingContext = "Processing...",
}: NarrativeLogProps) {
    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [entries]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading) return;
        onCommand(input.trim());
        setInput("");
    };

    const formatText = (text: string) => {
        if (!text) return text;
        return text.split(/(\*\*.*?\*\*|\*.*?\*)/).map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
                return <em key={i} className="italic text-slate-300">{part.slice(1, -1)}</em>;
            }
            return part;
        });
    };

    const renderEntry = (entry: LogEntry, i: number) => {
        // Phase transition
        if (entry.type === "phase") {
            return (
                <div key={i} className="flex items-center gap-3 py-2 animate-in">
                    <div className="flex-1 h-px bg-primary/30" />
                    <span className="text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">flag</span>
                        {entry.message}
                    </span>
                    <div className="flex-1 h-px bg-primary/30" />
                </div>
            );
        }

        // Clue discovery
        if (entry.type === "clue") {
            return (
                <div key={i} className="flex items-start gap-2 pl-3 py-1 border-l-2 border-blue-500/50 animate-in">
                    <span className="material-symbols-outlined text-blue-400 text-sm mt-0.5">lightbulb</span>
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Clue Discovered</span>
                        <p className="text-slate-200 text-sm">{formatText(entry.message)}</p>
                    </div>
                </div>
            );
        }

        // Item pickup
        if (entry.type === "item") {
            return (
                <div key={i} className="flex items-start gap-2 pl-3 py-1 border-l-2 border-emerald-500/50 animate-in">
                    <span className="material-symbols-outlined text-emerald-400 text-sm mt-0.5">inventory_2</span>
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Item Collected</span>
                        <p className="text-slate-200 text-sm">{formatText(entry.message)}</p>
                    </div>
                </div>
            );
        }

        // Error
        if (entry.type === "error") {
            return (
                <div key={i} className="text-red-400/80 text-sm italic animate-in">
                    ⚠ {entry.message}
                </div>
            );
        }

        // Character dialogue
        if (entry.speaker && entry.type === "character") {
            return (
                <div key={i} className="animate-in">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="size-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-amber-400 text-xs">person</span>
                        </div>
                        <span className="text-amber-400 font-bold text-sm">{entry.speaker}</span>
                        <span className="text-text-secondary/50 text-xs">{entry.time}</span>
                    </div>
                    <p className="text-slate-200 text-base leading-relaxed pl-8 italic">&ldquo;{formatText(entry.message)}&rdquo;</p>
                </div>
            );
        }

        // Highlighted narrative
        if (entry.isHighlighted) {
            return (
                <div key={i} className="text-slate-100 text-base leading-relaxed pl-3 border-l-2 border-primary/50 animate-in">
                    {formatText(entry.message)}
                </div>
            );
        }

        // Player action
        if (entry.isAction) {
            return (
                <div key={i} className="text-text-secondary text-sm italic animate-in">
                    &gt; {entry.message}
                </div>
            );
        }

        // Default: narrator/system
        return (
            <div key={i} className="text-text-secondary text-sm animate-in">
                <span className="text-primary font-bold">[{entry.time}]</span>{" "}
                {entry.speaker && (
                    <span className="text-slate-300 font-medium">{entry.speaker}: </span>
                )}
                {formatText(entry.message)}
            </div>
        );
    };

    return (
        <>
            <div className="flex-1 min-h-0 flex flex-col justify-end p-6 overflow-hidden relative">
                {/* Top gradient */}
                <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#0d121c] to-transparent z-10 pointer-events-none" />

                {/* Log entries */}
                <div ref={scrollRef} className="overflow-y-auto space-y-4 pr-2">
                    {entries.length === 0 && (
                        <div className="text-text-secondary text-sm italic text-center py-8">
                            The investigation begins... Type a command or click an action below.
                        </div>
                    )}
                    {entries.map((entry, i) => renderEntry(entry, i))}
                    {loading && (
                        <div className="flex items-center gap-2 text-primary animate-pulse">
                            <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                            <span className="text-xs">{loadingContext}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Input bar */}
            <div className="p-4 bg-surface-dark border-t border-border-dark shrink-0">
                <form onSubmit={handleSubmit} className="relative flex items-center">
                    <span className="absolute left-4 text-primary font-bold select-none">&gt;</span>
                    <input
                        className="w-full bg-background-dark border border-border-dark rounded-lg py-3 pl-10 pr-12 text-slate-100 placeholder-text-secondary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                        placeholder="What do you want to do? (e.g., 'Search the room', 'Talk to Neill')"
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        disabled={loading || !input.trim()}
                        className="absolute right-2 p-1.5 text-text-secondary hover:text-primary rounded-md hover:bg-white/5 transition-colors disabled:opacity-30"
                    >
                        <span className="material-symbols-outlined">send</span>
                    </button>
                </form>
                {quickActions.length > 0 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
                        {quickActions.map((action) => (
                            <button
                                key={action}
                                onClick={() => !loading && onCommand(action)}
                                disabled={loading}
                                className="whitespace-nowrap px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-text-secondary hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30"
                            >
                                {action}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
