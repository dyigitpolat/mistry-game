"use client";

import { useState, useEffect } from "react";
import AppHeader from "@/components/AppHeader";
import CaseCard from "@/components/CaseCard";
import { listScenarios, type ScenarioSummary } from "@/lib/api";

export default function HomePage() {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await listScenarios();
        setScenarios(data);
      } catch {
        // Fallback: show demo data
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

  const featured = scenarios[0];

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
                    <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                      New Release
                    </span>
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
                      href={`/game/${featured.id}`}
                      className="flex items-center justify-center rounded-lg h-12 px-8 bg-primary hover:bg-primary/90 text-white text-base font-bold transition-all shadow-lg shadow-primary/25 group"
                    >
                      <span className="material-symbols-outlined mr-2 group-hover:animate-pulse">visibility</span>
                      Start Investigation
                    </a>
                    <button className="flex items-center justify-center rounded-lg h-12 px-6 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white text-base font-bold transition-all border border-white/20">
                      <span className="material-symbols-outlined mr-2">play_arrow</span>
                      View Trailer
                    </button>
                    <button className="flex items-center justify-center rounded-lg h-12 w-12 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white transition-all border border-white/20">
                      <span className="material-symbols-outlined">add</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="px-8 pb-12 -mt-10 relative z-20">
            {/* Available Cases */}
            <div className="mb-12">
              <div className="flex justify-between items-end mb-4 px-2">
                <h2 className="text-white text-2xl font-bold tracking-tight">
                  Sherlock Holmes Classics
                </h2>
                <a className="text-primary text-sm font-bold hover:underline" href="#">
                  View All
                </a>
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
                  scenarios.map((s) => (
                    <CaseCard
                      key={s.id}
                      id={s.id}
                      title={s.title}
                      description={s.description}
                      difficulty={s.difficulty}
                      solvedPercent={42}
                      author={`${s.phase_count} phases`}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Agatha Christie Collection (static showcase) */}
            <div className="mb-12">
              <div className="flex justify-between items-end mb-4 px-2">
                <h2 className="text-white text-2xl font-bold tracking-tight">
                  Agatha Christie Collection
                </h2>
                <a className="text-primary text-sm font-bold hover:underline" href="#">
                  View All
                </a>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { title: "Murder on the Orient Express", desc: "A lavish trip through Europe quickly unfolds into a race against time.", diff: "Medium", solved: 91 },
                  { title: "Death on the Nile", desc: "The tranquillity of a cruise along the Nile is shattered by murder.", diff: "Easy", solved: 85 },
                  { title: "The Murder at the Vicarage", desc: "Miss Marple's first case involves the murder of a colonel.", diff: "Medium", solved: 79 },
                  { title: "And Then There Were None", desc: "Ten strangers are lured to an island mansion.", diff: "Hard", solved: 70 },
                ].map((c) => (
                  <CaseCard
                    key={c.title}
                    id="#"
                    title={c.title}
                    description={c.desc}
                    difficulty={c.diff}
                    solvedPercent={c.solved}
                    author="A. Christie"
                  />
                ))}
              </div>
            </div>

            {/* Trending Community Cases */}
            <div className="mb-12">
              <div className="flex justify-between items-end mb-4 px-2">
                <h2 className="text-white text-2xl font-bold tracking-tight">
                  Trending Community Cases
                </h2>
                <div className="flex gap-2">
                  <button className="size-8 rounded-full border border-slate-700 flex items-center justify-center hover:bg-slate-800 text-white">
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>
                  <button className="size-8 rounded-full border border-slate-700 flex items-center justify-center hover:bg-slate-800 text-white">
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { title: "Silicon Valley Shadows", desc: "Corporate espionage gone wrong.", diff: "Medium", by: "@tech_noir" },
                  { title: "The Attic Whisperer", desc: "A ghost story or a murder plot?", diff: "Easy", by: "@ghost_hunter" },
                  { title: "Neon Rain", desc: "Cyberpunk noir mystery.", diff: "Hard", by: "@cyber_sleuth" },
                  { title: "Deep Blue Demise", desc: "Lost at sea, but not alone.", diff: "Medium", by: "@nautical_pi" },
                ].map((c) => (
                  <div
                    key={c.title}
                    className="bg-surface-dark p-4 rounded-xl border border-slate-800 flex gap-4 hover:bg-slate-800/80 transition-colors cursor-pointer group"
                  >
                    <div className="w-24 h-24 shrink-0 rounded-lg bg-border-dark flex items-center justify-center">
                      <span className="material-symbols-outlined text-2xl text-primary/40">visibility</span>
                    </div>
                    <div className="flex flex-col justify-between py-1 w-full min-w-0">
                      <div>
                        <h4 className="text-white font-bold text-base truncate group-hover:text-primary">
                          {c.title}
                        </h4>
                        <p className="text-slate-400 text-xs mt-1 truncate">{c.desc}</p>
                      </div>
                      <div className="flex items-center justify-between text-xs mt-2">
                        <span className={`font-bold px-2 py-0.5 rounded ${c.diff === "Easy" ? "text-green-400 bg-green-500/10" :
                          c.diff === "Hard" ? "text-red-400 bg-red-500/10" :
                            "text-primary bg-primary/10"
                          }`}>
                          {c.diff}
                        </span>
                        <span className="text-slate-400">{c.by}</span>
                      </div>
                    </div>
                  </div>
                ))}
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
