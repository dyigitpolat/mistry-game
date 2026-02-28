import { useCallback } from "react";
import { TILE, CANVAS_W, CANVAS_H } from "../constants/grid.js";
import { getObjectTiles } from "../domain/geometry.js";
import { buildWalkableGrid, findPath, findAdjacentWalkable } from "../domain/pathfinding.js";

export function useCanvasInteraction({
  room,
  playerPos,
  setPath,
  setPendingObjId,
  setSelectedObjId,
  canvasRef,
}) {
  return useCallback(
    (e) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const gx = Math.floor((e.clientX - rect.left) * scaleX / TILE);
      const gy = Math.floor((e.clientY - rect.top) * scaleY / TILE);

      const clickedObj = room.objects.find(o => {
        if (o.type === "window" || o.type.startsWith("decoration")) return false;
        return getObjectTiles(o).some(t => t.x === gx && t.y === gy);
      });

      const walkable = buildWalkableGrid(room);

      if (clickedObj) {
        const adj = findAdjacentWalkable(clickedObj, walkable);
        if (!adj.length) return;

        let best = null, bestDist = Infinity;
        adj.forEach(tile => {
          const p = findPath(walkable, playerPos.x, playerPos.y, tile.x, tile.y);
          if (p !== null && p.length < bestDist) {
            best = p;
            bestDist = p.length;
          }
        });

        if (best !== null) {
          setPath(best);
          setPendingObjId(clickedObj.id);
          setSelectedObjId(null);
        } else if (adj.some(t => t.x === playerPos.x && t.y === playerPos.y)) {
          setSelectedObjId(clickedObj.id);
        }
      } else {
        setSelectedObjId(null);
        setPendingObjId(null);
        if (!walkable[gy]?.[gx]) return;
        const p = findPath(walkable, playerPos.x, playerPos.y, gx, gy);
        if (p) setPath(p);
      }
    },
    [room, playerPos, setPath, setPendingObjId, setSelectedObjId, canvasRef]
  );
}
