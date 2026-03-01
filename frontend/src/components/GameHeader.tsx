"use client";

import { useState } from "react";

interface GameHeaderProps {
    sessionTime: string;
    scenarioTitle?: string;
    sessionId?: string;
}

export default function GameHeader({ sessionTime, scenarioTitle, sessionId }: GameHeaderProps) {
    const [copied, setCopied] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);

    const copySessionId = () => {
        if (sessionId) {
            navigator.clipboard.writeText(sessionId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-border-dark px-6 py-3 bg-surface-dark shrink-0 z-20">
            <div className="flex items-center gap-4">
                <div className="size-8 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl">fingerprint</span>
                </div>
                <h2 className="text-slate-100 text-xl font-bold leading-tight tracking-[-0.015em]">
                    Mistery
                </h2>
            </div>
            <div className="flex flex-1 justify-end gap-6 items-center">
                {/* Session ID for Discord */}
                {sessionId && (
                    <div className="relative">
                        <button
                            onClick={copySessionId}
                            onMouseEnter={() => setShowTooltip(true)}
                            onMouseLeave={() => setShowTooltip(false)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-colors cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-purple-400 text-sm">smart_toy</span>
                            <span className="text-purple-300 text-xs font-mono max-w-[100px] truncate">{sessionId.slice(0, 12)}...</span>
                            <span className="material-symbols-outlined text-purple-400 text-xs">
                                {copied ? "check" : "content_copy"}
                            </span>
                        </button>
                        {/* Tooltip */}
                        {showTooltip && !copied && (
                            <div className="absolute top-full mt-2 right-0 w-64 p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 text-xs">
                                <p className="text-white font-bold mb-2">Discord Voice Notes</p>
                                <ol className="text-slate-300 space-y-1 list-decimal list-inside">
                                    <li>Add bot to your Discord server</li>
                                    <li>Use <code className="text-purple-300">/mystery link {sessionId.slice(0, 8)}...</code></li>
                                    <li>Join voice &amp; <code className="text-purple-300">/mystery record</code></li>
                                    <li>Discuss, then <code className="text-purple-300">/mystery stop</code></li>
                                </ol>
                                <p className="text-slate-400 mt-2">Notes appear in Deduction Board!</p>
                            </div>
                        )}
                        {copied && (
                            <div className="absolute top-full mt-2 right-0 px-3 py-2 bg-green-800 border border-green-600 rounded-lg shadow-xl z-50 text-xs text-white">
                                Copied! Use with /mystery link in Discord
                            </div>
                        )}
                    </div>
                )}
                {/* Clock */}
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-background-dark border border-border-dark">
                    <span className="material-symbols-outlined text-text-secondary text-sm">schedule</span>
                    <span className="text-slate-100 font-bold font-mono">{sessionTime}</span>
                </div>
                {/* Call Watson */}
                <div className="flex gap-3">
                    <button className="flex cursor-pointer items-center justify-center overflow-hidden rounded-lg h-9 px-4 bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors">
                        <span className="material-symbols-outlined mr-2 text-[18px]">smart_toy</span>
                        <span>Call Watson</span>
                    </button>
                    <button className="flex cursor-pointer items-center justify-center overflow-hidden rounded-lg h-9 w-9 bg-border-dark text-white hover:bg-[#324467] transition-colors">
                        <span className="material-symbols-outlined text-[20px]">settings</span>
                    </button>
                </div>
                {/* Avatar */}
                <div className="size-9 rounded-full bg-surface-dark border-2 border-border-dark flex items-center justify-center">
                    <span className="material-symbols-outlined text-slate-400 text-lg">person</span>
                </div>
            </div>
        </header>
    );
}
