import { useRef } from "react";
import { TILE, CANVAS_W, CANVAS_H } from "./constants/grid.js";
import { useGameState } from "./hooks/useGameState.js";
import { useMovement } from "./hooks/useMovement.js";
import { useCanvasInteraction } from "./hooks/useCanvasInteraction.js";
import { useObjectActions } from "./hooks/useObjectActions.js";
import { layoutStyles } from "./styles.js";
import Header from "./components/Header.jsx";
import GameCanvas from "./components/GameCanvas.jsx";
import InteractionPanel from "./components/InteractionPanel.jsx";
import InventorySidebar from "./components/InventorySidebar.jsx";
import Legend from "./components/Legend.jsx";
import Minimap from "./components/Minimap.jsx";

function getPanelPos(selectedObj, canvasRef) {
  if (!selectedObj || !canvasRef?.current) return { left: 0, top: 0 };
  const rect = canvasRef.current.getBoundingClientRect();
  const sx = rect.width / CANVAS_W;
  const sy = rect.height / CANVAS_H;
  return {
    left: (selectedObj.x + Math.max(selectedObj.w, 1) / 2) * TILE * sx,
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
    inventory,
    setInventory,
    pendingObjId,
    setPendingObjId,
    regenerate,
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

  const { toggleOpen, toggleLock, pickUpItem, pickUpFromSurface } = useObjectActions({
    room,
    setRoom,
    setInventory,
  });

  const selectedObj = room?.objects?.find((o) => o.id === selectedObjId) || null;
  const panelPos = getPanelPos(selectedObj, canvasRef);

  return (
    <div style={layoutStyles.root}>
      <Header
        room={room}
        onRegenerate={regenerate}
        currentRoomId={currentRoomId}
        dungeon={dungeon}
      />
      <div style={layoutStyles.mainArea}>
        <GameCanvas
          canvasRef={canvasRef}
          room={room}
          playerPos={playerPos}
          selectedObjId={selectedObjId}
          onCanvasClick={handleCanvasClick}
        >
          <InteractionPanel
            selectedObject={selectedObj}
            panelPos={panelPos}
            onOpen={toggleOpen}
            onLock={toggleLock}
            onPickUpItem={pickUpItem}
            onPickUpFromSurface={pickUpFromSurface}
            onClose={() => setSelectedObjId(null)}
          />
        </GameCanvas>
        <Minimap
          layout={dungeon?.layout ?? {}}
          visitedRoomIds={visitedRoomIds}
          currentRoomId={currentRoomId}
          rooms={dungeon?.rooms ?? {}}
        />
        <InventorySidebar inventory={inventory} />
      </div>
      <Legend />
    </div>
  );
}
