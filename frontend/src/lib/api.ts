/**
 * API client for the Mistry backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface PlayerState {
  inventory: string[];
  clues: string[];
  epiphanies: string[];
  current_location: string;
  current_phase: number;
  elapsed_minutes: number;
  notes: string;
  clue_connections: string[][];
}

export interface CharacterState {
  suspicion_meter: number;
  is_broken: boolean;
  conversation_history: { role: string; content: string }[];
}

export interface GameSession {
  id: string;
  scenario_id: string;
  user_id: string;
  player_state: PlayerState;
  character_states: Record<string, CharacterState>;
  started_at: string;
  last_action_at: string | null;
  is_complete: boolean;
  outcome: string | null;
}

export interface ActionRequest {
  action_type: string;
  target: string;
  message: string;
  evidence: string[];
}

export interface PhaseInfo {
  id: number;
  name: string;
  objective: string;
  unlocked_locations: string[];
  unlocked_characters: string[];
}

export interface AccusationResult {
  correct: boolean;
  narrative: string;
  correct_suspect?: string;
  correct_weapon?: string;
  correct_motive?: string;
}

export interface ActionResponse {
  narrative: string;
  state_updates: PlayerState | null;
  phase_advanced: boolean;
  new_phase: number | null;
  phase_info: PhaseInfo | null;
  character_reaction: string | null;
  visual_metadata_diff: Record<string, unknown> | null;
  error: string | null;
  new_clues: string[];
  new_items: string[];
  new_location: string | null;
  scene_image_url: string | null;
  accusation_result: AccusationResult | null;
  characters_in_room: string[];
}

export interface ScenarioSummary {
  id: string;
  title: string;
  description: string;
  victim: string;
  difficulty: string;
  phase_count: number;
}

export interface Phase {
  id: number;
  name: string;
  objective: string;
  unlocked_locations: string[];
  unlocked_characters: string[];
}

export interface Character {
  type: string;
  role: string;
  location: string;
  persona: string;
  suspicion_meter: number;
}

export interface Location {
  description: string;
  items: string[];
  clues: string[];
  base_ascii: string;
}

export interface Scenario {
  title: string;
  description: string;
  victim: string;
  intro_narrative: string;
  time_limit_minutes: number;
  start_time: string;
  phases: Phase[];
  locations: Record<string, Location>;
  characters: Record<string, Character>;
  difficulty: string;
}

export interface AccuseRequest {
  suspect: string;
  weapon: string;
  motive: string;
}

// ── API Functions ────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

export async function listScenarios(): Promise<ScenarioSummary[]> {
  return apiFetch("/scenarios/");
}

export async function getScenario(id: string): Promise<Scenario> {
  return apiFetch(`/scenarios/${id}`);
}

export async function startGame(
  scenarioId: string,
  userId: string = "anonymous"
): Promise<GameSession> {
  return apiFetch(`/game/start?scenario_id=${scenarioId}&user_id=${userId}`, {
    method: "POST",
  });
}

export async function getGameState(sessionId: string): Promise<GameSession> {
  return apiFetch(`/game/${sessionId}/state`);
}

export async function performAction(
  sessionId: string,
  action: ActionRequest
): Promise<ActionResponse> {
  return apiFetch(`/game/${sessionId}/action`, {
    method: "POST",
    body: JSON.stringify(action),
  });
}

export async function chatWithCharacter(
  sessionId: string,
  characterName: string,
  message: string
): Promise<ActionResponse> {
  return apiFetch(
    `/game/${sessionId}/chat?character_name=${encodeURIComponent(characterName)}&message=${encodeURIComponent(message)}`,
    { method: "POST" }
  );
}

export async function presentEvidence(
  sessionId: string,
  characterName: string,
  evidence: string[]
): Promise<ActionResponse> {
  return apiFetch(
    `/game/${sessionId}/present_evidence?character_name=${encodeURIComponent(characterName)}&evidence=${encodeURIComponent(evidence.join(","))}`,
    { method: "POST" }
  );
}

export async function connectClues(
  sessionId: string,
  clues: string[],
  reasoning: string = ""
): Promise<ActionResponse> {
  return apiFetch(
    `/game/${sessionId}/connect_clues?clues=${encodeURIComponent(clues.join(","))}&reasoning=${encodeURIComponent(reasoning)}`,
    { method: "POST" }
  );
}

export async function accuseCase(
  sessionId: string,
  accusation: AccuseRequest
): Promise<ActionResponse> {
  return apiFetch(`/game/${sessionId}/accuse`, {
    method: "POST",
    body: JSON.stringify(accusation),
  });
}

export async function getScenarioContext(
  sessionId: string
): Promise<Record<string, unknown>> {
  return apiFetch(`/game/${sessionId}/context`);
}

export async function generateSceneImage(
  scenarioId: string,
  locationName: string
): Promise<{ image_url: string; location: string }> {
  return apiFetch(
    `/scenes/${scenarioId}/generate?location_name=${encodeURIComponent(locationName)}`,
    { method: "POST" }
  );
}

export async function generateAllScenes(
  scenarioId: string
): Promise<{ scenes: Record<string, string | null> }> {
  return apiFetch(`/scenes/${scenarioId}/generate-all`, { method: "POST" });
}
