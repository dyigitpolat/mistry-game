import { CANVAS_W, CANVAS_H } from "../constants/grid.js";
import { drawScene } from "../rendering/drawScene.js";
import { useEffect } from "react";
import { panelStyles, canvasStyles } from "../styles.js";

export default function GameCanvas({
  canvasRef,
  room,
  playerPos,
  selectedObjId,
  onCanvasClick,
  children,
}) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    drawScene(ctx, room, playerPos, selectedObjId);
  }, [room, playerPos, selectedObjId, canvasRef]);

  return (
    <div style={panelStyles.container}>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        onClick={onCanvasClick}
        style={{
          ...canvasStyles.block,
          width: Math.min(CANVAS_W, 640),
          height: Math.min(CANVAS_H, 480),
        }}
      />
      {children}
    </div>
  );
}
