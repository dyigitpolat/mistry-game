"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import GameHeader from "@/components/GameHeader";
import DeductionBoard from "@/components/DeductionBoard";
import SceneView from "@/components/SceneView";
import NarrativeLog from "@/components/NarrativeLog";
import StatusPanel from "@/components/StatusPanel";
import AccusationModal from "@/components/AccusationModal";
import PhaseTransition from "@/components/PhaseTransition";
import ClueToast from "@/components/ClueToast";
import {
    startGame,
    performAction,
    chatWithCharacter,
    presentEvidence,
    connectClues,
    accuseCase,
    getScenario,
    BACKEND_URL,
    type GameSession,
    type Scenario,
    type ActionResponse,
    type AccusationResult,
} from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────

interface LogEntry {
    time: string;
    speaker?: string;
    message: string;
    isAction?: boolean;
    isHighlighted?: boolean;
    type?: "narrator" | "character" | "clue" | "item" | "phase" | "error";
}

interface Toast {
    id: string;
    type: "clue" | "item" | "epiphany";
    message: string;
}

// ── Page Component ────────────────────────────────────────────────

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const scenarioId = resolvedParams.id;

    const [scenario, setScenario] = useState<Scenario | null>(null);
    const [session, setSession] = useState<GameSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [loadingContext, setLoadingContext] = useState("Processing...");
    const [error, setError] = useState<string | null>(null);
    const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [sceneImageUrl, setSceneImageUrl] = useState<string | undefined>();
    const toastCounter = useRef(0);

    // Modal state
    const [showAccusation, setShowAccusation] = useState(false);
    const [accusationLoading, setAccusationLoading] = useState(false);
    const [accusationResult, setAccusationResult] = useState<AccusationResult | null>(null);
    const [showPhaseTransition, setShowPhaseTransition] = useState(false);
    const [phaseTransitionData, setPhaseTransitionData] = useState<{
        name: string;
        objective: string;
        number: number;
        locations: string[];
        characters: string[];
    } | null>(null);

    const getTime = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    const addLog = useCallback(
        (message: string, opts?: Partial<LogEntry>) => {
            setLogEntries((prev) => [
                ...prev,
                { time: getTime(), message, ...opts },
            ]);
        },
        []
    );

    const addToast = useCallback((type: Toast["type"], message: string) => {
        const id = `toast-${++toastCounter.current}`;
        setToasts((prev) => [...prev, { id, type, message }]);
    }, []);

    const dismissToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    // ── Initialize game ─────────────────────────────────────────────
    useEffect(() => {
        async function init() {
            try {
                setLoading(true);
                const scenarioData = await getScenario(scenarioId);
                setScenario(scenarioData);

                // Fetch session logic: Try to start game, backend `startGame` uses `replace_one` with `upsert` and UUID. 
                // Actually wait: The backend `start_game` generates a `uuid.uuid4()` EVERY time it is called.
                // It does NOT resume sessions. We must use `getGameState` but we need `sessionId`.
                // Let's check `api.ts` to see if there is a get active session or if `startGame` can be modified.
                const gameSession = await startGame(scenarioId);
                setSession(gameSession);

                // Intro narrative
                addLog(scenarioData.intro_narrative, { isHighlighted: true });
                addLog(`You are at ${gameSession.player_state.current_location}.`, { isHighlighted: true });

                const phaseIdx = gameSession.player_state.current_phase;
                const phase = scenarioData.phases[phaseIdx] || scenarioData.phases[0];
                if (phase) {
                    addLog(`Phase: ${phase.name} — ${phase.objective}`, { type: "phase" });
                }

                // Restore conversation history from persisted session
                if (gameSession.character_states) {
                    for (const [charName, charState] of Object.entries(gameSession.character_states)) {
                        const history = (charState as any).conversation_history || [];
                        for (const msg of history) {
                            if (msg.role === "user") {
                                addLog(msg.content, { type: "narrator" });
                            } else if (msg.role === "assistant") {
                                addLog(msg.content, { speaker: charName, type: "character" });
                            }
                        }
                    }
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "Failed to connect";
                setError(msg);
                addLog(`Connection failed: ${msg}`, { type: "error" });
            } finally {
                setLoading(false);
            }
        }
        init();
    }, [scenarioId, addLog]);

    // ── Process action response ─────────────────────────────────────
    const processResponse = useCallback(
        (response: ActionResponse) => {
            // Narrative
            if (response.narrative) {
                // Check if it's a character speaking (starts with optional *action* then **Name**)
                const charMatch = response.narrative.match(/^(?:\*([\s\S]+?)\*\s*\n+)?\*\*(.+?)\*\*:\s*([\s\S]+)/);
                if (charMatch) {
                    const actionNarrative = charMatch[1];
                    const speakerName = charMatch[2];
                    const dialogue = charMatch[3];

                    if (actionNarrative) {
                        addLog(actionNarrative, { isHighlighted: true });
                    }
                    addLog(dialogue, { speaker: speakerName, type: "character" });
                } else {
                    addLog(response.narrative, { isHighlighted: true });
                }
            }

            // State updates
            if (response.state_updates) {
                setSession((prev) =>
                    prev ? { ...prev, player_state: response.state_updates! } : prev
                );
            }

            // Character state updates
            if (response.character_state_updates) {
                setSession((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        character_states: {
                            ...prev.character_states,
                            ...response.character_state_updates!
                        }
                    };
                });
            }

            // New clues
            if (response.new_clues?.length) {
                for (const clue of response.new_clues) {
                    addLog(clue, { type: "clue" });
                    addToast("clue", clue);
                }
            }

            // New items
            if (response.new_items?.length) {
                for (const item of response.new_items) {
                    addLog(item, { type: "item" });
                    addToast("item", item);
                }
            }

            // New location
            if (response.new_location) {
                setSession((prev) =>
                    prev
                        ? {
                            ...prev,
                            player_state: {
                                ...prev.player_state,
                                current_location: response.new_location!,
                            },
                        }
                        : prev
                );
            }

            // Phase advancement
            if (response.phase_advanced && response.new_phase !== null) {
                setSession((prev) =>
                    prev
                        ? {
                            ...prev,
                            player_state: {
                                ...prev.player_state,
                                current_phase: response.new_phase!,
                            },
                        }
                        : prev
                );

                if (response.phase_info) {
                    setPhaseTransitionData({
                        name: response.phase_info.name,
                        objective: response.phase_info.objective,
                        number: response.phase_info.id,
                        locations: response.phase_info.unlocked_locations,
                        characters: response.phase_info.unlocked_characters,
                    });
                    setShowPhaseTransition(true);
                }
            }

            // Error
            if (response.error) {
                addLog(response.error, { type: "error" });
            }
        },
        [addLog, addToast]
    );

    // ── Command handler (natural language) ──────────────────────────
    const handleCommand = useCallback(
        async (cmd: string) => {
            if (!session || !scenario) return;
            setActionLoading(true);
            addLog(cmd, { isAction: true });

            try {
                let response: ActionResponse;

                // Detect talk intent robustly
                const talkRegex = /^(?:talk|speak|chat|ask|tell|question|interrogate)\b/i;
                let matchedChar = undefined;

                if (talkRegex.test(cmd)) {
                    const currentPhase = scenario.phases[session.player_state.current_phase];
                    // Find if any currently unlocked character's first name is mentioned
                    matchedChar = currentPhase?.unlocked_characters.find((c) => {
                        const firstName = c.split(" ")[0].toLowerCase();
                        return cmd.toLowerCase().includes(firstName);
                    });
                }

                if (talkRegex.test(cmd) && matchedChar) {
                    setLoadingContext(`${matchedChar} is thinking...`);
                    response = await chatWithCharacter(session.id, matchedChar, cmd);
                } else if (talkRegex.test(cmd) && !matchedChar) {
                    addLog(`Specify who you want to talk to (e.g., "Talk to Neill").`, { type: "error" });
                    setActionLoading(false);
                    return;
                } else {
                    // All other commands go to Oracle as natural language
                    setLoadingContext("The Oracle is evaluating...");

                    // Parse basic commands for action_type hint
                    const moveMatch = cmd.match(/^(?:go|move|travel|walk|head)\s+(?:to\s+)?(.+)/i);
                    const searchMatch = cmd.match(/^(?:search|look|examine|inspect|investigate)\s*(.*)/i);
                    const takeMatch = cmd.match(/^(?:take|grab|pick up|collect)\s+(.+)/i);

                    let actionType = "free";
                    let target = "";
                    if (moveMatch) {
                        actionType = "move";
                        target = moveMatch[1].trim();
                        // Try to fuzzy match against unlocked locations
                        const currentPhase = scenario.phases[session.player_state.current_phase];
                        const matchedLoc = currentPhase?.unlocked_locations.find(
                            (l) => l.toLowerCase().includes(target.toLowerCase()) || target.toLowerCase().includes(l.toLowerCase())
                        );
                        if (matchedLoc) target = matchedLoc;
                    } else if (takeMatch) {
                        actionType = "take";
                        target = takeMatch[1].trim();
                    } else if (searchMatch) {
                        actionType = "search";
                        target = searchMatch[1]?.trim() || "";
                    }

                    response = await performAction(session.id, {
                        action_type: actionType,
                        target,
                        message: cmd,
                        evidence: [],
                    });
                }

                processResponse(response);
            } catch (err: unknown) {
                addLog(err instanceof Error ? err.message : "Action failed", { type: "error" });
            } finally {
                setActionLoading(false);
                setLoadingContext("Processing...");
            }
        },
        [session, scenario, addLog, processResponse]
    );

    // ── Move to location ────────────────────────────────────────────
    const handleMoveToLocation = useCallback(
        (location: string) => {
            handleCommand(`go to ${location}`);
        },
        [handleCommand]
    );

    // ── Present evidence to character ──────────────────────────────
    const handlePresentEvidence = useCallback(
        async (characterName: string) => {
            if (!session) return;
            const inventory = session.player_state.inventory;
            if (inventory.length === 0) {
                addLog("You have no evidence to present.", { type: "error" });
                return;
            }

            setActionLoading(true);
            setLoadingContext(`Presenting evidence to ${characterName}...`);
            addLog(`Present evidence to ${characterName}: ${inventory.join(", ")}`, { isAction: true });

            try {
                const response = await presentEvidence(session.id, characterName, inventory);
                processResponse(response);
            } catch (err: unknown) {
                addLog(err instanceof Error ? err.message : "Failed to present evidence", { type: "error" });
            } finally {
                setActionLoading(false);
                setLoadingContext("Processing...");
            }
        },
        [session, addLog, processResponse]
    );

    // ── Connect clues ───────────────────────────────────────────────
    const handleConnectClues = useCallback(
        async (selectedClues: string[], reasoning: string) => {
            if (!session) return;
            setActionLoading(true);
            setLoadingContext("Epiphany Engine evaluating...");
            addLog(`Connecting clues: ${selectedClues.join(" + ")}`, { isAction: true });

            try {
                const response = await connectClues(session.id, selectedClues, reasoning);
                processResponse(response);
            } catch (err: unknown) {
                addLog(err instanceof Error ? err.message : "Failed to connect clues", { type: "error" });
            } finally {
                setActionLoading(false);
                setLoadingContext("Processing...");
            }
        },
        [session, addLog, processResponse]
    );

    // ── Accusation ──────────────────────────────────────────────────
    const handleAccuse = useCallback(
        async (suspect: string, weapon: string, motive: string) => {
            if (!session) return;
            setAccusationLoading(true);

            try {
                const response = await accuseCase(session.id, { suspect, weapon, motive });
                if (response.accusation_result) {
                    setAccusationResult(response.accusation_result);
                    if (response.accusation_result.correct) {
                        setSession((prev) => prev ? { ...prev, is_complete: true, outcome: "solved" } : prev);
                    }
                }
                addLog(response.narrative, { isHighlighted: true });
            } catch (err: unknown) {
                addLog(err instanceof Error ? err.message : "Accusation failed", { type: "error" });
            } finally {
                setAccusationLoading(false);
            }
        },
        [session, addLog]
    );

    // ── Derived state ──────────────────────────────────────────────
    const playerState = session?.player_state;
    const currentLocation = playerState?.current_location;
    const currentPhaseIdx = playerState?.current_phase ?? 0;
    const currentPhase = scenario?.phases[currentPhaseIdx];
    const unlockedLocations = currentPhase?.unlocked_locations || [];
    const unlockedCharacters = currentPhase?.unlocked_characters || [];

    // Fetch scene image when location changes
    useEffect(() => {
        let mounted = true;
        if (scenarioId && currentLocation) {
            setSceneImageUrl(undefined); // clear old image
            fetch(`${BACKEND_URL}/scenes/${scenarioId}/generate?location_name=${encodeURIComponent(currentLocation)}`, { method: "POST" })
                .then(res => res.json())
                .then(data => {
                    if (mounted && data.image_url) {
                        setSceneImageUrl(`${BACKEND_URL}${data.image_url}`);
                    }
                })
                .catch(err => console.error("Failed to fetch scene image", err));
        }
        return () => { mounted = false; };
    }, [scenarioId, currentLocation]);

    const formatTime = (minutes: number) => {
        const h = Math.floor(minutes / 60);
        const m = Math.floor(minutes % 60);
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} PM`;
    };

    // Build clue items for deduction board
    const clueItems = [
        ...(playerState?.epiphanies || []).map((e) => ({
            name: e.length > 30 ? e.slice(0, 30) + "…" : e,
            description: e,
            type: "epiphany" as const,
        })),
        ...(playerState?.clues || []).map((c) => ({
            name: c.length > 30 ? c.slice(0, 30) + "…" : c,
            description: c,
            type: "clue" as const,
        })),
    ];

    // Characters at current location with full info
    const charactersInRoom = unlockedCharacters
        .filter((name) => {
            const char = scenario?.characters[name];
            if (!char) return false;
            // Show characters that are at the player's current location in this phase
            return true; // Let's show all unlocked characters for now — the backend handles location filtering
        })
        .map((name) => {
            const charState = session?.character_states[name];
            const char = scenario?.characters[name];
            return {
                name,
                mood: char?.role || "Unknown",
                suspicion: charState?.suspicion_meter ?? 0,
                isBroken: charState?.is_broken ?? false,
            };
        });

    // Dynamic quick actions
    const quickActions: string[] = [];
    quickActions.push("Search room");
    if (unlockedCharacters.length > 0) {
        quickActions.push(...unlockedCharacters.slice(0, 2).map((c) => `Talk to ${c}`));
    }
    const otherLocations = unlockedLocations.filter((l) => l !== playerState?.current_location);
    if (otherLocations.length > 0) {
        quickActions.push(`Go to ${otherLocations[0]}`);
    }

    const objectiveProgress = playerState
        ? Math.min(100, Math.round((((playerState.clues?.length || 0) % 5) / 5) * 100))
        : 0;

    // All character names for accusation
    const allCharacters = scenario ? Object.keys(scenario.characters) : [];

    // ── Loading ────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center font-display">
                <div className="text-center">
                    <span className="material-symbols-outlined text-6xl text-primary animate-spin">progress_activity</span>
                    <p className="mt-4 text-lg text-text-secondary">Connecting to Mistry Engine…</p>
                </div>
            </div>
        );
    }

    if (error && !session) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center font-display">
                <div className="text-center max-w-md">
                    <span className="material-symbols-outlined text-6xl text-red-500">error</span>
                    <h2 className="text-xl font-bold text-white mt-4">Backend Unavailable</h2>
                    <p className="text-text-secondary mt-2">{error}</p>
                    <p className="text-text-secondary/60 text-sm mt-4">
                        Start the backend: <code className="bg-surface-dark px-2 py-0.5 rounded text-primary">cd backend && uvicorn app.main:app --reload</code>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-background-dark font-display text-slate-100">
            <GameHeader
                sessionTime={formatTime(playerState?.elapsed_minutes || 0)}
                scenarioTitle={scenario?.title}
            />

            <main className="flex-1 grid grid-cols-12 gap-0 overflow-hidden h-full">
                {/* Left: Deduction Board */}
                <DeductionBoard
                    clues={clueItems}
                    inventory={playerState?.inventory || []}
                    notes={playerState?.notes || ""}
                    onConnectClues={handleConnectClues}
                />

                {/* Center: Scene + Narrative */}
                <section className="col-span-6 flex flex-col min-h-0 bg-[#0d121c] relative border-r border-border-dark">
                    <SceneView
                        locationName={playerState?.current_location || "Unknown"}
                        sceneImageUrl={sceneImageUrl}
                    />
                    <NarrativeLog
                        entries={logEntries}
                        onCommand={handleCommand}
                        quickActions={quickActions}
                        loading={actionLoading}
                        loadingContext={loadingContext}
                    />
                </section>

                {/* Right: Status Panel */}
                <StatusPanel
                    objective={currentPhase?.name || "Investigate the scene"}
                    objectiveText={currentPhase?.objective}
                    objectiveProgress={objectiveProgress}
                    inventory={playerState?.inventory || []}
                    charactersInRoom={charactersInRoom}
                    currentLocation={playerState?.current_location || "Unknown"}
                    unlockedLocations={unlockedLocations}
                    onTalkToCharacter={(name) => handleCommand(`talk to ${name}`)}
                    onPresentEvidence={handlePresentEvidence}
                    onMoveToLocation={handleMoveToLocation}
                    onSolveCase={() => setShowAccusation(true)}
                    phaseName={currentPhase?.name}
                />
            </main>

            {/* Overlays */}
            <ClueToast toasts={toasts} onDismiss={dismissToast} />

            <PhaseTransition
                isOpen={showPhaseTransition}
                phaseName={phaseTransitionData?.name || ""}
                phaseObjective={phaseTransitionData?.objective || ""}
                phaseNumber={phaseTransitionData?.number || 0}
                unlockedLocations={phaseTransitionData?.locations}
                unlockedCharacters={phaseTransitionData?.characters}
                onContinue={() => setShowPhaseTransition(false)}
            />

            <AccusationModal
                isOpen={showAccusation}
                onClose={() => {
                    setShowAccusation(false);
                    setAccusationResult(null);
                }}
                onSubmit={handleAccuse}
                characters={allCharacters}
                loading={accusationLoading}
                result={accusationResult}
            />
        </div>
    );
}
