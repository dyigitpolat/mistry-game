"use client";
import { BACKEND_URL } from "@/lib/api";

interface SceneViewProps {
    locationName: string;
    sceneImageUrl?: string;
}

export default function SceneView({ locationName, sceneImageUrl }: SceneViewProps) {
    return (
        <div className="h-[35%] relative w-full group overflow-hidden bg-black">
            {/* Scene Image */}
            {sceneImageUrl ? (
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-90 group-hover:scale-105 transition-transform duration-700 ease-out"
                    style={{ backgroundImage: `url(${sceneImageUrl.startsWith('http') ? sceneImageUrl : `${BACKEND_URL}${sceneImageUrl}`})` }}
                />
            ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#0d121c] via-[#192233] to-[#0d121c] flex items-center justify-center">
                    <div className="text-center">
                        <span className="material-symbols-outlined text-5xl text-primary/30">image</span>
                        <p className="text-text-secondary/50 text-sm mt-2">Scene rendering...</p>
                    </div>
                </div>
            )}

            {/* Gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d121c] via-transparent to-[#0d121c]/80 pointer-events-none" />

            {/* Location pill */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 px-6 py-2 bg-black/60 backdrop-blur-sm border border-white/10 rounded-full flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-sm">location_on</span>
                <span className="text-white text-sm font-bold tracking-wide uppercase">
                    {locationName}
                </span>
            </div>
        </div>
    );
}
