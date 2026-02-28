"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

interface AppHeaderProps {
    activeTab?: "home" | "cases" | "social" | "leaderboard" | "dossier";
}

export default function AppHeader({ activeTab = "home" }: AppHeaderProps) {
    const { data: session } = useSession();

    const navItems = [
        { label: "Home", href: "/", key: "home" },
        { label: "Case Studio", href: "#", key: "cases" },
        { label: "Social", href: "#", key: "social" },
        { label: "Leaderboard", href: "/leaderboard", key: "leaderboard" },
        { label: "Dossier", href: "/profile", key: "dossier" },
    ];

    return (
        <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-800 px-10 py-3 bg-background-dark z-50">
            <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-4 text-white">
                    <div className="size-8 text-primary flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl">fingerprint</span>
                    </div>
                    <h2 className="text-white text-xl font-bold leading-tight tracking-[-0.015em]">
                        Whodunit
                    </h2>
                </Link>
                <nav className="hidden md:flex items-center gap-9">
                    {navItems.map((item) => (
                        <Link
                            key={item.key}
                            href={item.href}
                            className={`text-sm font-medium leading-normal hover:text-primary transition-colors ${activeTab === item.key
                                ? "text-white"
                                : "text-slate-400"
                                }`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </div>
            <div className="flex flex-1 justify-end gap-6 items-center">
                <label className="hidden md:flex flex-col min-w-40 !h-10 max-w-64">
                    <div className="flex w-full flex-1 items-stretch rounded-lg h-full bg-surface-dark overflow-hidden group focus-within:ring-2 ring-primary/50 transition-all">
                        <div className="text-slate-400 flex border-none items-center justify-center pl-4">
                            <span className="material-symbols-outlined text-[20px]">search</span>
                        </div>
                        <input
                            className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 border-none bg-transparent focus:border-none h-full placeholder:text-slate-400 px-4 pl-2 text-sm font-normal leading-normal"
                            placeholder="Search cases..."
                        />
                    </div>
                </label>
                <div className="flex items-center gap-4">
                    <button className="text-slate-400 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">notifications</span>
                    </button>

                    {session ? (
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-slate-300 hidden sm:block">
                                {session.user?.name || "Detective"}
                            </span>
                            {session.user?.image ? (
                                <img
                                    src={session.user.image}
                                    alt="Profile"
                                    className="size-9 rounded-full border-2 border-border-dark cursor-pointer ring-2 ring-transparent hover:ring-primary transition-all"
                                    title={session.user?.email || "Profile"}
                                />
                            ) : (
                                <div
                                    className="size-9 rounded-full bg-surface-dark border-2 border-border-dark flex items-center justify-center ring-2 ring-transparent hover:ring-primary cursor-pointer transition-all"
                                    title={session.user?.email || "Profile"}
                                >
                                    <span className="material-symbols-outlined text-slate-400 text-lg">person</span>
                                </div>
                            )}
                            <button
                                onClick={() => signOut({ callbackUrl: "/login" })}
                                className="ml-2 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors border border-slate-700 hover:border-slate-600"
                            >
                                Sign Out
                            </button>
                        </div>
                    ) : (
                        <Link href="/login" className="text-sm font-bold text-primary hover:text-primary/80 transition-colors">
                            Sign In
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
