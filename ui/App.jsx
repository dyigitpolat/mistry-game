import { useCallback, useRef, useState } from "react";
import { TILE, CANVAS_W, CANVAS_H } from "./constants/grid.js";
import { useGameState } from "./hooks/useGameState.js";
import { useMovement } from "./hooks/useMovement.js";
import { useCanvasInteraction } from "./hooks/useCanvasInteraction.js";
import { layoutStyles, initScreenStyles } from "./styles.js";
import Header from "./components/Header.jsx";
import GameCanvas from "./components/GameCanvas.jsx";
import InteractionPanel from "./components/InteractionPanel.jsx";
import Legend from "./components/Legend.jsx";
import Minimap from "./components/Minimap.jsx";

function getPanelPos(selectedObj, canvasRef) {
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

function nextContainerWorldKey(worldKey, locked, open) {
  if (!worldKey || typeof worldKey !== "string") return worldKey;
  const parts = worldKey.split(":");
  if (parts.length < 4) return worldKey;
  const state = open ? "open" : locked ? "closed_locked" : "closed_unlocked";
  return `${parts.slice(0, 3).join(":")}:${state}`;
}

export default function App() {
  const canvasRef = useRef(null);
  const [lockedMsg, setLockedMsg] = useState(null);
  const lockedTimerRef = useRef(null);

  const {
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
    loadTestWorld,
    refreshWorld,
    getWorldImage,
    worldLoadPending,
    worldLoadError,
    worldLoadStage,
    worldLoadProgress,
    worldLoadPreviewSrcs,
  } = useGameState();

  const handleLockedGate = useCallback((exitName) => {
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
  });

  const handleCanvasClick = useCanvasInteraction({
    room,
    playerPos,
    setPath,
    setPendingObjId,
    setSelectedObjId,
    canvasRef,
  });

  const selectedObj = room?.objects?.find((o) => o.id === selectedObjId) || null;
  const panelPos = getPanelPos(selectedObj, canvasRef);
  const toggleOpenReadonly = useCallback(
    (objId) => {
      setRoom((prev) => ({
        ...prev,
        objects: prev.objects.map((obj) => {
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
    [setRoom]
  );

  const showInitScreen = worldLoadPending || !room;

  return (
    <div style={layoutStyles.root}>
      <Header
        room={room}
        onRefreshWorld={refreshWorld}
        onLoadTestWorld={loadTestWorld}
        currentRoomId={currentRoomId}
        dungeon={dungeon}
        worldLoadPending={worldLoadPending}
        worldLoadError={worldLoadError}
      />
      {showInitScreen ? (
        <div style={initScreenStyles.container}>
          {worldLoadError ? (
            <>
              <span style={initScreenStyles.message}>Failed to load world</span>
              <span style={initScreenStyles.error}>{worldLoadError}</span>
              <span style={initScreenStyles.debug}>stage: {worldLoadStage}</span>
            </>
          ) : (
            <>
              <span style={initScreenStyles.message}>Loading world view…</span>
              <span style={initScreenStyles.debug}>stage: {worldLoadStage}</span>
              {worldLoadProgress.total > 0 && (
                <span style={initScreenStyles.debug}>
                  images: {worldLoadProgress.loaded}/{worldLoadProgress.total}
                </span>
              )}
              {worldLoadPreviewSrcs.length > 0 && (
                <div style={initScreenStyles.previewGrid}>
                  {worldLoadPreviewSrcs.map((src, idx) => (
                    <img key={`${src}-${idx}`} src={src} alt="loading preview" style={initScreenStyles.previewImg} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          <div style={layoutStyles.mainArea}>
            <GameCanvas
              canvasRef={canvasRef}
              room={room}
              playerPos={playerPos}
              selectedObjId={selectedObjId}
              onCanvasClick={handleCanvasClick}
              getWorldImage={getWorldImage}
            >
              <InteractionPanel
                selectedObject={selectedObj}
                panelPos={panelPos}
                onToggleOpen={toggleOpenReadonly}
                getWorldImage={getWorldImage}
                onClose={() => setSelectedObjId(null)}
              />
              {lockedMsg && (
                <div style={{
                  position: "absolute",
                  bottom: 16,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(160, 50, 50, 0.9)",
                  color: "#ffe0d0",
                  padding: "6px 16px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontFamily: "'Courier New', monospace",
                  letterSpacing: 1,
                  pointerEvents: "none",
                  zIndex: 20,
                  boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
                }}>
                  {lockedMsg}
                </div>
              )}
            </GameCanvas>
            <Minimap
              layout={dungeon?.layout ?? {}}
              visitedRoomIds={visitedRoomIds}
              currentRoomId={currentRoomId}
              rooms={dungeon?.rooms ?? {}}
            />
          </div>
          <Legend />
        </>
      )}
    </div>
  );
}
