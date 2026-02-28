import { DIRS, CANVAS_W, CANVAS_H } from "../constants/grid.js";
import { getGateTiles } from "../domain/geometry.js";
import { drawFloorTile } from "./drawFloor.js";
import { drawWallTile, drawWindow, drawGate } from "./drawWalls.js";
import { drawPlayer } from "./drawPlayer.js";
import {
  drawBox,
  drawSafe,
  drawTable,
  drawFlowerPot,
  drawLamp,
  drawSvgImage,
  drawItemsOnSurface,
  drawItemsInContainer,
  drawSelectionHighlight,
} from "./drawObjects.js";

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import("../domain/room.js").Room} room
 * @param {{ x: number, y: number }} playerPos
 * @param {string | null} selectedObjId
 * @param {{ getImage?: (type: string, state: { locked?: boolean, open?: boolean }) => HTMLImageElement | null, getWorldImage?: (key: string) => HTMLImageElement | null }} [options] - getImage for type-based assets; getWorldImage for world API SVG keys.
 */
export function drawScene(ctx, room, playerPos, selectedObjId, options = {}) {
  const getImage = options.getImage ?? null;
  const getWorldImage = options.getWorldImage ?? null;
  const { gridW: gw, gridH: gh } = room;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  const gateTileSet = new Set();
  DIRS.forEach(d => {
    if (room.gates[d]) getGateTiles(d, gw, gh).forEach(t => gateTileSet.add(`${t.x},${t.y}`));
  });

  for (let y = 1; y < gh - 1; y++)
    for (let x = 1; x < gw - 1; x++) drawFloorTile(ctx, x, y, room.floorType);

  for (let x = 0; x < gw; x++) {
    if (!gateTileSet.has(`${x},0`)) drawWallTile(ctx, x, 0);
    if (!gateTileSet.has(`${x},${gh - 1}`)) drawWallTile(ctx, x, gh - 1);
  }
  for (let y = 1; y < gh - 1; y++) {
    if (!gateTileSet.has(`0,${y}`)) drawWallTile(ctx, 0, y);
    if (!gateTileSet.has(`${gw - 1},${y}`)) drawWallTile(ctx, gw - 1, y);
  }
  [0, gw - 1].forEach(cx => [0, gh - 1].forEach(cy => {
    if (!gateTileSet.has(`${cx},${cy}`)) drawWallTile(ctx, cx, cy);
  }));

  room.objects.filter(o => o.type === "window").forEach(o => drawWindow(ctx, o));

  DIRS.forEach(d => { if (room.gates[d]) drawGate(ctx, d, gw, gh); });

  const drawables = room.objects
    .filter(o => o.type !== "window")
    .map(o => ({ obj: o, sortY: o.y + Math.max(o.h, 1) }));
  drawables.push({ obj: { type: "__player__", x: playerPos.x, y: playerPos.y }, sortY: playerPos.y + 1 });
  drawables.sort((a, b) => a.sortY - b.sortY);

  drawables.forEach(({ obj }) => {
    if (obj.type === "__player__") {
      drawPlayer(ctx, obj.x, obj.y);
    } else if (obj.worldSvgKey && getWorldImage) {
      const img = getWorldImage(obj.worldSvgKey);
      if (img) {
        drawSvgImage(ctx, obj, img);
        if (obj.type === "world_object" && (obj.category === "container" || obj.category === "surface")) {
          if (obj.category === "container") drawItemsInContainer(ctx, obj, getWorldImage);
          else drawItemsOnSurface(ctx, obj, getWorldImage);
        }
      }
    } else {
      const state = { locked: obj.locked, open: obj.open };
      const img = getImage?.(obj.type, state);
      if (img) {
        drawSvgImage(ctx, obj, img);
        if (obj.type === "container_box" || obj.type === "container_safe") drawItemsInContainer(ctx, obj, getWorldImage);
        if (obj.type === "surface_table") drawItemsOnSurface(ctx, obj, getWorldImage);
      } else if (obj.type === "container_box") {
        drawBox(ctx, obj);
        drawItemsInContainer(ctx, obj, getWorldImage);
      } else if (obj.type === "container_safe") {
        drawSafe(ctx, obj);
        drawItemsInContainer(ctx, obj, getWorldImage);
      } else if (obj.type === "surface_table") {
        drawTable(ctx, obj);
        drawItemsOnSurface(ctx, obj, getWorldImage);
      } else if (obj.type === "decoration_flower") {
        drawFlowerPot(ctx, obj);
      } else if (obj.type === "decoration_lamp") {
        drawLamp(ctx, obj);
      }
    }
    if (obj.id === selectedObjId) drawSelectionHighlight(ctx, obj);
  });
}
