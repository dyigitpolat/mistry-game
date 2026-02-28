"use client";

import { useEffect, useState } from "react";

interface ClueToastProps {
    toasts: Array<{
        id: string;
        type: "clue" | "item" | "epiphany";
        message: string;
    }>;
    onDismiss: (id: string) => void;
}

const TOAST_CONFIG = {
    clue: {
        icon: "lightbulb",
        label: "Clue Discovered",
        color: "blue",
        bg: "bg-blue-500/10",
        border: "border-blue-500/30",
        text: "text-blue-400",
        iconText: "text-blue-400",
    },
    item: {
        icon: "inventory_2",
        label: "Item Collected",
        color: "green",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/30",
        text: "text-emerald-400",
        iconText: "text-emerald-400",
    },
    epiphany: {
        icon: "auto_awesome",
        label: "Epiphany!",
        color: "amber",
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
        text: "text-amber-400",
        iconText: "text-amber-400",
    },
};

export default function ClueToast({ toasts, onDismiss }: ClueToastProps) {
    return (
        <div className="fixed bottom-24 right-6 z-40 space-y-3 pointer-events-none">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
            ))}
        </div>
    );
}

function ToastItem({
    toast,
    onDismiss,
}: {
    toast: { id: string; type: "clue" | "item" | "epiphany"; message: string };
    onDismiss: (id: string) => void;
}) {
    const [visible, setVisible] = useState(false);
    const config = TOAST_CONFIG[toast.type];

    useEffect(() => {
        // Animate in
        requestAnimationFrame(() => setVisible(true));

        // Auto dismiss after 4 seconds
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(() => onDismiss(toast.id), 300);
        }, 4000);

        return () => clearTimeout(timer);
    }, [toast.id, onDismiss]);

    return (
        <div
            className={`pointer-events-auto flex items-start gap-3 max-w-sm px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm transition-all duration-300 ${config.bg} ${config.border} ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
                }`}
        >
            <span className={`material-symbols-outlined ${config.iconText} mt-0.5`}>
                {config.icon}
            </span>
            <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${config.text}`}>
                    {config.label}
                </p>
                <p className="text-slate-200 text-sm mt-0.5 leading-snug">{toast.message}</p>
            </div>
            <button
                onClick={() => {
                    setVisible(false);
                    setTimeout(() => onDismiss(toast.id), 300);
                }}
                className="text-text-secondary hover:text-white text-sm shrink-0"
            >
                <span className="material-symbols-outlined text-sm">close</span>
            </button>
        </div>
    );
}
