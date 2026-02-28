"use client";

import { useState, useEffect, useMemo } from "react";
import AppHeader from "@/components/AppHeader";
import CaseCard from "@/components/CaseCard";
import { listScenarios, type ScenarioSummary } from "@/lib/api";

export default function HomePage() {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // Added error state

  useEffect(() => {
    async function load() {
      try {
        const data = await listScenarios();
        setScenarios(data);
      } catch (e) {
        console.error("Failed to load scenarios:", e);
        setError(true);
        // Fallback: show demo data if API fails and we don't want to show an error page
        setScenarios([
          {
            id: "the_crooked_man",
            title: "The Crooked Man",
            description: "A new grim tale awaits in the fog-laden streets of London. The body was found in a locked room, but the key was missing. Can you solve the mystery before the clock strikes twelve?",
            victim: "Colonel Watson Morrison",
            difficulty: "medium",
            phase_count: 4,
          },
        ]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const activeCases = scenarios.filter(s => s.progress_percent && s.progress_percent > 0 && !s.is_complete);
  const availableCases = scenarios.filter(s => !activeCases.includes(s));
  const featured = scenarios[0];

  const groupedCases = useMemo(() => {
    const groups: Record<string, typeof availableCases> = {};
    for (const c of availableCases) {
      const author = c.author || "Other Mysteries";
      if (!groups[author]) groups[author] = [];
      groups[author].push(c);
    }
    // Sort authors alphabetically
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [availableCases]);

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden bg-background-dark text-slate-100 font-display">
      <AppHeader activeTab="home" />

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {/* Hero Section */}
          {featured && (
            <div className="w-full relative">
              <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-transparent to-transparent z-10 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-10 pointer-events-none" />
              <div className="relative min-h-[560px] flex flex-col justify-end p-8 md:p-16 bg-gradient-to-br from-[#0a0f1e] via-[#101622] to-[#192233]">
                <div className="relative z-20 max-w-2xl flex flex-col gap-4 animate-fade-in-up">
                  <div className="flex items-center gap-3 mb-2">
                    {featured.progress_percent && featured.progress_percent > 0 ? (
                      <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                        In Progress ({Math.round(featured.progress_percent)}%)
                      </span>
                    ) : (
                      <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                        New Release
                      </span>
                    )}
                    <span className="text-white/80 text-sm font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-yellow-400">star</span>
                      4.9 Rating
                    </span>
                  </div>
                  <h1 className="text-white text-5xl md:text-7xl font-black leading-tight tracking-tight drop-shadow-lg">
                    {featured.title}
                  </h1>
                  <p className="text-slate-200 text-lg md:text-xl font-normal leading-relaxed drop-shadow-md max-w-xl">
                    {featured.description}
                  </p>
                  <div className="flex flex-wrap gap-4 mt-6">
                    <a
                      href={`/case/${featured.id}`}
                      className="flex items-center justify-center rounded-lg h-12 px-8 bg-primary hover:bg-primary/90 text-white text-base font-bold transition-all shadow-lg shadow-primary/25 group"
                    >
                      <span className="material-symbols-outlined mr-2 group-hover:animate-pulse">
                        {featured.progress_percent && featured.progress_percent > 0 ? "resume" : "visibility"}
                      </span>
                      {featured.progress_percent && featured.progress_percent > 0 && !featured.is_complete ? "Continue Investigation" : "Start Investigation"}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="px-8 pb-12 -mt-10 relative z-20">

            {/* In Progress */}
            {activeCases.length > 0 && (
              <div className="mb-12 border-b border-white/5 pb-12">
                <div className="flex justify-between items-end mb-4 px-2">
                  <h2 className="text-white text-2xl font-bold tracking-tight flex items-center gap-2">
                    <span className="material-symbols-outlined text-yellow-500">pending_actions</span>
                    Active Investigations
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {activeCases.map((s) => (
                    <CaseCard
                      key={s.id}
                      id={s.id}
                      title={s.title}
                      description={s.description}
                      difficulty={s.difficulty}
                      progressPercent={s.progress_percent}
                      isComplete={s.is_complete}
                      author={`${s.phase_count} phases`}
                      solvedPercent={s.global_clear_rate}
                      imageUrl={`/scenes/${s.id}_hero.png`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Available Cases */}
            <div className="mb-12">
              <div className="flex justify-between items-end mb-4 px-2">
                <h2 className="text-white text-2xl font-bold tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">local_library</span>
                  Case Studio Gallery
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-surface-dark rounded-xl overflow-hidden border border-slate-800 animate-pulse"
                    >
                      <div className="aspect-video bg-border-dark" />
                      <div className="p-4 space-y-2">
                        <div className="h-5 bg-border-dark rounded w-3/4" />
                        <div className="h-3 bg-border-dark rounded w-full" />
                        <div className="h-3 bg-border-dark rounded w-1/2" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-1 sm:col-span-2 lg:col-span-4 flex flex-col gap-10">
                    {groupedCases.map(([author, cases]) => (
                      <div key={author} className="space-y-4">
                        <h3 className="text-2xl font-semibold text-slate-200 border-b border-white/10 pb-2">
                          {author}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                          {cases.map((s) => (
                            <CaseCard
                              key={s.id}
                              id={s.id}
                              title={s.title}
                              description={s.description}
                              difficulty={s.difficulty}
                              progressPercent={s.progress_percent}
                              isComplete={s.is_complete}
                              author={`${s.phase_count} phases`}
                              imageUrl={`/scenes/${s.id}_hero.png`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="hidden xl:flex flex-col w-80 border-l border-slate-800 bg-background-dark p-6 overflow-y-auto">
          {/* Friend Activity */}
          <div className="mb-8">
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">group</span>
              Friend Activity
            </h3>
            <div className="flex flex-col gap-4">
              {[
                { name: "Dr. Watson", action: "Started", case: "Study in Scarlet", time: "2 mins ago", dot: "bg-green-500" },
                { name: "Miss Marple", action: "Solved", case: "The ABC Murders", time: "1 hour ago", dot: "bg-yellow-500" },
                { name: "Poirot_Fan", action: "Rated ★★★★★ for", case: "Orient Express", time: "5 hours ago", dot: "bg-slate-500" },
              ].map((f) => (
                <div key={f.name} className="flex items-start gap-3">
                  <div className="relative">
                    <div className="size-8 rounded-full bg-surface-dark border border-border-dark flex items-center justify-center">
                      <span className="material-symbols-outlined text-text-secondary text-sm">person</span>
                    </div>
                    <div className={`absolute bottom-0 right-0 size-2.5 ${f.dot} border-2 border-background-dark rounded-full`} />
                  </div>
                  <div className="text-sm">
                    <p className="text-white font-medium">{f.name}</p>
                    <p className="text-slate-400 text-xs">
                      {f.action} <span className="text-primary hover:underline cursor-pointer">{f.case}</span>
                    </p>
                    <p className="text-slate-500 text-[10px] mt-1">{f.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Global Records */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-yellow-500">emoji_events</span>
              Global Records
            </h3>
            <div className="bg-surface-dark rounded-xl p-3 border border-slate-800 flex flex-col gap-3">
              {[
                { rank: "1", name: "Sherlock_AI", cases: "200 Cases", color: "text-yellow-500" },
                { rank: "2", name: "NoirDetect", cases: "189 Cases", color: "text-slate-400" },
                { rank: "3", name: "Enola_H", cases: "154 Cases", color: "text-orange-700" },
              ].map((r, i, arr) => (
                <div
                  key={r.name}
                  className={`flex items-center justify-between ${i < arr.length - 1 ? "border-b border-slate-700 pb-2" : ""
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`${r.color} font-black text-lg`}>{r.rank}</span>
                    <div className="flex flex-col">
                      <span className="text-white text-sm font-bold">{r.name}</span>
                      <span className="text-[10px] text-slate-500">{r.cases} Solved</span>
                    </div>
                  </div>
                  {i === 0 && (
                    <span className="material-symbols-outlined text-yellow-500 text-sm">workspace_premium</span>
                  )}
                </div>
              ))}
            </div>
            <button className="mt-4 w-full py-2 text-xs font-bold text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors">
              View Full Leaderboard
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
