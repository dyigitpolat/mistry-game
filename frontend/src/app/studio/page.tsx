"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import {
  listScenarios,
  publishScenario,
  type ScenarioSummary,
} from "@/lib/api";

type Visibility = "public" | "private";

interface ProjectCard extends ScenarioSummary {
  last_edited: string;
  completion: number;
}

const SIDEBAR_NAV = [
  { label: "Dashboard", icon: "dashboard", key: "dashboard" },
  { label: "My Projects", icon: "folder_open", key: "projects" },
  { label: "Asset Library", icon: "photo_library", key: "assets" },
  { label: "AI Agents", icon: "smart_toy", key: "agents" },
];

const VISIBILITY_CONFIG: Record<
  Visibility,
  { label: string; bg: string; text: string }
> = {
  public: { label: "Public", bg: "bg-green-500/15", text: "text-green-400" },
  private: {
    label: "Private",
    bg: "bg-purple-500/15",
    text: "text-purple-400",
  },
};

function getRelativeTime(dateStr?: string): string {
  if (!dateStr) return "Recently";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export default function StudioDashboardPage() {
  const router = useRouter();
  const [allScenarios, setAllScenarios] = useState<ProjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [sidebarSearch, setSidebarSearch] = useState("");

  const loadScenarios = useCallback(async () => {
    try {
      const data = await listScenarios();
      setAllScenarios(
        data.map((s) => ({
          ...s,
          last_edited: s.last_played_at || new Date().toISOString(),
          completion: s.is_complete ? 100 : s.progress_percent ?? 0,
        }))
      );
    } catch {
      setAllScenarios([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  const myProjects = allScenarios.filter((s) => s.is_own && s.visibility === "private");

  const filteredProjects = sidebarSearch
    ? myProjects.filter((s) =>
        s.title.toLowerCase().includes(sidebarSearch.toLowerCase())
      )
    : myProjects;

  const handlePublish = async (scenarioId: string) => {
    try {
      await publishScenario(scenarioId);
      await loadScenarios();
    } catch (err) {
      console.error("Failed to publish:", err);
    }
  };

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background-dark text-slate-100 font-display">
      <AppHeader activeTab="cases" />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 border-r border-slate-800 bg-[#0c1018] shrink-0">
          <div className="p-5 border-b border-slate-800">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-primary text-xl">
                auto_awesome
              </span>
              <h2 className="text-white text-base font-bold">Case Studio</h2>
            </div>
            <div className="flex items-stretch rounded-lg bg-surface-dark overflow-hidden focus-within:ring-1 ring-primary/50 transition-all">
              <div className="text-slate-500 flex items-center justify-center pl-3">
                <span className="material-symbols-outlined text-[18px]">
                  search
                </span>
              </div>
              <input
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="w-full bg-transparent text-white text-sm px-2 py-2 placeholder:text-slate-500 focus:outline-none"
                placeholder="Search projects, assets..."
              />
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">
              Whodunit Engine
            </p>
            <div className="space-y-0.5">
              {SIDEBAR_NAV.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveNav(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeNav === item.key
                      ? "bg-primary/15 text-primary"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {item.icon}
                  </span>
                  {item.label}
                  {item.key === "projects" && myProjects.length > 0 && (
                    <span className="ml-auto text-[10px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                      {myProjects.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-8">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-3">
                Studio Insights
              </p>
              <div className="bg-surface-dark rounded-xl border border-slate-800 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-yellow-500 text-[18px]">
                    lightbulb
                  </span>
                  <span className="text-white text-xs font-bold">
                    Pro Tip: Complexity
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Adding &quot;Conditional Behavior&quot; to your cast of
                  characters increases replayability by +40%.
                </p>
                <button className="text-primary text-[11px] font-bold mt-2 hover:underline">
                  Learn more →
                </button>
              </div>
            </div>
          </nav>

          <div className="p-3 border-t border-slate-800 space-y-0.5">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all">
              <span className="material-symbols-outlined text-[20px]">
                settings
              </span>
              Settings
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all">
              <span className="material-symbols-outlined text-[20px]">
                help
              </span>
              Help & Support
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-8 md:p-12 max-w-6xl">
            {/* Welcome Section */}
            <div className="mb-10">
              <h1 className="text-white text-3xl md:text-4xl font-black tracking-tight mb-2">
                Welcome back, Detective.
              </h1>
              <p className="text-slate-400 text-lg">
                Manage your mysteries or weave a new tale of intrigue.
              </p>
            </div>

            {/* Generate New Project CTA */}
            <button
              onClick={() => router.push("/create")}
              className="w-full mb-10 group flex items-center gap-5 bg-surface-dark hover:bg-surface-dark/80 border border-slate-800 hover:border-primary/30 rounded-xl p-5 transition-all"
            >
              <div className="size-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0 group-hover:bg-primary/25 transition-colors">
                <span className="material-symbols-outlined text-primary text-2xl">
                  add
                </span>
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-white text-base font-bold mb-0.5">
                  Generate New Project
                </h3>
                <p className="text-slate-400 text-sm">
                  Start a new investigation case from scratch.
                </p>
              </div>
              <span className="material-symbols-outlined text-slate-500 group-hover:text-primary group-hover:translate-x-1 transition-all text-xl">
                arrow_forward
              </span>
            </button>

            {/* Section Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white text-xl font-bold tracking-tight">
                My Projects
              </h2>
              {filteredProjects.length > 0 && (
                <span className="text-slate-500 text-sm">
                  {filteredProjects.length} project{filteredProjects.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-surface-dark rounded-xl border border-slate-800 p-5 animate-pulse"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="size-10 rounded-lg bg-border-dark" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-border-dark rounded w-3/4" />
                        <div className="h-3 bg-border-dark rounded w-1/2" />
                      </div>
                    </div>
                    <div className="h-2 bg-border-dark rounded w-full mb-4" />
                    <div className="h-8 bg-border-dark rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-16">
                <span className="material-symbols-outlined text-slate-600 text-5xl mb-4 block">
                  folder_off
                </span>
                <p className="text-slate-400 text-lg font-medium mb-2">
                  {sidebarSearch ? "No matching projects" : "No projects yet"}
                </p>
                <p className="text-slate-500 text-sm mb-6">
                  {sidebarSearch
                    ? "Try a different search term."
                    : "Create your first mystery case to get started."}
                </p>
                {!sidebarSearch && (
                  <Link
                    href="/create"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      add
                    </span>
                    Create First Project
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                {filteredProjects.map((project) => (
                  <StudioProjectCard
                    key={project.id}
                    project={project}
                    onPublish={handlePublish}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function StudioProjectCard({
  project,
  onPublish,
}: {
  project: ProjectCard;
  onPublish: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const visibility = (project.visibility || "public") as Visibility;
  const visCfg = VISIBILITY_CONFIG[visibility];
  const canEdit = visibility === "private";

  const completionColor =
    project.completion >= 100
      ? "bg-green-500"
      : project.completion >= 60
        ? "bg-primary"
        : project.completion >= 30
          ? "bg-yellow-500"
          : "bg-purple-500";

  const iconColors: Record<Visibility, string> = {
    public: "bg-green-500/10 text-green-400",
    private: "bg-purple-500/10 text-purple-400",
  };

  const handlePublishClick = async () => {
    setPublishing(true);
    try {
      await onPublish(project.id);
    } finally {
      setPublishing(false);
      setMenuOpen(false);
    }
  };

  return (
    <div className="relative bg-surface-dark rounded-xl border border-slate-800 hover:border-slate-700 p-5 flex flex-col transition-all group">
      {/* Visibility Badge */}
      <div className="absolute top-4 right-4">
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${visCfg.bg} ${visCfg.text}`}
        >
          {visCfg.label}
        </span>
      </div>

      {/* Icon & Title */}
      <div className="flex items-start gap-3 mb-4 pr-16">
        <div
          className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${iconColors[visibility]}`}
        >
          <span className="material-symbols-outlined text-xl">
            {visibility === "private" ? "lock" : "description"}
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="text-white font-bold text-sm leading-tight truncate">
            {project.title}
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">
            Last edited {getRelativeTime(project.last_edited)}
          </p>
        </div>
      </div>

      {/* Completion Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-slate-500 text-xs">Completion</span>
          <span className="text-white text-xs font-bold">
            {project.completion}%
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full ${completionColor} transition-all`}
            style={{ width: `${project.completion}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto">
        {canEdit ? (
          <Link
            href={`/create?edit=${project.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-surface-dark text-slate-300 border border-slate-700 hover:border-slate-500 hover:text-white transition-all"
          >
            <span className="material-symbols-outlined text-[14px]">edit</span>
            Continue
          </Link>
        ) : (
          <Link
            href={`/case/${project.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-all"
          >
            Manage
          </Link>
        )}

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="size-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">
              more_horiz
            </span>
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 bottom-full mb-1 w-44 bg-[#1a2235] border border-slate-700 rounded-lg shadow-xl z-50 py-1 animate-fade-in">
                <Link
                  href={`/case/${project.id}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    visibility
                  </span>
                  View Case
                </Link>
                {visibility === "private" && (
                  <button
                    onClick={handlePublishClick}
                    disabled={publishing}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      public
                    </span>
                    {publishing ? "Publishing..." : "Make Public"}
                  </button>
                )}
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-[16px]">
                    content_copy
                  </span>
                  Duplicate
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                  <span className="material-symbols-outlined text-[16px]">
                    delete
                  </span>
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
