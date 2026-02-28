"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import AppHeader from "@/components/AppHeader";
import { getUserProfileStats, UserProfileStats } from "@/lib/api";
import Link from "next/link";
import { format } from "date-fns";

export default function ProfilePage() {
    const { data: session, status } = useSession();
    const [stats, setStats] = useState<UserProfileStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (status === "authenticated") {
            getUserProfileStats()
                .then(setStats)
                .catch(err => setError(err.message))
                .finally(() => setLoading(false));
        } else if (status === "unauthenticated") {
            setLoading(false);
        }
    }, [status]);

    if (status === "loading" || loading) {
        return (
            <div className="min-h-screen bg-background-dark flex flex-col items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="size-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-medium animate-pulse">Accessing Detective Archives...</p>
                </div>
            </div>
        );
    }

    if (status === "unauthenticated") {
        return (
            <div className="min-h-screen bg-background-dark flex flex-col items-center justify-center p-6 text-center">
                <span className="material-symbols-outlined text-6xl text-slate-700 mb-4">lock</span>
                <h1 className="text-2xl font-bold text-white mb-2">Restricted Access</h1>
                <p className="text-slate-400 max-w-md mb-8">You must be a verified field agent to view the Detective Dossier.</p>
                <Link href="/login" className="bg-primary hover:bg-primary/90 text-background-dark font-black px-8 py-3 rounded-lg transition-all shadow-lg shadow-primary/20">
                    Verify Identity (Sign In)
                </Link>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="min-h-screen bg-background-dark flex flex-col items-center justify-center p-6 text-center">
                <h1 className="text-white text-xl font-bold">Error loading dossier</h1>
                <p className="text-slate-400 mt-2">{error || "Please try again later."}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 flex flex-col">
            <AppHeader activeTab="dossier" />

            <main className="flex-1 px-6 md:px-20 lg:px-40 py-8 overflow-y-auto custom-scrollbar">
                <div className="max-w-[1200px] mx-auto flex flex-col gap-8 pb-12">

                    {/* Profile Header Section */}
                    <section className="relative overflow-hidden rounded-xl bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark shadow-sm">
                        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none"></div>
                        <div className="flex flex-col md:flex-row p-8 gap-8 items-start md:items-center relative z-10">
                            {/* Avatar */}
                            <div className="relative shrink-0 group">
                                <div className="w-32 h-32 md:w-36 md:h-36 rounded-xl overflow-hidden border-4 border-slate-200 dark:border-border-dark shadow-lg relative">
                                    <div className="absolute inset-0 bg-primary/10 mix-blend-overlay z-10"></div>
                                    <div className="w-full h-full bg-cover bg-center grayscale contrast-125"
                                        style={{ backgroundImage: `url('${session?.user?.image || "https://images.unsplash.com/photo-1552058544-f2b08422138a?q=80&w=1998&auto=format&fit=crop"}')` }}>
                                    </div>
                                </div>
                                <div className="absolute -bottom-3 -right-3 bg-primary text-background-dark text-[10px] font-black px-2.5 py-1 rounded-full border-2 border-background-dark shadow-md flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[12px]">verified</span>
                                    VERIFIED
                                </div>
                            </div>

                            {/* Info */}
                            <div className="flex flex-col flex-1 gap-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                                            {stats.name}
                                        </h1>
                                        <p className="text-slate-500 dark:text-primary/70 text-xs font-bold tracking-widest uppercase mt-1">
                                            ID: {stats.id.slice(-8).toUpperCase()} • {stats.title}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-background-dark px-4 py-2 rounded-lg border border-slate-200 dark:border-border-dark">
                                        <span className="material-symbols-outlined text-primary">psychology</span>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold leading-none">Detective Elo</span>
                                            <span className="text-xl font-bold text-slate-900 dark:text-white leading-none">{stats.elo}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-px w-full bg-slate-200 dark:bg-border-dark my-2"></div>
                                <p className="text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed text-sm">
                                    A dedicated investigator specializing in complex criminal networks.
                                    Known for a meticulous approach to evidence collection and a sharp intuition during interrogations.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Stats Grid */}
                    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-surface-dark p-5 rounded-lg border border-slate-200 dark:border-border-dark shadow-sm flex flex-col gap-1 hover:border-primary/50 transition-colors group">
                            <div className="flex justify-between items-start">
                                <span className="text-slate-500 dark:text-primary/70 text-[11px] font-bold uppercase tracking-wider">Cases Solved</span>
                                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-primary transition-colors">folder_open</span>
                            </div>
                            <span className="text-3xl font-bold text-slate-900 dark:text-white">{stats.cases_solved}</span>
                            <span className="text-[10px] text-primary font-bold flex items-center gap-1 uppercase tracking-tight">
                                <span className="material-symbols-outlined text-[12px]">trending_up</span> Case Mastery: High
                            </span>
                        </div>

                        <div className="bg-white dark:bg-surface-dark p-5 rounded-lg border border-slate-200 dark:border-border-dark shadow-sm flex flex-col gap-1 hover:border-primary/50 transition-colors group">
                            <div className="flex justify-between items-start">
                                <span className="text-slate-500 dark:text-primary/70 text-[11px] font-bold uppercase tracking-wider">Field Time</span>
                                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-primary transition-colors">schedule</span>
                            </div>
                            <span className="text-3xl font-bold text-slate-900 dark:text-white">{stats.field_time_hours}h</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-tight">Active Investigation Time</span>
                        </div>

                        <div className="bg-white dark:bg-surface-dark p-5 rounded-lg border border-slate-200 dark:border-border-dark shadow-sm flex flex-col gap-1 hover:border-primary/50 transition-colors group">
                            <div className="flex justify-between items-start">
                                <span className="text-slate-500 dark:text-primary/70 text-[11px] font-bold uppercase tracking-wider">Avg. Accuracy</span>
                                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-primary transition-colors">target</span>
                            </div>
                            <span className="text-3xl font-bold text-slate-900 dark:text-white">{stats.avg_accuracy}%</span>
                            <div className="w-full bg-slate-200 dark:bg-background-dark/50 rounded-full h-1.5 mt-2 overflow-hidden">
                                <div className="bg-primary h-1.5 rounded-full" style={{ width: `${stats.avg_accuracy}%` }}></div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-surface-dark p-5 rounded-lg border border-slate-200 dark:border-border-dark shadow-sm flex flex-col gap-1 hover:border-primary/50 transition-colors group">
                            <div className="flex justify-between items-start">
                                <span className="text-slate-500 dark:text-primary/70 text-[11px] font-bold uppercase tracking-wider">Top Assistant</span>
                                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-primary transition-colors">smart_toy</span>
                            </div>
                            <span className="text-xl font-bold text-slate-900 dark:text-white truncate">{stats.top_assistant}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-tight">Most Reliable Liaison</span>
                        </div>
                    </section>

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column: Case History */}
                        <div className="lg:col-span-2 flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-2xl">history_edu</span>
                                    Case History
                                </h3>
                                <button className="text-xs font-bold uppercase tracking-widest text-primary hover:text-green-400 transition-colors">View All Logs</button>
                            </div>

                            <div className="flex flex-col gap-4">
                                {stats.case_history.length > 0 ? (
                                    stats.case_history.map((entry, idx) => (
                                        <div key={idx} className="bg-white dark:bg-surface-dark rounded-lg p-5 border border-slate-200 dark:border-border-dark hover:border-primary/20 transition-all shadow-sm group">
                                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${entry.rank === 'S' ? 'bg-primary/10 text-primary border-primary/20' :
                                                                entry.rank === 'A' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                                    'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                                            }`}>{entry.rank} Rank</span>
                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-600 uppercase">Archive ID: {entry.scenario_id.slice(0, 8)}</span>
                                                    </div>
                                                    <h4 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{entry.scenario_title}</h4>
                                                    <p className="text-xs text-slate-500 mt-1">{format(new Date(entry.solved_at), 'MMMM d, yyyy')}</p>
                                                </div>
                                                <div className="text-right hidden sm:block">
                                                    <span className="block text-2xl font-black text-primary">{entry.rank}</span>
                                                    <span className="text-[10px] text-slate-500 uppercase font-black">Rating</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-4 mb-4 text-[11px] uppercase tracking-wider font-bold">
                                                <div>
                                                    <p className="text-slate-500 dark:text-primary/50 text-[10px] mb-0.5">Clear Time</p>
                                                    <p className="text-slate-900 dark:text-slate-200">{Math.floor(entry.elapsed_minutes)}m {Math.round((entry.elapsed_minutes % 1) * 60)}s</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500 dark:text-primary/50 text-[10px] mb-0.5">Accuracy</p>
                                                    <p className="text-slate-900 dark:text-slate-200">{Math.round((entry.clues_found / entry.total_clues) * 100)}%</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500 dark:text-primary/50 text-[10px] mb-0.5">Status</p>
                                                    <p className={`font-black ${entry.outcome === 'solved' ? 'text-primary' : 'text-red-400'}`}>
                                                        {entry.outcome.toUpperCase()}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-border-dark">
                                                <Link href={`/game/${entry.scenario_id}`} className="flex-1 bg-slate-100 dark:bg-background-dark hover:bg-slate-200 dark:hover:bg-slate-900 text-slate-900 dark:text-slate-300 py-2 rounded text-xs font-bold transition-colors flex items-center justify-center gap-2">
                                                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                                                    Review Session
                                                </Link>
                                                <button className="flex-1 bg-primary/5 hover:bg-primary/10 text-primary py-2 rounded text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-primary/10">
                                                    <span className="material-symbols-outlined text-[16px]">share</span>
                                                    Share Findings
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center flex flex-col items-center justify-center gap-4">
                                        <span className="material-symbols-outlined text-4xl text-slate-600">assignment_late</span>
                                        <p className="text-slate-500 font-medium">No archived cases found. Start your first investigation!</p>
                                        <Link href="/" className="text-primary font-bold hover:underline">Browse Open Cases</Link>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Badges & Skills */}
                        <div className="lg:col-span-1 flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-2xl">military_tech</span>
                                    Achievements
                                </h3>
                            </div>

                            <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-border-dark p-6 shadow-sm">
                                <div className="grid grid-cols-2 gap-4">
                                    {stats.badges.map((badge, idx) => (
                                        <div key={idx} className={`flex flex-col items-center text-center gap-2 p-3 rounded-lg transition-all group ${badge.unlocked ? 'cursor-help hover:bg-slate-50 dark:hover:bg-background-dark' : 'opacity-40 grayscale pointer-events-none'}`}
                                            title={badge.description}>
                                            <div className={`size-16 rounded-full p-0.5 shadow-lg relative ${badge.unlocked ? 'bg-gradient-to-br from-primary to-green-900 ring-2 ring-primary/20 group-hover:scale-105' : 'bg-slate-800'}`}>
                                                <div className="h-full w-full rounded-full bg-surface-dark flex items-center justify-center border border-white/5">
                                                    <span className={`material-symbols-outlined text-3xl ${badge.unlocked ? 'text-primary' : 'text-slate-600'}`}>{badge.icon}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <h5 className={`text-[11px] font-black leading-tight uppercase ${badge.unlocked ? 'text-slate-900 dark:text-white' : 'text-slate-600'}`}>{badge.name}</h5>
                                                <p className="text-[9px] text-slate-500 font-bold uppercase mt-1 tracking-widest">{badge.unlocked ? 'Unlocked' : 'Locked'}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-6 pt-5 border-t border-slate-200 dark:border-border-dark">
                                    <h4 className="text-[10px] font-black uppercase text-primary/70 mb-4 tracking-widest">Detective Skills</h4>
                                    <div className="flex flex-col gap-5">
                                        {Object.entries(stats.skills).map(([skill, value]) => (
                                            <div key={skill}>
                                                <div className="flex justify-between text-[10px] font-black uppercase tracking-wider mb-1.5">
                                                    <span className="text-slate-400">{skill}</span>
                                                    <span className="text-primary">{value}%</span>
                                                </div>
                                                <div className="w-full bg-slate-200 dark:bg-background-dark/50 h-1 rounded-full overflow-hidden">
                                                    <div className="bg-primary h-full rounded-full shadow-[0_0_8px_rgba(23,207,84,0.4)]" style={{ width: `${value}%` }}></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

