"use client";

import { useState, useEffect, useMemo } from "react";
import AppHeader from "@/components/AppHeader";
import CaseCard from "@/components/CaseCard";
import { listScenarios, generateHeroBanner, getGlobalLeaderboard, getFriendActivity, type ScenarioSummary, type GlobalLeaderboardEntry, type FriendActivity, BACKEND_URL } from "@/lib/api";

export default function HomePage() {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [leaderboard, setLeaderboard] = useState<GlobalLeaderboardEntry[]>([]);
  const [friends, setFriends] = useState<FriendActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // Added error state
  const [generatingHero, setGeneratingHero] = useState(false);
  const [heroBannerUrl, setHeroBannerUrl] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [scenariosResult, lbResult, friendsResult] = await Promise.allSettled([
        listScenarios(),
        getGlobalLeaderboard(),
        getFriendActivity(),
      ]);

      if (scenariosResult.status === "fulfilled") {
        setScenarios(scenariosResult.value);
      } else {
        console.error("Failed to load scenarios:", scenariosResult.reason);
        setError(true);
        setScenarios([
          {
            id: "the_crooked_man",
            title: "The Crooked Man",
            description: "A new grim tale awaits in the fog-laden streets of London. The body was found in a locked room, but the key was missing. Can you solve the mystery before the clock strikes twelve?",
            victim: "Colonel Watson Morrison",
            difficulty: "medium",
            phase_count: 4,
            author: "Arthur Conan Doyle",
          },
        ]);
      }
      if (lbResult.status === "fulfilled") setLeaderboard(lbResult.value);
      if (friendsResult.status === "fulfilled") setFriends(friendsResult.value);
      setLoading(false);
    }
    load();
  }, []);
  const sanitizeId = (id: string) => {
    return id.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  };

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

  useEffect(() => {
    if (featured && !heroBannerUrl) {
      setHeroBannerUrl(`${BACKEND_URL}/scenes/${sanitizeId(featured.id)}_hero.png`);
    }
  }, [featured]);

  const handleHeroImageError = async () => {
    if (!featured || generatingHero) return;
    try {
      setGeneratingHero(true);
      const res = await generateHeroBanner(featured.id);
      // Append a timestamp to break browser cache if same URL returns
      setHeroBannerUrl(`${BACKEND_URL}${res.image_url}?t=${Date.now()}`);
    } catch (e) {
      console.error("Failed to generate hero banner dynamically:", e);
      // Set to empty to avoid infinite loops, rely on CSS fallback gradients
      setHeroBannerUrl("");
    } finally {
      setGeneratingHero(false);
    }
  };

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
              <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/20 to-transparent z-10 pointer-events-none" />

              {/* Background Image injected via style or an invisible img to trigger onError */}
              <div
                className="absolute inset-0 z-0 bg-cover bg-center opacity-80 bg-no-repeat transition-all duration-1000"
                style={{ backgroundImage: heroBannerUrl ? `url('${heroBannerUrl}')` : undefined }}
              />

              {/* Hidden image just to detect 404s and trigger generation */}
              {heroBannerUrl && (
                <img
                  src={heroBannerUrl}
                  alt="Hero banner detector"
                  onError={handleHeroImageError}
                  className="hidden"
                />
              )}

              {generatingHero && (
                <div className="absolute inset-x-0 bottom-0 top-1/2 flex items-center justify-center z-20">
                  <div className="bg-black/50 backdrop-blur-sm border border-white/10 px-6 py-3 rounded-full flex gap-3 shadow-2xl animate-pulse">
                    <span className="material-symbols-outlined text-primary animate-spin">generating_tokens</span>
                    <span className="text-white font-medium text-sm tracking-wide">Synthesizing Scene...</span>
                  </div>
                </div>
              )}

              <div className="relative min-h-[560px] flex flex-col justify-end p-8 md:p-16 bg-gradient-to-br from-[#0a0f1e]/40 via-[#101622]/40 to-[#192233]/40">
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
                      imageUrl={`${BACKEND_URL}/scenes/${sanitizeId(s.id)}_hero.png`}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 col-span-1 sm:col-span-2 lg:col-span-4">
                    {[...availableCases]
                      .sort((a, b) => (a.author || "Other Mysteries").localeCompare(b.author || "Other Mysteries"))
                      .map((s) => (
                        <CaseCard
                          key={s.id}
                          id={s.id}
                          title={s.title}
                          description={s.description}
                          difficulty={s.difficulty}
                          progressPercent={s.progress_percent}
                          isComplete={s.is_complete}
                          author={s.author || "Other Mysteries"}
                          phaseCount={s.phase_count}
                          imageUrl={`${BACKEND_URL}/scenes/${sanitizeId(s.id)}_hero.png`}
                        />
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
              {friends.length > 0 ? friends.slice(0, 5).map((f, i) => (
                <div key={`${f.user_name}-${i}`} className="flex items-start gap-3">
                  <div className="relative">
                    {f.user_image ? (
                      <img src={f.user_image} alt={f.user_name} className="size-8 rounded-full border border-border-dark object-cover" />
                    ) : (
                      <div className="size-8 rounded-full bg-surface-dark border border-border-dark flex items-center justify-center">
                        <span className="material-symbols-outlined text-slate-400 text-sm">person</span>
                      </div>
                    )}
                    <div className={`absolute bottom-0 right-0 size-2.5 ${f.action.toLowerCase().includes('solved') ? 'bg-yellow-500' : 'bg-green-500'} border-2 border-background-dark rounded-full`} />
                  </div>
                  <div className="text-sm">
                    <p className="text-white font-medium">{f.user_name}</p>
                    <p className="text-slate-400 text-xs">
                      {f.action} <span className="text-primary hover:underline cursor-pointer">{f.scenario_title}</span>
                    </p>
                    <p className="text-slate-500 text-[10px] mt-1">{f.time_ago}</p>
                  </div>
                </div>
              )) : (
                <div className="text-slate-500 text-sm text-center py-4">No recent friend activity</div>
              )}
            </div>
          </div>

          {/* Global Records */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-yellow-500">emoji_events</span>
              Global Records
            </h3>
            <div className="bg-surface-dark rounded-xl p-3 border border-slate-800 flex flex-col gap-3">
              {leaderboard.length > 0 ? leaderboard.slice(0, 5).map((r, i, arr) => (
                <div
                  key={`${r.user_name}-${i}`}
                  className={`flex items-center justify-between ${i < arr.length - 1 ? "border-b border-slate-700 pb-2" : ""
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`${i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-600" : "text-slate-500"} font-black text-lg w-4 text-center`}>{i + 1}</span>
                    <div className="flex flex-col">
                      <span className="text-white text-sm font-bold truncate max-w-[120px]">{r.user_name}</span>
                      <span className="text-[10px] text-slate-500">{r.cases_solved} Solved</span>
                    </div>
                  </div>
                  {i === 0 && (
                    <span className="material-symbols-outlined text-yellow-500 text-sm">workspace_premium</span>
                  )}
                </div>
              )) : (
                <div className="text-slate-500 text-sm text-center py-4">No records found</div>
              )}
            </div>
            <a href="/leaderboard" className="block mt-4 w-full py-2 text-xs font-bold text-center text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors">
              View Full Leaderboard
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
