"use client";

import { useState, useCallback } from "react";

interface ClueItem {
    name: string;
    description: string;
    type: "clue" | "epiphany";
}

interface DeductionBoardProps {
    clues: ClueItem[];
    inventory: string[];
    notes: string;
    onNotesChange?: (notes: string) => void;
    onConnectClues?: (clues: string[], reasoning: string) => void;
}

export default function DeductionBoard({
    clues,
    inventory,
    notes,
    onNotesChange,
    onConnectClues,
}: DeductionBoardProps) {
    const [selectedClues, setSelectedClues] = useState<Set<number>>(new Set());
    const [reasoning, setReasoning] = useState("");
    const [isConnecting, setIsConnecting] = useState(false);
    const [editingNotes, setEditingNotes] = useState(false);
    const [noteText, setNoteText] = useState(notes);
    const [activeTab, setActiveTab] = useState<"clues" | "evidence" | "notes">("clues");

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
                    {(["clues", "evidence", "notes"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === tab
                                    ? "bg-surface-dark text-white"
                                    : "text-text-secondary hover:text-white"
                                }`}
                        >
                            {tab === "clues" ? `Clues (${regularClues.length})` : tab === "evidence" ? `Items (${inventory.length})` : "Notes"}
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
            </div>
        </aside>
    );
}
