import { useCallback, useRef } from "react";
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
  if (!selectedObj || !canvasRef?.current) return { left: 0, top: 0 };
  const rect = canvasRef.current.getBoundingClientRect();
  const sx = rect.width / CANVAS_W;
  const sy = rect.height / CANVAS_H;
  return {
    left: (selectedObj.x + Math.max(selectedObj.w ?? 1, 1) / 2) * TILE * sx,
    top: selectedObj.y * TILE * sy - 8,
  };
}

export default function App() {
  const canvasRef = useRef(null);
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
  } = useGameState();

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
          return { ...obj, open: !obj.open };
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
            </>
          ) : (
            <span style={initScreenStyles.message}>Loading world view…</span>
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
                onClose={() => setSelectedObjId(null)}
              />
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
