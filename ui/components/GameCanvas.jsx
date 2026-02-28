import { TILE, CANVAS_W, CANVAS_H } from "../constants/grid.js";
import { drawScene } from "../rendering/drawScene.js";
import { drawEffects, resolveMood, createParticles, updateParticles } from "../rendering/effects.js";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  getContainerItemBounds,
  getContainerItemDisplayBounds,
  getSurfaceItemDisplayBounds,
  getSurfaceItemBounds,
  pointHitsImageOpaquePixel,
} from "../rendering/drawObjects.js";
import { panelStyles, canvasStyles } from "../styles.js";

function getObjectBoundsOnCanvas(obj) {
  return {
    x: obj.x * TILE,
    y: obj.y * TILE,
    w: Math.max(obj.w ?? 1, 1) * TILE,
    h: Math.max(obj.h ?? 1, 1) * TILE,
  };
}

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
  const [hoveredEntity, setHoveredEntity] = useState(null);
  const particlesRef = useRef(null);
  const moodRef = useRef({});
  const animFrameRef = useRef(null);

  useEffect(() => {
    particlesRef.current = createParticles(35);
  }, []);

  useEffect(() => {
    moodRef.current = resolveMood(room);
  }, [room?.mood, room?.id]);

  const allObjects = useMemo(() => room?.objects ?? [], [room]);

  const itemHoverableObjects = useMemo(
    () =>
      allObjects.filter(
        (obj) =>
          (obj.category === "surface" || obj.category === "container") &&
          Array.isArray(obj.items) &&
          obj.items.length > 0 &&
          (obj.category !== "container" || obj.open)
      ),
    [allObjects]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    let running = true;
    const draw = () => {
      if (!running) return;
      if (!room || !playerPos) {
        ctx.fillStyle = "#12101a";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }
      drawScene(ctx, room, playerPos, selectedObjId, {
        getImage: getImage ?? undefined,
        getWorldImage: getWorldImage ?? undefined,
      });
      if (particlesRef.current) {
        updateParticles(particlesRef.current, 16);
      }
      drawEffects(ctx, room, particlesRef.current || [], moodRef.current);
      animFrameRef.current = requestAnimationFrame(draw);
    };
    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [room, playerPos, selectedObjId, canvasRef, getImage, getWorldImage]);

  const handleMouseMove = useCallback((e) => {
    if (!canvasRef.current || !room) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const tooltipX = e.clientX - rect.left + 12;
    const inUpperHalf = py < CANVAS_H / 2;
    const tooltipY = inUpperHalf
      ? (e.clientY - rect.top + 16)
      : (e.clientY - rect.top - 12);
    const anchor = inUpperHalf ? "top" : "bottom";

    // Priority 1: items on surfaces/containers
    for (const obj of itemHoverableObjects) {
      const containerBounds = obj.category === "container"
        ? getContainerItemDisplayBounds(obj, obj.items.length, getWorldImage)
        : null;
      const surfaceBounds = obj.category === "surface"
        ? getSurfaceItemDisplayBounds(obj, obj.items.length, getWorldImage)
        : null;
      for (let i = 0; i < obj.items.length; i++) {
        const item = obj.items[i];
        const bounds =
          obj.category === "surface"
            ? surfaceBounds?.[i] ?? getSurfaceItemBounds(obj, i)
            : containerBounds?.[i] ?? getContainerItemBounds(obj, i);
        const itemImg = item.worldItemSvgKey ? getWorldImage?.(item.worldItemSvgKey) : null;
        const hit = px >= bounds.x && px <= bounds.x + bounds.w && py >= bounds.y && py <= bounds.y + bounds.h;
        const pixelHit = itemImg ? pointHitsImageOpaquePixel(itemImg, bounds, px, py) : hit;
        if (pixelHit) {
          setHoveredEntity({
            x: tooltipX, y: tooltipY, anchor,
            kind: "item",
            name: item.name ?? item.id,
            description: item.description,
            notes: item.notes,
            ownerName: obj.name ?? obj.id,
          });
          return;
        }
      }
    }

    // Priority 2: objects and people
    for (const obj of allObjects) {
      const bounds = getObjectBoundsOnCanvas(obj);
      if (px < bounds.x || px > bounds.x + bounds.w || py < bounds.y || py > bounds.y + bounds.h) continue;
      const img = obj.worldSvgKey ? getWorldImage?.(obj.worldSvgKey) : null;
      if (img) {
        if (!pointHitsImageOpaquePixel(img, bounds, px, py)) continue;
      }
      let stateLabel = "";
      if (obj.category === "container") {
        stateLabel = obj.locked ? "Locked" : obj.open ? "Open" : "Closed";
      }
      setHoveredEntity({
        x: tooltipX, y: tooltipY, anchor,
        kind: obj.type === "world_person" ? "person" : "object",
        name: obj.name ?? obj.id,
        description: obj.description ?? "",
        notes: obj.notes ?? "",
        stateLabel,
        category: obj.category,
      });
      return;
    }

    setHoveredEntity(null);
  }, [room, allObjects, itemHoverableObjects, canvasRef, getWorldImage]);

  const handleMouseLeave = useCallback(() => {
    setHoveredEntity(null);
  }, []);

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
      {room?.name && (
        <div style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          width: Math.min(CANVAS_W, 640),
          padding: "6px 10px",
          background: "rgba(12, 10, 20, 0.85)",
          borderTop: "1px solid #2a2840",
          boxSizing: "border-box",
        }}>
          <span style={{ fontSize: 12, color: "#ffe088", fontWeight: "bold", letterSpacing: 1 }}>
            {room.name}
          </span>
          {room.description && (
            <span style={{
              fontSize: 10,
              color: "#9e98b0",
              marginLeft: 12,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 400,
            }}>
              {room.description}
            </span>
          )}
        </div>
      )}
      {hoveredEntity && (
        <div
          style={{
            position: "absolute",
            left: hoveredEntity.x,
            ...(hoveredEntity.anchor === "bottom"
              ? { bottom: "auto", top: hoveredEntity.y, transform: "translateY(-100%)" }
              : { top: hoveredEntity.y }),
            maxWidth: 280,
            background: "rgba(20,16,30,0.95)",
            border: "1px solid #5a5275",
            borderRadius: 6,
            padding: "8px 10px",
            pointerEvents: "none",
            zIndex: 25,
            boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
          }}
        >
          <div style={{ fontSize: 12, color: "#ffe088", marginBottom: 3, fontWeight: "bold" }}>
            {hoveredEntity.name}
          </div>
          {hoveredEntity.stateLabel && (
            <div style={{ fontSize: 9, color: hoveredEntity.stateLabel === "Locked" ? "#e06050" : "#8bc48b", marginBottom: 3, letterSpacing: 1, textTransform: "uppercase" }}>
              {hoveredEntity.stateLabel}
            </div>
          )}
          {hoveredEntity.description && (
            <div style={{ fontSize: 10, color: "#d5d0e3", lineHeight: 1.4 }}>
              {hoveredEntity.description}
            </div>
          )}
          {hoveredEntity.notes && (
            <div style={{ fontSize: 10, color: "#a8a1ba", marginTop: 5, lineHeight: 1.35, fontStyle: "italic" }}>
              {hoveredEntity.notes}
            </div>
          )}
          {hoveredEntity.kind === "item" && hoveredEntity.ownerName && (
            <div style={{ fontSize: 9, color: "#6a6580", marginTop: 4 }}>
              on {hoveredEntity.ownerName}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
