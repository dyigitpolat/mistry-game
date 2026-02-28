"use client";

interface CharacterInRoom {
    name: string;
    mood: string;
    suspicion: number;
    isBroken: boolean;
}

interface StatusPanelProps {
    objective?: string;
    objectiveText?: string;
    objectiveProgress?: number;
    inventory: string[];
    charactersInRoom: CharacterInRoom[];
    currentLocation: string;
    unlockedLocations?: string[];
    onTalkToCharacter?: (name: string) => void;
    onPresentEvidence?: (characterName: string) => void;
    onMoveToLocation?: (location: string) => void;
    onSolveCase?: () => void;
    phaseName?: string;
}

export default function StatusPanel({
    objective,
    objectiveText,
    objectiveProgress = 0,
    inventory,
    charactersInRoom,
    currentLocation,
    unlockedLocations = [],
    onTalkToCharacter,
    onPresentEvidence,
    onMoveToLocation,
    onSolveCase,
    phaseName,
}: StatusPanelProps) {
    return (
        <aside className="col-span-3 border-l border-border-dark bg-surface-dark flex flex-col h-full overflow-hidden">
            {/* Location Navigator */}
            <div className="p-4 border-b border-border-dark bg-surface-dark">
                <h3 className="text-text-secondary text-xs font-bold uppercase tracking-wider flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-sm">map</span>
                    Locations
                </h3>
                <div className="space-y-1">
                    {unlockedLocations.map((loc) => (
                        <button
                            key={loc}
                            onClick={() => loc !== currentLocation && onMoveToLocation?.(loc)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${loc === currentLocation
                                    ? "bg-primary/10 text-primary font-bold border border-primary/30"
                                    : "text-slate-300 hover:bg-white/5 hover:text-white border border-transparent"
                                }`}
                        >
                            <span className="material-symbols-outlined text-sm">
                                {loc === currentLocation ? "my_location" : "place"}
                            </span>
                            <span className="truncate">{loc}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Scrollable status sections */}
            <div className="overflow-y-auto flex-1 flex flex-col">
                {/* Current Objective */}
                {objective && (
                    <div className="p-4 border-b border-border-dark bg-primary/5">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-primary text-sm">flag</span>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">{phaseName || "Current Objective"}</h3>
                        </div>
                        <p className="text-slate-200 text-sm leading-snug mt-1">{objectiveText || objective}</p>
                        <div className="mt-3 w-full bg-background-dark h-1.5 rounded-full overflow-hidden">
                            <div className="bg-primary h-full transition-all duration-500" style={{ width: `${objectiveProgress}%` }} />
                        </div>
                        <p className="text-[10px] text-right text-text-secondary mt-1">{objectiveProgress}% Complete</p>
                    </div>
                )}

                {/* Inventory */}
                <div className="p-4 border-b border-border-dark">
                    <h3 className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">inventory_2</span>
                        Inventory ({inventory.length})
                    </h3>
                    {inventory.length === 0 ? (
                        <div className="grid grid-cols-4 gap-2">
                            {[0, 1, 2, 3].map((i) => (
                                <div key={i} className="aspect-square bg-background-dark rounded border border-border-dark flex items-center justify-center opacity-40">
                                    <span className="material-symbols-outlined text-slate-600 text-sm">add</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {inventory.map((item, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-2 px-3 py-2 bg-background-dark rounded-lg border border-border-dark hover:border-emerald-500/30 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-emerald-400 text-sm">inventory_2</span>
                                    <span className="text-slate-200 text-sm truncate">{item}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Characters In Room */}
                <div className="p-4 border-b border-border-dark">
                    <h3 className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">groups</span>
                        In Room ({charactersInRoom.length})
                    </h3>
                    <div className="space-y-2">
                        {charactersInRoom.length === 0 ? (
                            <p className="text-text-secondary/60 text-xs italic">No one else is here.</p>
                        ) : (
                            charactersInRoom.map((char) => (
                                <div
                                    key={char.name}
                                    className="p-3 rounded-lg bg-background-dark border border-border-dark hover:border-white/20 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`size-10 rounded-full flex items-center justify-center border ${char.isBroken
                                                ? "bg-red-500/20 border-red-500/30"
                                                : char.suspicion > 50
                                                    ? "bg-amber-500/20 border-amber-500/30"
                                                    : "bg-border-dark border-border-dark"
                                            }`}>
                                            <span className={`material-symbols-outlined ${char.isBroken ? "text-red-400" : char.suspicion > 50 ? "text-amber-400" : "text-text-secondary"
                                                }`}>person</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-slate-200 text-sm font-bold truncate">{char.name}</h4>
                                            <p className="text-text-secondary text-xs truncate">
                                                {char.isBroken ? "🔓 Alibi Broken" : char.mood}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Suspicion bar */}
                                    {!char.isBroken && char.suspicion > 0 && (
                                        <div className="mt-2">
                                            <div className="flex justify-between text-[10px] text-text-secondary mb-0.5">
                                                <span>Suspicion</span>
                                                <span>{char.suspicion}%</span>
                                            </div>
                                            <div className="w-full bg-surface-dark h-1 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${char.suspicion > 70 ? "bg-red-500" : char.suspicion > 40 ? "bg-amber-500" : "bg-blue-500"
                                                        }`}
                                                    style={{ width: `${char.suspicion}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Action buttons */}
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={() => onTalkToCharacter?.(char.name)}
                                            className="flex-1 py-1.5 text-xs font-medium bg-white/5 border border-white/10 rounded-md hover:bg-white/10 hover:text-white transition-colors text-slate-300 flex items-center justify-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-xs">chat_bubble</span>
                                            Talk
                                        </button>
                                        {inventory.length > 0 && (
                                            <button
                                                onClick={() => onPresentEvidence?.(char.name)}
                                                className="flex-1 py-1.5 text-xs font-medium bg-amber-500/10 border border-amber-500/20 rounded-md hover:bg-amber-500/20 transition-colors text-amber-300 flex items-center justify-center gap-1"
                                            >
                                                <span className="material-symbols-outlined text-xs">evidence</span>
                                                Present
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Solve Case */}
                {onSolveCase && (
                    <div className="p-4 mt-auto border-t border-border-dark bg-background-dark">
                        <button
                            onClick={onSolveCase}
                            className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold rounded-lg hover:from-red-500 hover:to-red-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/30"
                        >
                            <span className="material-symbols-outlined">gavel</span>
                            Solve Case
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
}
