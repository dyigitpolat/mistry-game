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
  getImage,
  children,
}) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    if (!room || !playerPos) {
      ctx.fillStyle = "#12101a";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      return;
    }
    drawScene(ctx, room, playerPos, selectedObjId, { getImage: getImage ?? undefined });
  }, [room, playerPos, selectedObjId, canvasRef, getImage]);

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
