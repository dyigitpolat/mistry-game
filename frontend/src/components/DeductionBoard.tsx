"use client";

import { useState, useCallback } from "react";

interface ClueItem {
    name: string;
    description: string;
    type: "clue" | "epiphany";
}

interface DiscordClue {
    name: string;
    description: string;
    significance: string;
}

interface DiscordSuspect {
    name: string;
    motive?: string;
    alibi?: string;
    suspicion_level: string;
    notes: string;
}

interface DiscordTheory {
    theory: string;
    supporting_evidence: string[];
    counter_evidence: string[];
    proposed_by?: string;
}

interface DiscordNote {
    id: string;
    session_id: string;
    summary: string;
    key_points: string[];
    clues: DiscordClue[];
    suspects: DiscordSuspect[];
    theories: DiscordTheory[];
    action_items: string[];
    unresolved_questions: string[];
    recorded_at: string;
    duration_seconds?: number;
}

interface DeductionBoardProps {
    clues: ClueItem[];
    inventory: string[];
    notes: string;
    onNotesChange?: (notes: string) => void;
    onConnectClues?: (clues: string[], reasoning: string) => void;
    discordNotes?: DiscordNote[];
    discordLinked?: boolean;
    discordGuildName?: string;
}

export default function DeductionBoard({
    clues,
    inventory,
    notes,
    onNotesChange,
    onConnectClues,
    discordNotes = [],
    discordLinked = false,
    discordGuildName,
}: DeductionBoardProps) {
    const [selectedClues, setSelectedClues] = useState<Set<number>>(new Set());
    const [reasoning, setReasoning] = useState("");
    const [isConnecting, setIsConnecting] = useState(false);
    const [editingNotes, setEditingNotes] = useState(false);
    const [noteText, setNoteText] = useState(notes);
    const [activeTab, setActiveTab] = useState<"clues" | "evidence" | "notes" | "discord">("clues");
    const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

    const toggleClue = useCallback((idx: number) => {
        setSelectedClues((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    }, []);

    const handleConnect = () => {
        if (selectedClues.size < 2 || !onConnectClues) return;
        const selected = Array.from(selectedClues).map((i) => clues[i]?.description || "");
        onConnectClues(selected, reasoning);
        setSelectedClues(new Set());
        setReasoning("");
        setIsConnecting(false);
    };

    const saveNotes = () => {
        onNotesChange?.(noteText);
        setEditingNotes(false);
    };

    const epiphanies = clues.filter((c) => c.type === "epiphany");
    const regularClues = clues.filter((c) => c.type === "clue");

    return (
        <aside className="col-span-3 border-r border-border-dark bg-background-dark flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border-dark bg-surface-dark/50">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-slate-100 font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">hub</span>
                        Deduction Board
                    </h3>
                    {selectedClues.size >= 2 ? (
                        <button
                            onClick={handleConnect}
                            className="text-xs px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30 hover:bg-amber-500/30 transition-colors font-bold"
                        >
                            Connect ({selectedClues.size})
                        </button>
                    ) : (
                        <button
                            onClick={() => setIsConnecting(!isConnecting)}
                            className="text-text-secondary hover:text-white transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">
                                {isConnecting ? "close" : "add_link"}
                            </span>
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-background-dark rounded-lg p-0.5">
                    {(["clues", "evidence", "notes", "discord"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === tab
                                    ? "bg-surface-dark text-white"
                                    : "text-text-secondary hover:text-white"
                                }`}
                        >
                            {tab === "clues" ? `Clues (${regularClues.length})`
                                : tab === "evidence" ? `Items (${inventory.length})`
                                : tab === "discord" ? (
                                    <span className="flex items-center justify-center gap-1">
                                        <span className="material-symbols-outlined text-[10px]">mic</span>
                                        {discordNotes.length > 0 ? discordNotes.length : ""}
                                    </span>
                                )
                                : "Notes"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
                {/* Connection mode banner */}
                {isConnecting && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-300">
                        <span className="font-bold">Connection Mode:</span> Select 2+ clues to connect, then click Connect.
                    </div>
                )}

                {activeTab === "clues" && (
                    <>
                        {/* Red string line */}
                        <div className="absolute left-8 top-10 bottom-10 w-0.5 bg-red-800/30 -z-0" />

                        {/* Epiphanies */}
                        {epiphanies.map((clue, i) => (
                            <div
                                key={`e-${i}`}
                                className="relative bg-amber-500/10 p-3 rounded-lg border border-amber-500/30 shadow-sm z-10"
                            >
                                <div className="absolute -left-[1.6rem] top-1/2 -translate-y-1/2 w-6 h-0.5 bg-amber-500/50" />
                                <div className="flex gap-3">
                                    <div className="w-10 h-10 rounded bg-amber-500/20 shrink-0 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-amber-400 text-lg">auto_awesome</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-0.5">Epiphany</p>
                                        <p className="text-xs text-slate-200">{clue.description}</p>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Regular clues */}
                        {regularClues.length === 0 ? (
                            <div className="text-center py-8">
                                <span className="material-symbols-outlined text-3xl text-text-secondary/50">search</span>
                                <p className="text-text-secondary text-sm mt-2">No clues discovered yet.</p>
                                <p className="text-text-secondary/60 text-xs mt-1">Explore locations to find evidence.</p>
                            </div>
                        ) : (
                            regularClues.map((clue, i) => {
                                const isSelected = selectedClues.has(clues.indexOf(clue));
                                return (
                                    <div
                                        key={i}
                                        onClick={() => isConnecting && toggleClue(clues.indexOf(clue))}
                                        className={`relative bg-surface-dark p-3 rounded-lg border shadow-sm z-10 transition-all ${isSelected
                                                ? "border-amber-500 ring-1 ring-amber-500/30 bg-amber-500/5"
                                                : isConnecting
                                                    ? "border-border-dark hover:border-amber-500/50 cursor-pointer"
                                                    : "border-border-dark hover:border-primary/50"
                                            } group`}
                                    >
                                        <div className="absolute -left-[1.6rem] top-1/2 -translate-y-1/2 w-6 h-0.5 bg-red-600/50" />
                                        <div className="flex gap-3">
                                            <div className="w-10 h-10 rounded bg-border-dark shrink-0 flex items-center justify-center">
                                                {isConnecting ? (
                                                    <span className={`material-symbols-outlined text-lg ${isSelected ? "text-amber-400" : "text-text-secondary"}`}>
                                                        {isSelected ? "check_circle" : "radio_button_unchecked"}
                                                    </span>
                                                ) : (
                                                    <span className="material-symbols-outlined text-primary text-lg">lightbulb</span>
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-100 group-hover:text-primary transition-colors">
                                                    {clue.name}
                                                </h4>
                                                <p className="text-xs text-text-secondary mt-1">{clue.description}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}

                        {/* Reasoning input when connecting */}
                        {selectedClues.size >= 2 && (
                            <div className="bg-surface-dark p-3 rounded-lg border border-amber-500/30 z-10 relative">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1 block">
                                    Your reasoning (optional)
                                </label>
                                <textarea
                                    value={reasoning}
                                    onChange={(e) => setReasoning(e.target.value)}
                                    placeholder="Why do these connect?"
                                    rows={2}
                                    className="w-full bg-background-dark border border-border-dark rounded py-2 px-3 text-xs text-slate-100 placeholder-text-secondary focus:border-amber-500 outline-none resize-none"
                                />
                            </div>
                        )}
                    </>
                )}

                {activeTab === "evidence" && (
                    <div className="space-y-2">
                        {inventory.length === 0 ? (
                            <div className="text-center py-8">
                                <span className="material-symbols-outlined text-3xl text-text-secondary/50">inventory_2</span>
                                <p className="text-text-secondary text-sm mt-2">No items collected.</p>
                            </div>
                        ) : (
                            inventory.map((item, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-3 p-3 bg-surface-dark rounded-lg border border-border-dark hover:border-primary/50 transition-colors"
                                >
                                    <div className="w-10 h-10 rounded bg-emerald-500/10 shrink-0 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-emerald-400">inventory_2</span>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-100">{item}</h4>
                                        <p className="text-xs text-text-secondary">Physical evidence</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === "notes" && (
                    <div className="space-y-3">
                        {editingNotes ? (
                            <>
                                <textarea
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value)}
                                    rows={10}
                                    className="w-full bg-surface-dark border border-border-dark rounded-lg py-3 px-4 text-sm text-slate-100 placeholder-text-secondary focus:border-primary outline-none resize-none"
                                    placeholder="Write your theory, connections, or observations..."
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={saveNotes}
                                        className="flex-1 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => { setNoteText(notes); setEditingNotes(false); }}
                                        className="flex-1 py-2 bg-border-dark text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-700"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div
                                onClick={() => setEditingNotes(true)}
                                className="bg-surface-dark p-4 rounded-lg border border-border-dark hover:border-primary/50 cursor-pointer min-h-[200px] transition-colors"
                            >
                                {noteText ? (
                                    <p className="text-sm text-slate-200 whitespace-pre-wrap">{noteText}</p>
                                ) : (
                                    <p className="text-text-secondary text-sm italic">Click to add notes...</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "discord" && (
                    <div className="space-y-3">
                        {/* Discord link status banner */}
                        {discordLinked ? (
                            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 flex items-center gap-2">
                                <span className="material-symbols-outlined text-purple-400 text-sm">smart_toy</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-purple-300 font-bold truncate">
                                        Connected to {discordGuildName || "Discord"}
                                    </p>
                                    <p className="text-[10px] text-purple-300/60">
                                        Voice discussions will appear here
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-surface-dark border border-border-dark rounded-lg p-4 text-center">
                                <span className="material-symbols-outlined text-3xl text-purple-400/50 mb-2">smart_toy</span>
                                <p className="text-sm text-slate-300 font-bold">Discord Not Connected</p>
                                <p className="text-xs text-text-secondary mt-1 mb-3">
                                    Use the Mistry Discord bot to record voice discussions
                                </p>
                                <p className="text-[10px] text-text-secondary/60">
                                    Run <code className="bg-background-dark px-1 rounded">/mystery link</code> in Discord
                                </p>
                            </div>
                        )}

                        {/* Discord notes list */}
                        {discordNotes.length === 0 ? (
                            discordLinked && (
                                <div className="text-center py-4">
                                    <p className="text-text-secondary text-xs">
                                        No discussion notes yet.
                                    </p>
                                    <p className="text-text-secondary/60 text-[10px] mt-1">
                                        Use <code className="bg-surface-dark px-1 rounded">/mystery record</code> in Discord
                                    </p>
                                </div>
                            )
                        ) : (
                            discordNotes.map((note) => {
                                const isExpanded = expandedNoteId === note.id;
                                const hasDetails = note.clues.length > 0 || note.suspects.length > 0 || note.theories.length > 0;

                                return (
                                    <div
                                        key={note.id}
                                        className="bg-purple-500/5 border border-purple-500/20 rounded-lg overflow-hidden"
                                    >
                                        {/* Note header */}
                                        <div
                                            onClick={() => hasDetails && setExpandedNoteId(isExpanded ? null : note.id)}
                                            className={`p-3 ${hasDetails ? "cursor-pointer hover:bg-purple-500/10" : ""} transition-colors`}
                                        >
                                            <div className="flex items-start gap-2">
                                                <span className="material-symbols-outlined text-purple-400 text-sm mt-0.5">mic</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-slate-200 leading-relaxed">
                                                        {note.summary}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-2 text-[10px] text-purple-300/60">
                                                        {note.duration_seconds && (
                                                            <span>{Math.round(note.duration_seconds)}s</span>
                                                        )}
                                                        <span>
                                                            {new Date(note.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                        </span>
                                                        {hasDetails && (
                                                            <span className="ml-auto flex items-center gap-1">
                                                                {note.clues.length > 0 && <span>{note.clues.length} clues</span>}
                                                                {note.suspects.length > 0 && <span>{note.suspects.length} suspects</span>}
                                                                <span className="material-symbols-outlined text-xs">
                                                                    {isExpanded ? "expand_less" : "expand_more"}
                                                                </span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded details */}
                                        {isExpanded && (
                                            <div className="border-t border-purple-500/20 p-3 space-y-3 bg-purple-500/5">
                                                {/* Key points */}
                                                {note.key_points.length > 0 && (
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1">Key Points</p>
                                                        <ul className="text-xs text-slate-300 space-y-1">
                                                            {note.key_points.map((point, i) => (
                                                                <li key={i} className="flex items-start gap-1">
                                                                    <span className="text-purple-400">•</span>
                                                                    {point}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Clues discussed */}
                                                {note.clues.length > 0 && (
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1">Clues Discussed</p>
                                                        <div className="space-y-1">
                                                            {note.clues.map((clue, i) => (
                                                                <div key={i} className="text-xs bg-background-dark/50 p-2 rounded">
                                                                    <span className="font-bold text-slate-200">{clue.name}</span>
                                                                    <span className={`ml-2 text-[10px] px-1 rounded ${
                                                                        clue.significance === "high" ? "bg-red-500/20 text-red-300" :
                                                                        clue.significance === "medium" ? "bg-yellow-500/20 text-yellow-300" :
                                                                        "bg-slate-500/20 text-slate-400"
                                                                    }`}>
                                                                        {clue.significance}
                                                                    </span>
                                                                    <p className="text-slate-400 mt-0.5">{clue.description}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Suspects discussed */}
                                                {note.suspects.length > 0 && (
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1">Suspects Discussed</p>
                                                        <div className="space-y-1">
                                                            {note.suspects.map((suspect, i) => (
                                                                <div key={i} className="text-xs bg-background-dark/50 p-2 rounded">
                                                                    <span className="font-bold text-slate-200">{suspect.name}</span>
                                                                    <span className={`ml-2 text-[10px] px-1 rounded ${
                                                                        suspect.suspicion_level === "high" ? "bg-red-500/20 text-red-300" :
                                                                        suspect.suspicion_level === "medium" ? "bg-yellow-500/20 text-yellow-300" :
                                                                        "bg-slate-500/20 text-slate-400"
                                                                    }`}>
                                                                        {suspect.suspicion_level}
                                                                    </span>
                                                                    {suspect.motive && <p className="text-slate-400 mt-0.5">Motive: {suspect.motive}</p>}
                                                                    {suspect.alibi && <p className="text-slate-400">Alibi: {suspect.alibi}</p>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Theories */}
                                                {note.theories.length > 0 && (
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1">Theories</p>
                                                        <div className="space-y-1">
                                                            {note.theories.map((theory, i) => (
                                                                <div key={i} className="text-xs bg-background-dark/50 p-2 rounded">
                                                                    <p className="text-slate-200">{theory.theory}</p>
                                                                    {theory.proposed_by && (
                                                                        <p className="text-[10px] text-slate-500 mt-1">— {theory.proposed_by}</p>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Action items */}
                                                {note.action_items.length > 0 && (
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1">Next Steps</p>
                                                        <ul className="text-xs text-slate-300 space-y-1">
                                                            {note.action_items.map((item, i) => (
                                                                <li key={i} className="flex items-start gap-1">
                                                                    <span className="material-symbols-outlined text-[10px] text-purple-400">check_box_outline_blank</span>
                                                                    {item}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
}
