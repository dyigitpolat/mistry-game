"use client";

import { useCallback, useRef, useState } from "react";
import { TILE, CANVAS_W, CANVAS_H } from "./constants/grid.js";
import { useMovement } from "./hooks/useMovement.js";
import { useCanvasInteraction } from "./hooks/useCanvasInteraction.js";
import GameCanvas from "./GameCanvas.jsx";
import InteractionPanel from "./InteractionPanel.jsx";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getPanelPos(selectedObj: any, canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  if (!selectedObj || !canvasRef?.current) return { left: 0, top: 0, anchor: "above" };
  const rect = canvasRef.current.getBoundingClientRect();
  const sx = rect.width / CANVAS_W;
  const sy = rect.height / CANVAS_H;
  const objTopPx = selectedObj.y * TILE;
  const objBottomPx = (selectedObj.y + Math.max(selectedObj.h ?? 1, 1)) * TILE;
  const inUpperHalf = objTopPx < CANVAS_H / 2;
  return {
    left: (selectedObj.x + Math.max(selectedObj.w ?? 1, 1) / 2) * TILE * sx,
    top: inUpperHalf ? objBottomPx * sy + 8 : objTopPx * sy - 8,
    anchor: inUpperHalf ? "below" : "above",
  };
}

function nextContainerWorldKey(worldKey: string, locked: boolean, open: boolean) {
  if (!worldKey) return worldKey;
  const parts = worldKey.split(":");
  if (parts.length < 4) return worldKey;
  const state = open ? "open" : locked ? "closed_locked" : "closed_unlocked";
  return `${parts.slice(0, 3).join(":")}:${state}`;
}

/* ------------------------------------------------------------------ */
/*  Props — controlled by parent via useGameplayState                 */
/* ------------------------------------------------------------------ */

interface GameplayViewProps {
  dungeon: any;
  currentRoomId: string | null;
  setCurrentRoomId: (id: string) => void;
  visitedRoomIds: Set<string>;
  addVisited: (id: string) => void;
  room: any;
  setRoom: (updater: (room: any) => any) => void;
  playerPos: { x: number; y: number };
  setPlayerPos: (pos: any) => void;
  path: any[];
  setPath: (path: any) => void;
  selectedObjId: string | null;
  setSelectedObjId: (id: string | null) => void;
  pendingObjId: string | null;
  setPendingObjId: (id: string | null) => void;
  getWorldImage: (key: string) => HTMLImageElement | null;
  worldLoadPending: boolean;
  worldLoadError: string | null;
  worldLoadStage: string;
  worldLoadProgress: { loaded: number; total: number };
  worldLoadPreviewSrcs: string[];
  onRoomChangeRequest: (locationName: string) => void;
  onTakeItem: (itemName: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function GameplayView({
  dungeon,
  currentRoomId,
  setCurrentRoomId,
  visitedRoomIds,
  addVisited,
  room,
  setRoom,
  playerPos,
  setPlayerPos,
  path,
  setPath,
  selectedObjId,
  setSelectedObjId,
  pendingObjId,
  setPendingObjId,
  getWorldImage,
  worldLoadPending,
  worldLoadError,
  worldLoadStage,
  worldLoadProgress,
  worldLoadPreviewSrcs,
  onRoomChangeRequest,
  onTakeItem,
}: GameplayViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lockedMsg, setLockedMsg] = useState<string | null>(null);
  const lockedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLockedGate = useCallback((exitName: string) => {
    setLockedMsg(`Door to ${exitName} is locked`);
    if (lockedTimerRef.current) clearTimeout(lockedTimerRef.current);
    lockedTimerRef.current = setTimeout(() => setLockedMsg(null), 2000);
  }, []);

  useMovement({
    path,
    setPath,
    setPlayerPos,
    pendingObjId,
    setPendingObjId,
    setSelectedObjId,
    room,
    currentRoomId,
    dungeon,
    setCurrentRoomId,
    addVisited,
    onLockedGate: handleLockedGate,
    onRoomChangeRequest,
  });

  const handleCanvasClick = useCanvasInteraction({
    room,
    playerPos,
    setPath,
    setPendingObjId,
    setSelectedObjId,
    canvasRef,
  });

  const selectedObj = room?.objects?.find((o: any) => o.id === selectedObjId) || null;
  const panelPos = getPanelPos(selectedObj, canvasRef);

  const toggleOpenReadonly = useCallback(
    (objId: string) => {
      setRoom((prev: any) => ({
        ...prev,
        objects: prev.objects.map((obj: any) => {
          if (obj.id !== objId) return obj;
          if (obj.category !== "container" || obj.locked) return obj;
          const nextOpen = !obj.open;
          return {
            ...obj,
            open: nextOpen,
            worldSvgKey: nextContainerWorldKey(obj.worldSvgKey, obj.locked, nextOpen),
          };
        }),
      }));
    },
    [setRoom],
  );

  const showInitScreen = worldLoadPending || !room;

  if (showInitScreen) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3">
        {worldLoadError ? (
          <>
            <span className="text-slate-200 text-sm tracking-wide">Failed to load world</span>
            <span className="text-red-400 text-sm text-center max-w-[480px]">{worldLoadError}</span>
          </>
        ) : (
          <>
            <span className="text-text-secondary text-sm font-mono">Loading world view…</span>
            <span className="text-text-secondary/60 text-xs font-mono">{worldLoadStage}</span>
            {worldLoadProgress.total > 0 && (
              <span className="text-text-secondary/60 text-xs font-mono">
                images: {worldLoadProgress.loaded}/{worldLoadProgress.total}
              </span>
            )}
            {worldLoadPreviewSrcs.length > 0 && (
              <div className="mt-2 grid grid-cols-6 gap-1.5 justify-center max-w-[260px]">
                {worldLoadPreviewSrcs.map((src: string, idx: number) => (
                  <img
                    key={`${src}-${idx}`}
                    src={src}
                    alt=""
                    className="w-9 h-9 object-contain border border-border-dark rounded bg-surface-dark"
                    style={{ imageRendering: "pixelated" }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <GameCanvas
        canvasRef={canvasRef}
        room={room}
        playerPos={playerPos}
        selectedObjId={selectedObjId}
        onCanvasClick={handleCanvasClick}
        getImage={undefined}
        getWorldImage={getWorldImage}
      >
        <InteractionPanel
          selectedObject={selectedObj}
          panelPos={panelPos}
          onToggleOpen={toggleOpenReadonly}
          onTakeItem={onTakeItem}
          getWorldImage={getWorldImage}
          onClose={() => setSelectedObjId(null)}
        />
        {lockedMsg && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-900/90 text-red-100 px-4 py-1.5 rounded-md text-xs font-mono tracking-wide pointer-events-none z-20 shadow-lg"
          >
            {lockedMsg}
          </div>
        )}
      </GameCanvas>
    </div>
  );
}
