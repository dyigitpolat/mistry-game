"use client";

import { useState, useEffect } from "react";
import AppHeader from "@/components/AppHeader";
import { getGlobalLeaderboard, getFriendsLeaderboard, getUserProfileStats, type GlobalLeaderboardEntry, type UserProfileStats } from "@/lib/api";
import Link from "next/link";

export default function LeaderboardPage() {
    const [leaderboard, setLeaderboard] = useState<GlobalLeaderboardEntry[]>([]);
    const [currentUserStats, setCurrentUserStats] = useState<UserProfileStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"global" | "friends">("global");

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const lbPromise = filter === "global" ? getGlobalLeaderboard() : getFriendsLeaderboard();
                const [lbData, profileData] = await Promise.all([
                    lbPromise,
                    getUserProfileStats().catch(() => null)
                ]);
                setLeaderboard(lbData);
                setCurrentUserStats(profileData);
            } catch (err) {
                console.error("Failed to load leaderboard:", err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [filter]);

    const topThree = leaderboard.slice(0, 3);
    const others = leaderboard.slice(3);

    // Find current user's rank
    const myRank = leaderboard.findIndex(entry => entry.user_id === currentUserStats?.id) + 1;

    return (
        <div className="flex flex-col min-h-screen bg-background-dark text-slate-100 font-display">
            <AppHeader activeTab="leaderboard" />

            <main className="flex-1 flex flex-col items-center w-full max-w-7xl mx-auto px-4 md:px-8 py-8 gap-8">
                {/* Header Section */}
                <div className="w-full flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-800 pb-6">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-4xl md:text-5xl font-black leading-tight tracking-tight text-white animate-fade-in-up">
                            Hall of Fame
                        </h1>
                        <p className="text-slate-400 text-lg">Honor the greatest minds in deduction.</p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20">
                        <span className="material-symbols-outlined text-primary text-sm">info</span>
                        <span className="text-primary text-sm font-medium">Season 4 Ends in 12 Days</span>
                    </div>
                </div>

                {/* Seasonal Champions (Podium) */}
                {!loading && topThree.length > 0 && (
                    <section className="w-full flex flex-col items-center mt-4">
                        <h2 className="text-2xl font-bold text-white mb-12 tracking-wide uppercase text-center">
                            <span className="text-primary">Seasonal</span> Champions
                        </h2>

                        <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-8 w-full max-w-4xl py-4">
                            {/* 2nd Place */}
                            {topThree[1] && (
                                <div className="order-2 md:order-1 flex flex-col items-center gap-3 flex-1 animate-fade-in" style={{ animationDelay: '100ms' }}>
                                    <div className="relative group cursor-pointer">
                                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-slate-400 overflow-hidden shadow-lg relative z-10 bg-slate-800">
                                            {topThree[1].user_image ? (
                                                <img src={topThree[1].user_image} alt={topThree[1].user_name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-slate-700">
                                                    <span className="material-symbols-outlined text-4xl text-slate-400">person</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-xs font-bold px-2 py-0.5 rounded-full border border-slate-500 z-20">#2</div>
                                    </div>
                                    <div className="text-center mt-2 p-4 bg-surface-dark w-full rounded-t-xl border-t border-x border-slate-800 h-32 flex flex-col justify-end pb-4 shadow-xl">
                                        <h3 className="text-white font-bold text-lg truncate px-2">{topThree[1].user_name}</h3>
                                        <p className="text-slate-400 text-sm font-mono">{topThree[1].elo} Elo</p>
                                        <p className="text-primary text-xs font-bold mt-1">{topThree[1].cases_solved} Solved</p>
                                    </div>
                                </div>
                            )}

                            {/* 1st Place */}
                            {topThree[0] && (
                                <div className="order-1 md:order-2 flex flex-col items-center gap-3 flex-1 relative -top-4 md:-top-8 animate-fade-in">
                                    <span className="material-symbols-outlined text-yellow-500 text-4xl mb-2 animate-bounce">emoji_events</span>
                                    <div className="relative group cursor-pointer">
                                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-yellow-500 overflow-hidden shadow-2xl shadow-yellow-500/20 relative z-10 bg-slate-800">
                                            {topThree[0].user_image ? (
                                                <img src={topThree[0].user_image} alt={topThree[0].user_name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-slate-700">
                                                    <span className="material-symbols-outlined text-5xl text-slate-400">person</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-yellow-600 text-white text-sm font-bold px-3 py-1 rounded-full border border-yellow-400 z-20">#1</div>
                                    </div>
                                    <div className="text-center mt-2 p-4 bg-surface-dark w-full rounded-t-xl border-t border-x border-slate-800 h-44 flex flex-col justify-end pb-4 shadow-2xl relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/10 to-transparent"></div>
                                        <h3 className="text-yellow-500 font-black text-xl truncate px-2 relative z-10">{topThree[0].user_name}</h3>
                                        <p className="text-yellow-100/80 text-sm font-mono relative z-10">{topThree[0].elo} Elo</p>
                                        <p className="text-yellow-500 text-xs font-bold mt-1 relative z-10">{topThree[0].cases_solved} Solved</p>
                                        <div className="mt-2 inline-flex items-center justify-center gap-1 bg-yellow-500/20 px-2 py-0.5 rounded text-[10px] text-yellow-200 border border-yellow-500/30 w-fit mx-auto relative z-10">
                                            <span className="material-symbols-outlined text-[10px]">verified</span> Top Solver
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 3rd Place */}
                            {topThree[2] && (
                                <div className="order-3 flex flex-col items-center gap-3 flex-1 animate-fade-in" style={{ animationDelay: '200ms' }}>
                                    <div className="relative group cursor-pointer">
                                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-orange-700 overflow-hidden shadow-lg relative z-10 bg-slate-800">
                                            {topThree[2].user_image ? (
                                                <img src={topThree[2].user_image} alt={topThree[2].user_name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-slate-700">
                                                    <span className="material-symbols-outlined text-4xl text-slate-400">person</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-orange-800 text-white text-xs font-bold px-2 py-0.5 rounded-full border border-orange-600 z-20">#3</div>
                                    </div>
                                    <div className="text-center mt-2 p-4 bg-surface-dark w-full rounded-t-xl border-t border-x border-slate-800 h-28 flex flex-col justify-end pb-4 shadow-xl">
                                        <h3 className="text-white font-bold text-lg truncate px-2">{topThree[2].user_name}</h3>
                                        <p className="text-slate-400 text-sm font-mono">{topThree[2].elo} Elo</p>
                                        <p className="text-primary text-xs font-bold mt-1">{topThree[2].cases_solved} Solved</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Leaderboard Table Section */}
                <section className="w-full bg-surface-dark rounded-xl border border-slate-800 shadow-xl overflow-hidden mt-6 mb-12">
                    {/* Filters & Search */}
                    <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex bg-background-dark/50 p-1 rounded-lg">
                            <button
                                onClick={() => setFilter("global")}
                                className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${filter === 'global' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                            >
                                Global
                            </button>
                            <button
                                onClick={() => setFilter("friends")}
                                className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${filter === 'friends' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                            >
                                Friends
                            </button>
                        </div>

                        <div className="relative w-full md:w-auto">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">search</span>
                            <input
                                className="w-full md:w-64 bg-background-dark border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-all font-display"
                                placeholder="Search detective..."
                                type="text"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-background-dark/80 text-slate-400 text-xs uppercase tracking-wider font-bold border-b border-slate-800">
                                    <th className="p-4 w-20 text-center">Rank</th>
                                    <th className="p-4">Detective</th>
                                    <th className="p-4 text-center">Elo Rating</th>
                                    <th className="p-4 text-center">Cases Solved</th>
                                    <th className="p-4 text-center">Total Time</th>
                                    <th className="p-4 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 text-sm">
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={6} className="p-8 h-16 bg-white/5" />
                                        </tr>
                                    ))
                                ) : (
                                    leaderboard.slice(3).map((entry, i) => (
                                        <tr key={entry.user_id} className={`group hover:bg-white/5 transition-colors ${entry.user_id === currentUserStats?.id ? 'bg-primary/10 border-l-4 border-l-primary' : ''}`}>
                                            <td className="p-4 text-center font-bold text-slate-400">{i + 4}</td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
                                                        {entry.user_image ? (
                                                            <img src={entry.user_image} alt={entry.user_name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-slate-700">
                                                                <span className="material-symbols-outlined text-xs text-slate-400">person</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-white font-bold group-hover:text-primary transition-colors flex items-center gap-2">
                                                            {entry.user_name}
                                                            {entry.user_id === currentUserStats?.id && (
                                                                <span className="bg-primary/30 text-primary text-[10px] px-1.5 rounded font-medium">YOU</span>
                                                            )}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">{entry.rank_title}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center text-primary font-mono font-bold">{entry.elo}</td>
                                            <td className="p-4 text-center text-slate-300">{entry.cases_solved}</td>
                                            <td className="p-4 text-center text-slate-400 font-mono">
                                                {Math.floor(entry.total_time_mins / 60)}h {Math.round(entry.total_time_mins % 60)}m
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${entry.cases_solved > 5 ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                                    {entry.cases_solved > 5 ? 'Pro' : 'Active'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 border-t border-slate-800 flex justify-between items-center text-sm text-slate-500">
                        <span>Showing top {leaderboard.length} detectives</span>
                        <div className="flex gap-2">
                            <button className="px-3 py-1 rounded border border-slate-800 hover:bg-white/5 disabled:opacity-50" disabled>Previous</button>
                            <button className="px-3 py-1 rounded border border-slate-800 bg-primary text-white border-primary shadow-lg shadow-primary/20">1</button>
                            <button className="px-3 py-1 rounded border border-slate-800 hover:bg-white/5">2</button>
                            <button className="px-3 py-1 rounded border border-slate-800 hover:bg-white/5">Next</button>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
