"use client";
import { BACKEND_URL } from "@/lib/api";

interface SceneViewProps {
    locationName: string;
    sceneImageUrl?: string;
    children?: React.ReactNode;
}

/**
 * Full-bleed atmospheric background from Gemini-generated scene images.
 * The GameplayView canvas is rendered as a child overlay on top.
 */
export default function SceneView({ locationName, sceneImageUrl, children }: SceneViewProps) {
    return (
        <div className="relative w-full flex-[3] min-h-0 overflow-hidden bg-black">
            {/* Scene Image */}
            {sceneImageUrl ? (
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-70 transition-opacity duration-700 ease-out"
                    style={{
                        backgroundImage: `url(${sceneImageUrl.startsWith("http") ? sceneImageUrl : `${BACKEND_URL}${sceneImageUrl}`})`,
                    }}
                />
            ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#0d121c] via-[#192233] to-[#0d121c]" />
            )}

            {/* Subdued gradient overlay so canvas stays readable */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d121c]/90 via-[#0d121c]/40 to-[#0d121c]/60 pointer-events-none" />

            {/* Overlay content (GameplayView canvas) */}
            {children}
        </div>
    );
}
