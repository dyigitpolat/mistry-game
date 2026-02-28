import { CANVAS_W, CANVAS_H } from "../constants/grid.js";
import { drawScene } from "../rendering/drawScene.js";
import { useEffect, useMemo, useState } from "react";
import { getContainerItemBounds, getSurfaceItemBounds } from "../rendering/drawObjects.js";
import { panelStyles, canvasStyles } from "../styles.js";

export default function GameCanvas({
  canvasRef,
  room,
  playerPos,
  selectedObjId,
  onCanvasClick,
  getImage,
  getWorldImage,
  children,
}) {
  const [hoveredItem, setHoveredItem] = useState(null);

  const hoverableObjects = useMemo(
    () =>
      (room?.objects ?? []).filter(
        (obj) =>
          (obj.category === "surface" || obj.category === "container") &&
          Array.isArray(obj.items) &&
          obj.items.length > 0 &&
          (obj.category !== "container" || obj.open)
      ),
    [room]
  );

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
    drawScene(ctx, room, playerPos, selectedObjId, {
      getImage: getImage ?? undefined,
      getWorldImage: getWorldImage ?? undefined,
    });
  }, [room, playerPos, selectedObjId, canvasRef, getImage, getWorldImage]);

  const handleMouseMove = (e) => {
    if (!canvasRef.current || !room) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    for (const obj of hoverableObjects) {
      for (let i = 0; i < obj.items.length; i++) {
        const item = obj.items[i];
        const bounds =
          obj.category === "surface"
            ? getSurfaceItemBounds(obj, i)
            : getContainerItemBounds(obj, i);
        const hit =
          px >= bounds.x &&
          px <= bounds.x + bounds.w &&
          py >= bounds.y &&
          py <= bounds.y + bounds.h;
        if (hit) {
          setHoveredItem({
            x: e.clientX - rect.left + 12,
            y: e.clientY - rect.top + 12,
            item,
            ownerName: obj.name ?? obj.id,
            ownerCategory: obj.category,
          });
          return;
        }
      }
    }
    if (hoveredItem) setHoveredItem(null);
  };

  const handleMouseLeave = () => {
    if (hoveredItem) setHoveredItem(null);
  };

  return (
    <div style={panelStyles.container}>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        onClick={onCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          ...canvasStyles.block,
          width: Math.min(CANVAS_W, 640),
          height: Math.min(CANVAS_H, 480),
        }}
      />
      {hoveredItem && (
        <div
          style={{
            position: "absolute",
            left: hoveredItem.x,
            top: hoveredItem.y,
            maxWidth: 260,
            background: "rgba(20,16,30,0.95)",
            border: "1px solid #5a5275",
            borderRadius: 6,
            padding: "8px 10px",
            pointerEvents: "none",
            zIndex: 25,
            boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
          }}
        >
          <div style={{ fontSize: 11, color: "#ffe088", marginBottom: 4 }}>
            {hoveredItem.item.name ?? hoveredItem.item.id}
          </div>
          {hoveredItem.item.description && (
            <div style={{ fontSize: 10, color: "#d5d0e3", lineHeight: 1.35 }}>
              {hoveredItem.item.description}
            </div>
          )}
          {hoveredItem.item.notes && (
            <div style={{ fontSize: 10, color: "#a8a1ba", marginTop: 5, lineHeight: 1.35 }}>
              {hoveredItem.item.notes}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
