import { TILE, PX } from "../constants/grid.js";
import { PAL } from "../constants/palette.js";

/**
 * Draw a pre-rendered image (e.g. generated SVG) at the object's grid position and size.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, w?: number, h?: number }} obj - Room object
 * @param {HTMLImageElement} img - Loaded image (e.g. from blob URL of SVG)
 */
export function drawSvgImage(ctx, obj, img) {
  if (!img?.complete || !img.naturalWidth) return;
  const w = Math.max(obj.w ?? 1, 1) * TILE;
  const h = Math.max(obj.h ?? 1, 1) * TILE;
  const x = obj.x * TILE;
  const y = obj.y * TILE;
  ctx.drawImage(img, x, y, w, h);
}

export function drawBox(ctx, obj) {
  const x = obj.x * TILE, y = obj.y * TILE;
  const w = 2 * TILE, h = TILE;
  ctx.fillStyle = PAL.shadow;
  ctx.fillRect(x + PX, y + h - PX, w - PX, PX * 2);
  ctx.fillStyle = PAL.boxMid;
  ctx.fillRect(x + PX, y + PX, w - PX * 2, h - PX * 2);
  ctx.fillStyle = PAL.boxLight;
  ctx.fillRect(x + PX, y + PX, w - PX * 2, PX * 2);
  ctx.fillStyle = PAL.boxDark;
  ctx.fillRect(x + PX, y + h - PX * 3, w - PX * 2, PX * 2);
  ctx.fillStyle = PAL.boxDark;
  ctx.fillRect(x, y, PX, h); ctx.fillRect(x + w - PX, y, PX, h);
  ctx.fillRect(x, y, w, PX); ctx.fillRect(x, y + h - PX, w, PX);
  ctx.fillStyle = "#a0906a";
  ctx.fillRect(x + PX * 2, y + PX * 3, w - PX * 4, PX);

  if (obj.locked) {
    ctx.fillStyle = PAL.boxLock;
    ctx.fillRect(x + w / 2 - PX, y + PX * 3, PX * 2, PX * 3);
    ctx.fillStyle = "#aa8800";
    ctx.fillRect(x + w / 2 - PX, y + PX * 3, PX * 2, PX);
  }
  if (obj.open) {
    ctx.fillStyle = PAL.boxLight;
    ctx.fillRect(x + PX * 2, y - PX * 2, w - PX * 4, PX * 3);
    ctx.fillStyle = PAL.boxDark;
    ctx.fillRect(x + PX * 2, y - PX * 2, w - PX * 4, PX);
    ctx.fillStyle = "#3a2a1a";
    ctx.fillRect(x + PX * 2, y + PX * 2, w - PX * 4, h - PX * 4);
  }
}

export function drawSafe(ctx, obj) {
  const x = obj.x * TILE, y = obj.y * TILE;
  ctx.fillStyle = PAL.shadow;
  ctx.fillRect(x + PX, y + TILE - PX, TILE - PX, PX * 2);
  ctx.fillStyle = PAL.safeMid;
  ctx.fillRect(x + PX, y + PX, TILE - PX * 2, TILE - PX * 2);
  ctx.fillStyle = PAL.safeLight;
  ctx.fillRect(x + PX, y + PX, TILE - PX * 2, PX * 2);
  ctx.fillStyle = PAL.safeDark;
  ctx.fillRect(x, y, PX, TILE); ctx.fillRect(x + TILE - PX, y, PX, TILE);
  ctx.fillRect(x, y, TILE, PX); ctx.fillRect(x, y + TILE - PX, TILE, PX);
  ctx.fillStyle = PAL.safeDial;
  ctx.fillRect(x + PX * 3, y + PX * 3, PX * 2, PX * 2);
  ctx.fillStyle = PAL.safeDark;
  ctx.fillRect(x + PX * 3 + 2, y + PX * 3 + 2, PX * 2 - 4, PX * 2 - 4);
  ctx.fillStyle = obj.locked ? "#cc4444" : "#44cc44";
  ctx.fillRect(x + PX * 6, y + PX * 3, PX, PX * 3);

  if (obj.open) {
    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(x + PX * 2, y + PX * 2, TILE - PX * 4, TILE - PX * 4);
  }
}

export function drawTable(ctx, obj) {
  const x = obj.x * TILE, y = obj.y * TILE;
  const w = 2 * TILE, h = TILE;
  ctx.fillStyle = PAL.tableLeg;
  ctx.fillRect(x + PX, y + PX * 5, PX * 2, PX * 3);
  ctx.fillRect(x + w - PX * 3, y + PX * 5, PX * 2, PX * 3);
  ctx.fillStyle = PAL.shadow;
  ctx.fillRect(x + PX * 2, y + h - PX, w - PX * 4, PX * 2);
  ctx.fillStyle = PAL.tableTop;
  ctx.fillRect(x, y + PX, w, PX * 4);
  ctx.fillStyle = PAL.tableShade;
  ctx.fillRect(x, y + PX * 4, w, PX);
  ctx.fillStyle = "#d8b070";
  ctx.fillRect(x, y + PX, w, PX);
}

export function drawFlowerPot(ctx, obj) {
  const x = obj.x * TILE, y = obj.y * TILE;
  ctx.fillStyle = PAL.potBody;
  ctx.fillRect(x + PX * 2, y + PX * 5, PX * 4, PX * 3);
  ctx.fillStyle = PAL.potRim;
  ctx.fillRect(x + PX * 1, y + PX * 4, PX * 6, PX);
  ctx.fillStyle = PAL.soil;
  ctx.fillRect(x + PX * 2, y + PX * 5, PX * 4, PX);
  ctx.fillStyle = PAL.leafA;
  ctx.fillRect(x + PX * 3, y + PX * 1, PX * 2, PX * 3);
  ctx.fillStyle = PAL.leafB;
  ctx.fillRect(x + PX * 2, y + PX * 2, PX, PX * 2);
  ctx.fillRect(x + PX * 5, y + PX * 2, PX, PX * 2);
  ctx.fillStyle = PAL.petalA;
  ctx.fillRect(x + PX * 3, y + PX, PX * 2, PX);
  ctx.fillRect(x + PX * 3, y, PX * 2, PX);
  ctx.fillStyle = PAL.petalB;
  ctx.fillRect(x + PX * 2, y + PX, PX, PX);
  ctx.fillRect(x + PX * 5, y + PX, PX, PX);
}

export function drawLamp(ctx, obj) {
  const x = obj.x * TILE, y = obj.y * TILE;
  ctx.fillStyle = PAL.lampBase;
  ctx.fillRect(x + PX * 2, y + PX * 6, PX * 4, PX * 2);
  ctx.fillStyle = PAL.lampPole;
  ctx.fillRect(x + PX * 3, y + PX * 2, PX * 2, PX * 4);
  ctx.fillStyle = PAL.lampGlow;
  ctx.fillRect(x + PX, y, PX * 6, PX * 3);
  ctx.fillStyle = PAL.lampShade;
  ctx.fillRect(x + PX * 2, y, PX * 4, PX * 2);
}

export function drawItemIcon(ctx, x, y, size, item) {
  ctx.fillStyle = item.color;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(x + 2, y + 2, Math.floor(size / 3), Math.floor(size / 3));
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(x + 1, y + size - 3, size - 2, 2);
}

export function drawItemsOnSurface(ctx, obj) {
  if (!obj.items?.length) return;
  const baseX = obj.x * TILE, baseY = obj.y * TILE;
  const itemSize = Math.floor(TILE * 0.5);
  obj.items.forEach((item, i) => {
    const col = i % (obj.w * 2);
    const ix = baseX + col * itemSize + 2;
    const iy = baseY + PX + 2;
    drawItemIcon(ctx, ix, iy, itemSize - 4, item);
  });
}

export function drawItemsInContainer(ctx, obj) {
  if (!obj.items?.length || !obj.open) return;
  const baseX = obj.x * TILE, baseY = obj.y * TILE;
  const innerX = baseX + (obj.w === 2 ? PX * 3 : PX * 2);
  const innerY = baseY + PX * 2;
  const sz = Math.floor(TILE * 0.35);
  obj.items.forEach((item, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    drawItemIcon(ctx, innerX + col * (sz + 2), innerY + row * (sz + 2), sz, item);
  });
}

export function drawSelectionHighlight(ctx, obj) {
  const x = obj.x * TILE - 2, y = obj.y * TILE - 2;
  const w = Math.max(obj.w, 1) * TILE + 4, h = Math.max(obj.h, 1) * TILE + 4;
  ctx.strokeStyle = PAL.selectOutline;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
}
