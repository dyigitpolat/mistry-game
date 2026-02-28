"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { listScenarios, getScenario, getScenarioStats, getLeaderboard, getComments, postInteraction, type ScenarioSummary, type Scenario, type ScenarioStats as IScenarioStats, type LeaderboardEntry, type Comment } from "@/lib/api";
import Link from "next/link";
import { formatDistanceToNow } from 'date-fns';

export default function CaseDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [summary, setSummary] = useState<ScenarioSummary | null>(null);
    const [scenario, setScenario] = useState<Scenario | null>(null);

    // Meta stats state
    const [stats, setStats] = useState<IScenarioStats>({ total_plays: 0, clear_rate: 0, total_likes: 0, user_has_liked: false });
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentText, setCommentText] = useState("");
    const [isLiking, setIsLiking] = useState(false);
    const [isPosting, setIsPosting] = useState(false);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                // Fetch all to get the progress inject via listScenarios
                const allSummaries = await listScenarios();
                const foundSummary = allSummaries.find(s => s.id === id);
                if (foundSummary) {
                    setSummary(foundSummary);
                }

                // Fetch full scenario for rich details if needed
                const [fullScenario, fetchedStats, fetchedLeaderboard, fetchedComments] = await Promise.all([
                    getScenario(id),
                    getScenarioStats(id),
                    getLeaderboard(id),
                    getComments(id)
                ]);

                setScenario(fullScenario);
                setStats(fetchedStats);
                setLeaderboard(fetchedLeaderboard);
                setComments(fetchedComments);

            } catch (err) {
                console.error("Failed to load case details", err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id]);

    const handleLike = async () => {
        if (isLiking) return;
        setIsLiking(true);
        try {
            await postInteraction(id, "like");
            // Optimistic update
            setStats(prev => ({
                ...prev,
                total_likes: prev.user_has_liked ? prev.total_likes - 1 : prev.total_likes + 1,
                user_has_liked: !prev.user_has_liked
            }));
        } catch (e) {
            console.error("Failed to like:", e);
        } finally {
            setIsLiking(false);
        }
    };

    const handleComment = async () => {
        if (isPosting || !commentText.trim()) return;
        setIsPosting(true);
        try {
            await postInteraction(id, "comment", commentText.trim());
            setCommentText("");
            const refreshedComments = await getComments(id);
            setComments(refreshedComments);
        } catch (e) {
            console.error("Failed to post comment:", e);
        } finally {
            setIsPosting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col min-h-screen bg-background-dark text-white font-display">
                <AppHeader activeTab="cases" />
                <div className="flex-1 flex items-center justify-center">
                    <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            </div>
        );
    }

    if (!summary || !scenario) {
        return (
            <div className="flex flex-col min-h-screen bg-background-dark text-white font-display">
                <AppHeader activeTab="cases" />
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <span className="material-symbols-outlined text-6xl text-slate-600">search_off</span>
                    <h1 className="text-2xl font-bold">Case Not Found</h1>
                    <Link href="/" className="text-primary hover:underline">Return to Gallery</Link>
                </div>
            </div>
        );
    }

    const hasProgress = summary.progress_percent !== undefined && summary.progress_percent > 0;
    const isComplete = summary.is_complete;

    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display min-h-screen flex flex-col">
            <AppHeader activeTab="cases" />

            <div className="flex flex-1 overflow-hidden relative">
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-background-dark/90 z-10"></div>
                    <div className="w-full h-full bg-cover bg-center opacity-30 blur-sm bg-[url('https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=2070&auto=format&fit=crop')]" />
                </div>

                <main className="flex-1 overflow-y-auto custom-scrollbar relative z-20 flex flex-col items-center w-full">
                    <div className="w-full max-w-7xl mx-auto pt-8 px-6 lg:px-8 pb-8">
                        {/* Hero Banner */}
                        <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-surface-dark group">
                            <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-transparent to-transparent z-10 pointer-events-none"></div>
                            <div className="absolute inset-0 bg-gradient-to-r from-background-dark/90 via-background-dark/40 to-transparent z-10 pointer-events-none"></div>
                            <div className="relative h-[450px] w-full bg-cover bg-center transform transition-transform duration-1000 group-hover:scale-105 bg-[url('https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=2070&auto=format&fit=crop')]" />
                            <div className="absolute bottom-0 left-0 p-8 md:p-12 z-20 w-full md:w-2/3 flex flex-col gap-4">
                                <div className="flex items-center gap-3 animate-fade-in-up">
                                    {isComplete ? (
                                        <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded uppercase tracking-wider shadow-lg flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">task_alt</span> Solved
                                        </span>
                                    ) : hasProgress ? (
                                        <span className="bg-yellow-500 text-white text-xs font-bold px-3 py-1 rounded uppercase tracking-wider shadow-lg flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">pending_actions</span> In Progress ({Math.round(summary.progress_percent || 0)}%)
                                        </span>
                                    ) : (
                                        <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded uppercase tracking-wider shadow-lg shadow-primary/20">
                                            New Case
                                        </span>
                                    )}

                                    <span className="bg-black/40 backdrop-blur-sm border border-white/10 text-slate-200 text-xs font-bold px-3 py-1 rounded uppercase tracking-wider flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">timer</span> ~{scenario.time_limit_minutes}m Solve Time
                                    </span>
                                    <span className={`backdrop-blur-sm border text-xs font-bold px-3 py-1 rounded uppercase tracking-wider flex items-center gap-1
                                        ${summary.difficulty === 'hard' ? 'bg-red-900/60 border-red-500/30 text-red-200' :
                                            summary.difficulty === 'medium' ? 'bg-orange-900/60 border-orange-500/30 text-orange-200' :
                                                'bg-green-900/60 border-green-500/30 text-green-200'
                                        }`}>
                                        <span className="material-symbols-outlined text-[14px]">skull</span> {summary.difficulty}
                                    </span>
                                </div>

                                <h1 className="text-white text-5xl md:text-6xl font-black leading-tight tracking-tight drop-shadow-xl font-display">
                                    {scenario.title}
                                </h1>

                                <div className="flex items-center gap-4 text-slate-300 text-sm md:text-base font-medium">
                                    <div className="flex items-center gap-2">
                                        <div className="size-6 rounded-full bg-slate-700 bg-cover bg-center border border-slate-500 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-[12px] text-white">person</span>
                                        </div>
                                        <span>Victim: <span className="text-white hover:text-primary cursor-pointer transition-colors">{scenario.victim}</span></span>
                                    </div>
                                    <span className="w-1 h-1 rounded-full bg-slate-500"></span>
                                    <span>Phases: <span className="text-white">{scenario.phases.length} Acts</span></span>
                                </div>

                                <p className="text-slate-300 text-lg font-normal leading-relaxed drop-shadow-md max-w-xl mt-2 border-l-4 border-primary pl-4 bg-gradient-to-r from-black/40 to-transparent py-2 pr-4 rounded-r-lg backdrop-blur-sm">
                                    "{scenario.intro_narrative}"
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="w-full max-w-7xl mx-auto px-6 lg:px-8 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-8 flex flex-col gap-8">

                            {/* Action Bar */}
                            <div className="bg-surface-dark border border-slate-700 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                                <div className="flex items-center gap-8 w-full md:w-auto justify-around md:justify-start">
                                    <div className="flex flex-col items-center md:items-start gap-1">
                                        <span className="text-3xl font-bold text-white tracking-tight">{stats.total_plays.toLocaleString()}</span>
                                        <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Total Plays</span>
                                    </div>
                                    <div className="w-px h-10 bg-slate-700"></div>
                                    <div className="flex flex-col items-center md:items-start gap-1">
                                        <span className="text-3xl font-bold text-green-400 tracking-tight">{stats.clear_rate}%</span>
                                        <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Clear Rate</span>
                                    </div>
                                    <div className="w-px h-10 bg-slate-700"></div>
                                    <div
                                        className={`flex flex-col items-center md:items-start gap-1 cursor-pointer transition-colors ${stats.user_has_liked ? 'text-pink-400 hover:text-pink-500' : 'text-slate-400 hover:text-pink-400'}`}
                                        onClick={handleLike}
                                    >
                                        <div className="flex items-center gap-1">
                                            <span className="text-3xl font-bold tracking-tight">{stats.total_likes.toLocaleString()}</span>
                                            <span className={`material-symbols-outlined text-xl ${stats.user_has_liked ? 'filled' : ''}`}>favorite</span>
                                        </div>
                                        <span className="text-xs uppercase tracking-wider font-semibold">Likes</span>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-3 w-full md:w-auto justify-center md:justify-end">
                                    {isComplete ? (
                                        <button
                                            onClick={() => router.push(`/game/${id}`)}
                                            className="flex-1 md:flex-none flex items-center justify-center rounded-lg h-12 px-6 bg-green-600 hover:bg-green-500 text-white text-base font-bold transition-all shadow-lg group"
                                        >
                                            <span className="material-symbols-outlined mr-2">replay</span>
                                            Review Case
                                        </button>
                                    ) : hasProgress ? (
                                        <button
                                            onClick={() => router.push(`/game/${id}`)}
                                            className="flex-1 md:flex-none flex items-center justify-center rounded-lg h-12 px-6 bg-yellow-600 hover:bg-yellow-500 text-white text-base font-bold transition-all shadow-lg group"
                                        >
                                            <span className="material-symbols-outlined mr-2">resume</span>
                                            Continue Investigation
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => router.push(`/game/${id}`)}
                                            className="flex-1 md:flex-none flex items-center justify-center rounded-lg h-12 px-6 bg-primary hover:bg-primary/90 text-white text-base font-bold transition-all shadow-lg shadow-primary/25 group"
                                        >
                                            <span className="material-symbols-outlined mr-2 group-hover:animate-pulse">visibility</span>
                                            Start Investigation
                                        </button>
                                    )}

                                    <button className="flex-1 md:flex-none flex items-center justify-center rounded-lg h-12 px-6 bg-surface-darker hover:bg-slate-800 text-white text-base font-bold transition-all border border-slate-600">
                                        <span className="material-symbols-outlined mr-2 text-primary">group_add</span>
                                        Invite Friends
                                    </button>
                                    <button className="flex-none flex items-center justify-center rounded-lg h-12 w-12 bg-surface-darker hover:bg-slate-800 text-slate-300 hover:text-white transition-all border border-slate-600 tooltip" title="Bookmark">
                                        <span className="material-symbols-outlined">bookmark_add</span>
                                    </button>
                                </div>
                            </div>

                            {/* Case Discussion */}
                            <div className="bg-surface-dark/60 backdrop-blur-md border border-white/10 rounded-xl flex flex-col h-[600px] overflow-hidden">
                                <div className="p-6 border-b border-white/5 bg-black/20 flex justify-between items-center">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-slate-400">forum</span>
                                        Case Discussion
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-slate-400">{comments.length} Comments</span>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-6">
                                    {comments.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center opacity-50">
                                            <p className="text-slate-400 text-sm">No comments yet. Be the first to share your thoughts!</p>
                                        </div>
                                    ) : (
                                        comments.map(comment => (
                                            <div key={comment.id} className="flex gap-4 group">
                                                {comment.user_image ? (
                                                    <img src={comment.user_image} alt={comment.user_name} className="size-10 rounded-full shrink-0 border border-slate-600 shadow-sm" />
                                                ) : (
                                                    <div className="size-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-600 shadow-sm">
                                                        <span className="material-symbols-outlined text-white text-lg">person</span>
                                                    </div>
                                                )}
                                                <div className="flex flex-col flex-1">
                                                    <div className="flex items-baseline gap-2 mb-1">
                                                        <span className="text-slate-200 font-bold">{comment.user_name}</span>
                                                        <span className="text-slate-500 text-xs">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
                                                    </div>
                                                    <div className="bg-slate-800/50 border border-white/5 p-4 rounded-b-xl rounded-tr-xl text-slate-300 text-sm leading-relaxed group-hover:bg-slate-800/80 transition-colors">
                                                        {comment.content}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="p-4 bg-surface-dark border-t border-slate-700">
                                    <div className="flex gap-3">
                                        <div className="flex-1 relative">
                                            <textarea
                                                className="w-full bg-background-dark border border-slate-600 rounded-lg p-3 text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                                                placeholder="Share your deduction..."
                                                rows={2}
                                                value={commentText}
                                                onChange={(e) => setCommentText(e.target.value)}
                                            />
                                            <button
                                                onClick={handleComment}
                                                disabled={!commentText.trim() || isPosting}
                                                className="absolute bottom-2 right-2 p-1 text-primary hover:text-white transition-colors disabled:opacity-50 disabled:hover:text-primary"
                                            >
                                                <span className="material-symbols-outlined">{isPosting ? "hourglass_empty" : "send"}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Leaderboard Sidebar */}
                        <div className="lg:col-span-4 flex flex-col gap-8">
                            <div className="bg-surface-dark/60 backdrop-blur-md border border-white/10 p-6 rounded-xl relative overflow-hidden flex flex-col gap-4 shadow-2xl">
                                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                        <span className="material-symbols-outlined text-yellow-500">emoji_events</span>
                                        Fastest Solvers
                                    </h3>
                                </div>

                                {leaderboard.length === 0 ? (
                                    <div className="flex justify-center items-center h-32 opacity-50">
                                        <p className="text-sm text-slate-400 text-center">No completions yet. Be the first to solve!</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {leaderboard.map((entry, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5 hover:bg-black/30 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <span className={`font-black w-4 text-center ${idx === 0 ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600' : 'text-slate-600'}`}>
                                                        {idx + 1}
                                                    </span>
                                                    {entry.user_image ? (
                                                        <img src={entry.user_image} alt={entry.user_name} className="size-8 rounded-full border border-slate-700" />
                                                    ) : (
                                                        <div className="size-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                                                            <span className="material-symbols-outlined text-white text-xs">person</span>
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col">
                                                        <span className="text-white font-bold text-sm truncate max-w-[120px]">{entry.user_name}</span>
                                                        <span className="text-slate-500 text-[10px]">{formatDistanceToNow(new Date(entry.solved_at), { addSuffix: true })}</span>
                                                    </div>
                                                </div>
                                                <span className="text-primary font-bold text-sm bg-primary/10 px-2 py-1 rounded">
                                                    {Math.round(entry.elapsed_minutes)}m
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="bg-surface-dark border border-slate-700 rounded-xl p-6 shadow-lg">
                                <h4 className="text-slate-400 uppercase text-xs font-bold tracking-wider mb-4">Case Tags</h4>
                                <div className="flex flex-wrap gap-2">
                                    <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs border border-slate-600">Locked Room</span>
                                    <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs border border-slate-600">Victorian Era</span>
                                    <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs border border-slate-600">Murder</span>
                                    <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs border border-slate-600">Single Player</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </main>
            </div>
        </div>
    );
}
