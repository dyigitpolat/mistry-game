"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { generateScenario, type GenerateScenarioRequest } from "@/lib/api";

type CharacterInput = {
  type: "Suspect" | "Assistant";
  name: string;
  role_archetype: string;
  starting_location: string;
  persona_and_secret: string;
};

type PhaseInput = {
  objective: string;
  required_twists_or_discoveries: string;
  logic_complexity: "Low" | "Medium" | "High";
};

const STEPS = [
  { label: "Foundation", icon: "foundation" },
  { label: "Cast", icon: "groups" },
  { label: "Culprit & Evidence", icon: "gavel" },
  { label: "Story Structure", icon: "timeline" },
  { label: "Review & Generate", icon: "auto_awesome" },
];

const GENRES = [
  "Murder Mystery",
  "Thriller",
  "Noir",
  "Cozy Mystery",
  "Locked Room",
  "Espionage",
  "Heist Gone Wrong",
  "Cold Case",
];

const TIME_PERIODS = [
  "Victorian Era (1837–1901)",
  "Roaring Twenties (1920s)",
  "Golden Age (1930s–1940s)",
  "Post-War (1950s–1960s)",
  "Modern Day (2020s)",
  "Near Future (2040s)",
  "Medieval",
  "Custom",
];

export default function CreateCasePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Foundation
  const [caseTitle, setCaseTitle] = useState("");
  const [timePeriod, setTimePeriod] = useState("");
  const [customTimePeriod, setCustomTimePeriod] = useState("");
  const [settingLocation, setSettingLocation] = useState("");
  const [settingDescription, setSettingDescription] = useState("");
  const [genre, setGenre] = useState("");
  const [crimeSummary, setCrimeSummary] = useState("");

  // Cast
  const [characters, setCharacters] = useState<CharacterInput[]>([
    { type: "Suspect", name: "", role_archetype: "", starting_location: "", persona_and_secret: "" },
  ]);

  // Culprit & Evidence
  const [culprit, setCulprit] = useState("");
  const [motive, setMotive] = useState("");
  const [criticalEvidence, setCriticalEvidence] = useState<string[]>([""]);

  // Story Structure
  const [storyLength, setStoryLength] = useState<"short" | "med" | "long">("med");
  const [phases, setPhases] = useState<PhaseInput[]>([
    { objective: "", required_twists_or_discoveries: "", logic_complexity: "Low" },
  ]);

  const addCharacter = useCallback(() => {
    setCharacters((prev) => [
      ...prev,
      { type: "Suspect", name: "", role_archetype: "", starting_location: "", persona_and_secret: "" },
    ]);
  }, []);

  const removeCharacter = useCallback((idx: number) => {
    setCharacters((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateCharacter = useCallback((idx: number, field: keyof CharacterInput, value: string) => {
    setCharacters((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  }, []);

  const addPhase = useCallback(() => {
    setPhases((prev) => [
      ...prev,
      { objective: "", required_twists_or_discoveries: "", logic_complexity: "Medium" as const },
    ]);
  }, []);

  const removePhase = useCallback((idx: number) => {
    setPhases((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updatePhase = useCallback((idx: number, field: keyof PhaseInput, value: string) => {
    setPhases((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }, []);

  const addEvidence = useCallback(() => {
    setCriticalEvidence((prev) => [...prev, ""]);
  }, []);

  const removeEvidence = useCallback((idx: number) => {
    setCriticalEvidence((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateEvidence = useCallback((idx: number, value: string) => {
    setCriticalEvidence((prev) => prev.map((e, i) => (i === idx ? value : e)));
  }, []);

  const resolvedTimePeriod = timePeriod === "Custom" ? customTimePeriod : timePeriod;

  const suspectNames = characters.filter((c) => c.type === "Suspect" && c.name.trim()).map((c) => c.name);

  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return caseTitle.trim().length > 0 && genre.length > 0 && crimeSummary.trim().length > 0;
      case 1:
        return characters.length > 0 && characters.every((c) => c.name.trim().length > 0);
      case 2:
        return culprit.trim().length > 0 && motive.trim().length > 0;
      case 3:
        return phases.length > 0 && phases.every((p) => p.objective.trim().length > 0);
      default:
        return true;
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    const payload: GenerateScenarioRequest = {
      case_title: caseTitle,
      time_period: resolvedTimePeriod || undefined,
      setting_location: settingLocation || undefined,
      setting_description: settingDescription || undefined,
      genre,
      crime_summary: crimeSummary,
      characters: characters.filter((c) => c.name.trim()),
      culprit,
      motive,
      critical_evidence: criticalEvidence.filter((e) => e.trim()),
      story_length: storyLength,
      story_phases: phases.filter((p) => p.objective.trim()),
    };

    try {
      const result = await generateScenario(payload);
      router.push(`/case/${result.scenario_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed. Please try again.");
      setGenerating(false);
    }
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden bg-background-dark text-slate-100 font-display">
      <AppHeader activeTab="cases" />

      <main className="flex-1 overflow-y-auto">
        {/* Hero Banner */}
        <div className="relative px-8 md:px-16 pt-10 pb-8 bg-gradient-to-br from-primary/10 via-background-dark to-background-dark border-b border-slate-800">
          <div className="max-w-4xl">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-primary text-3xl">auto_awesome</span>
              <h1 className="text-white text-3xl md:text-4xl font-black tracking-tight">
                AI Weaver Case Generator
              </h1>
            </div>
            <p className="text-slate-400 text-lg max-w-2xl">
              Craft your own mystery case. Define the foundation, cast your characters, plant the evidence, 
              and let the AI weave it into a fully playable investigation.
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-8 py-10">
          {/* Stepper */}
          <div className="flex items-center gap-1 mb-10">
            {STEPS.map((s, i) => (
              <div key={s.label} className="flex items-center flex-1">
                <button
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium w-full
                    ${i === step
                      ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                      : i < step
                        ? "bg-surface-dark text-green-400 hover:bg-surface-dark/80 cursor-pointer"
                        : "bg-surface-dark/50 text-slate-600 cursor-not-allowed"
                    }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {i < step ? "check_circle" : s.icon}
                  </span>
                  <span className="hidden lg:inline truncate">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`w-6 h-px mx-1 shrink-0 ${i < step ? "bg-green-400/50" : "bg-slate-700"}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 0: Foundation */}
          {step === 0 && (
            <div className="space-y-6 animate-fade-in">
              <SectionTitle icon="edit" title="Case Foundation" subtitle="Set the stage for your mystery" />

              <FieldGroup label="Case Title" required>
                <input
                  value={caseTitle}
                  onChange={(e) => setCaseTitle(e.target.value)}
                  placeholder="e.g. The Vanishing at Hollowmere"
                  className="input-field"
                />
              </FieldGroup>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FieldGroup label="Genre" required>
                  <div className="flex flex-wrap gap-2">
                    {GENRES.map((g) => (
                      <button
                        key={g}
                        onClick={() => setGenre(g)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border
                          ${genre === g
                            ? "bg-primary/20 text-primary border-primary/40"
                            : "bg-surface-dark text-slate-400 border-slate-700 hover:border-slate-500"
                          }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </FieldGroup>

                <FieldGroup label="Time Period">
                  <select
                    value={timePeriod}
                    onChange={(e) => setTimePeriod(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select a time period...</option>
                    {TIME_PERIODS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {timePeriod === "Custom" && (
                    <input
                      value={customTimePeriod}
                      onChange={(e) => setCustomTimePeriod(e.target.value)}
                      placeholder="e.g. Renaissance Italy (1490s)"
                      className="input-field mt-2"
                    />
                  )}
                </FieldGroup>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FieldGroup label="Setting / Location">
                  <input
                    value={settingLocation}
                    onChange={(e) => setSettingLocation(e.target.value)}
                    placeholder="e.g. A remote Scottish castle"
                    className="input-field"
                  />
                </FieldGroup>

                <FieldGroup label="Setting Atmosphere">
                  <input
                    value={settingDescription}
                    onChange={(e) => setSettingDescription(e.target.value)}
                    placeholder="e.g. Fog-covered, isolated, eerie silence..."
                    className="input-field"
                  />
                </FieldGroup>
              </div>

              <FieldGroup label="Crime Summary" required>
                <textarea
                  value={crimeSummary}
                  onChange={(e) => setCrimeSummary(e.target.value)}
                  placeholder="Describe the crime to be investigated. What happened? Who is the victim? What makes it mysterious?"
                  rows={4}
                  className="input-field resize-none"
                />
              </FieldGroup>
            </div>
          )}

          {/* Step 1: Cast */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <SectionTitle icon="groups" title="Cast of Characters" subtitle="Define the suspects, witnesses, and allies" />

              {characters.map((char, idx) => (
                <div key={idx} className="bg-surface-dark rounded-xl border border-slate-800 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${
                        char.type === "Suspect" ? "bg-red-500/15 text-red-400" : "bg-blue-500/15 text-blue-400"
                      }`}>
                        {char.type}
                      </span>
                      <span className="text-white font-bold">Character {idx + 1}</span>
                    </div>
                    {characters.length > 1 && (
                      <button
                        onClick={() => removeCharacter(idx)}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FieldGroup label="Name" required>
                      <input
                        value={char.name}
                        onChange={(e) => updateCharacter(idx, "name", e.target.value)}
                        placeholder="e.g. Lord Ashworth"
                        className="input-field"
                      />
                    </FieldGroup>

                    <FieldGroup label="Type">
                      <div className="flex gap-2">
                        {(["Suspect", "Assistant"] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => updateCharacter(idx, "type", t)}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all border
                              ${char.type === t
                                ? t === "Suspect"
                                  ? "bg-red-500/15 text-red-400 border-red-500/30"
                                  : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                                : "bg-background-dark text-slate-400 border-slate-700 hover:border-slate-500"
                              }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </FieldGroup>

                    <FieldGroup label="Role / Archetype">
                      <input
                        value={char.role_archetype}
                        onChange={(e) => updateCharacter(idx, "role_archetype", e.target.value)}
                        placeholder="e.g. Butler, Rival scientist, Jealous partner"
                        className="input-field"
                      />
                    </FieldGroup>

                    <FieldGroup label="Starting Location">
                      <input
                        value={char.starting_location}
                        onChange={(e) => updateCharacter(idx, "starting_location", e.target.value)}
                        placeholder="e.g. The Library"
                        className="input-field"
                      />
                    </FieldGroup>
                  </div>

                  <FieldGroup label="Persona & Secret">
                    <textarea
                      value={char.persona_and_secret}
                      onChange={(e) => updateCharacter(idx, "persona_and_secret", e.target.value)}
                      placeholder="Describe their personality, backstory, and any secrets they hold..."
                      rows={2}
                      className="input-field resize-none"
                    />
                  </FieldGroup>
                </div>
              ))}

              <button
                onClick={addCharacter}
                className="w-full py-3 border-2 border-dashed border-slate-700 hover:border-primary/50 rounded-xl text-slate-400 hover:text-primary font-medium transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">person_add</span>
                Add Character
              </button>
            </div>
          )}

          {/* Step 2: Culprit & Evidence */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <SectionTitle icon="gavel" title="Culprit & Evidence" subtitle="Designate who did it and what proves it" />

              <FieldGroup label="Culprit" required>
                {suspectNames.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {suspectNames.map((name) => (
                      <button
                        key={name}
                        onClick={() => setCulprit(name)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border
                          ${culprit === name
                            ? "bg-red-500/20 text-red-400 border-red-500/40"
                            : "bg-surface-dark text-slate-400 border-slate-700 hover:border-slate-500"
                          }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    value={culprit}
                    onChange={(e) => setCulprit(e.target.value)}
                    placeholder="Enter the culprit's name"
                    className="input-field"
                  />
                )}
              </FieldGroup>

              <FieldGroup label="Motive" required>
                <textarea
                  value={motive}
                  onChange={(e) => setMotive(e.target.value)}
                  placeholder="Why did they do it? Describe the culprit's motive in detail..."
                  rows={3}
                  className="input-field resize-none"
                />
              </FieldGroup>

              <FieldGroup label="Critical Evidence">
                <div className="space-y-2">
                  {criticalEvidence.map((ev, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        value={ev}
                        onChange={(e) => updateEvidence(idx, e.target.value)}
                        placeholder={`Evidence item ${idx + 1}...`}
                        className="input-field flex-1"
                      />
                      {criticalEvidence.length > 1 && (
                        <button
                          onClick={() => removeEvidence(idx)}
                          className="text-slate-500 hover:text-red-400 transition-colors px-2"
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addEvidence}
                    className="text-sm text-slate-400 hover:text-primary font-medium flex items-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Add evidence item
                  </button>
                </div>
              </FieldGroup>
            </div>
          )}

          {/* Step 3: Story Structure */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <SectionTitle icon="timeline" title="Story Structure" subtitle="Define the pacing and investigative phases" />

              <FieldGroup label="Story Length">
                <div className="flex gap-3">
                  {([
                    { value: "short", label: "Short", desc: "500–1,000 words" },
                    { value: "med", label: "Medium", desc: "1,000–2,000 words" },
                    { value: "long", label: "Long", desc: "2,000–5,000 words" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setStoryLength(opt.value)}
                      className={`flex-1 px-4 py-3 rounded-xl text-center transition-all border
                        ${storyLength === opt.value
                          ? "bg-primary/15 text-primary border-primary/30"
                          : "bg-surface-dark text-slate-400 border-slate-700 hover:border-slate-500"
                        }`}
                    >
                      <div className="font-bold text-sm">{opt.label}</div>
                      <div className="text-[11px] mt-0.5 opacity-70">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </FieldGroup>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-white font-bold text-sm">Investigation Phases</label>
                </div>
                <div className="space-y-4">
                  {phases.map((phase, idx) => (
                    <div key={idx} className="bg-surface-dark rounded-xl border border-slate-800 p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">
                          Phase {idx + 1}
                        </span>
                        {phases.length > 1 && (
                          <button
                            onClick={() => removePhase(idx)}
                            className="text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        )}
                      </div>

                      <FieldGroup label="Objective" required>
                        <input
                          value={phase.objective}
                          onChange={(e) => updatePhase(idx, "objective", e.target.value)}
                          placeholder="e.g. Establish cause of death by examining the body"
                          className="input-field"
                        />
                      </FieldGroup>

                      <FieldGroup label="Key Twist / Discovery">
                        <input
                          value={phase.required_twists_or_discoveries}
                          onChange={(e) => updatePhase(idx, "required_twists_or_discoveries", e.target.value)}
                          placeholder="e.g. Discover the victim was poisoned, not stabbed"
                          className="input-field"
                        />
                      </FieldGroup>

                      <FieldGroup label="Logic Complexity">
                        <div className="flex gap-2">
                          {(["Low", "Medium", "High"] as const).map((level) => (
                            <button
                              key={level}
                              onClick={() => updatePhase(idx, "logic_complexity", level)}
                              className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border
                                ${phase.logic_complexity === level
                                  ? level === "Low"
                                    ? "bg-green-500/15 text-green-400 border-green-500/30"
                                    : level === "Medium"
                                      ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                                      : "bg-red-500/15 text-red-400 border-red-500/30"
                                  : "bg-background-dark text-slate-400 border-slate-700 hover:border-slate-500"
                                }`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                      </FieldGroup>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addPhase}
                  className="w-full mt-4 py-3 border-2 border-dashed border-slate-700 hover:border-primary/50 rounded-xl text-slate-400 hover:text-primary font-medium transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[20px]">add_circle</span>
                  Add Phase
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review & Generate */}
          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              <SectionTitle icon="auto_awesome" title="Review & Generate" subtitle="Confirm your case details before AI generation" />

              {/* Foundation Summary */}
              <ReviewSection title="Foundation">
                <ReviewRow label="Title" value={caseTitle} />
                <ReviewRow label="Genre" value={genre} />
                <ReviewRow label="Time Period" value={resolvedTimePeriod || "Not specified"} />
                <ReviewRow label="Setting" value={settingLocation || "Not specified"} />
                <ReviewRow label="Atmosphere" value={settingDescription || "Not specified"} />
                <ReviewRow label="Crime Summary" value={crimeSummary} />
              </ReviewSection>

              {/* Cast Summary */}
              <ReviewSection title={`Cast (${characters.filter(c => c.name.trim()).length} characters)`}>
                {characters.filter((c) => c.name.trim()).map((c, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      c.type === "Suspect" ? "bg-red-500/15 text-red-400" : "bg-blue-500/15 text-blue-400"
                    }`}>
                      {c.type}
                    </span>
                    <span className="text-white font-medium">{c.name}</span>
                    {c.role_archetype && <span className="text-slate-500 text-sm">({c.role_archetype})</span>}
                  </div>
                ))}
              </ReviewSection>

              {/* Culprit Summary */}
              <ReviewSection title="Culprit & Evidence">
                <ReviewRow label="Culprit" value={culprit} highlight />
                <ReviewRow label="Motive" value={motive} />
                <ReviewRow label="Evidence" value={criticalEvidence.filter((e) => e.trim()).join(", ") || "None specified"} />
              </ReviewSection>

              {/* Structure Summary */}
              <ReviewSection title="Story Structure">
                <ReviewRow label="Length" value={storyLength === "short" ? "Short (500–1K)" : storyLength === "med" ? "Medium (1K–2K)" : "Long (2K–5K)"} />
                <ReviewRow label="Phases" value={`${phases.filter((p) => p.objective.trim()).length} phases`} />
                {phases.filter((p) => p.objective.trim()).map((p, i) => (
                  <div key={i} className="pl-4 py-1 text-sm text-slate-400 border-l-2 border-slate-700 ml-2">
                    <span className="text-primary font-medium">Phase {i + 1}:</span> {p.objective}
                  </div>
                ))}
              </ReviewSection>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm flex items-start gap-3">
                  <span className="material-symbols-outlined text-[20px] mt-0.5">error</span>
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-slate-800">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-slate-400 hover:text-white bg-surface-dark border border-slate-700 hover:border-slate-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Continue
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-70 disabled:cursor-wait"
              >
                {generating ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    Generating Case...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                    Generate Case
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Full-screen generating overlay */}
      {generating && (
        <div className="fixed inset-0 z-50 bg-background-dark/90 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center space-y-6 max-w-md">
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
              <span className="material-symbols-outlined text-primary text-3xl absolute inset-0 flex items-center justify-center">
                auto_awesome
              </span>
            </div>
            <div>
              <h2 className="text-white text-2xl font-black mb-2">Weaving Your Mystery</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                The AI is crafting your story, building locations, planting clues, and constructing the 
                full game graph. This may take a minute or two...
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-primary text-xs font-bold">
              <span className="material-symbols-outlined text-[14px] animate-pulse">fiber_manual_record</span>
              Processing
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-white text-xl font-bold flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">{icon}</span>
        {title}
      </h2>
      <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
    </div>
  );
}

function FieldGroup({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-bold text-slate-300 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-dark rounded-xl border border-slate-800 p-5">
      <h3 className="text-white font-bold text-sm mb-3 pb-2 border-b border-slate-700">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="text-slate-500 w-28 shrink-0">{label}</span>
      <span className={highlight ? "text-red-400 font-bold" : "text-slate-300"}>{value}</span>
    </div>
  );
}
