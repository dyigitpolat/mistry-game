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
  const { sx, sy, sw, sh, drawX, drawY, drawW, drawH } = getDrawMetricsForImageInObjectBox(obj, img);
  ctx.drawImage(img, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
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

/**
 * Draw a world-item SVG image at the given position (for items in containers/surfaces).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} size
 * @param {HTMLImageElement} img
 */
export function drawWorldItemIcon(ctx, x, y, size, img) {
  if (!img?.complete || !img.naturalWidth) return;
  const { sx, sy, sw, sh } = getOpaqueSourceBounds(img);
  ctx.drawImage(img, sx, sy, sw, sh, x + 1, y + 1, size - 2, size - 2);
}

function drawItemDropShadow(ctx, x, y, size) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.fillRect(x + 2, y + size - 2, size - 2, 3);
}

export function getSurfaceItemBounds(obj, index) {
  const boxW = Math.max(obj.w ?? 1, 1) * TILE;
  const boxH = Math.max(obj.h ?? 1, 1) * TILE;
  const baseX = obj.x * TILE;
  const baseY = obj.y * TILE;
  const sz = Math.floor(TILE * 0.92);
  const col = index % 2;
  const row = Math.floor(index / 2);
  const spacing = 4;
  const totalW = sz * 2 + spacing;
  const totalH = sz * 2 + spacing;
  const startX = baseX + Math.floor((boxW - totalW) / 2);
  const startY = baseY + Math.floor((boxH - totalH) / 2);
  return { x: startX + col * (sz + spacing), y: startY + row * (sz + spacing), w: sz, h: sz };
}

export function getContainerItemBounds(obj, index) {
  const boxW = Math.max(obj.w ?? 1, 1) * TILE;
  const boxH = Math.max(obj.h ?? 1, 1) * TILE;
  const baseX = obj.x * TILE;
  const baseY = obj.y * TILE;
  const sz = Math.floor(TILE * 0.92);
  const col = index % 2;
  const row = Math.floor(index / 2);
  const spacing = 4;
  const totalW = sz * 2 + spacing;
  const totalH = sz * 2 + spacing;
  const startX = baseX + Math.floor((boxW - totalW) / 2);
  const startY = baseY + Math.floor((boxH - totalH) / 2);
  const x = startX + col * (sz + spacing);
  const y = startY + row * (sz + spacing);
  return { x, y, w: sz, h: sz };
}

const _alphaMaskCache = new WeakMap();
const _opaqueBoundsCache = new WeakMap();

function getAlphaMaskCanvas(img, drawW, drawH) {
  const cached = _alphaMaskCache.get(img);
  if (cached && cached.w === drawW && cached.h === drawH) return cached.canvas;
  const canvas = document.createElement("canvas");
  canvas.width = drawW;
  canvas.height = drawH;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, drawW, drawH);
  ctx.drawImage(img, 0, 0, drawW, drawH);
  _alphaMaskCache.set(img, { w: drawW, h: drawH, canvas });
  return canvas;
}

function getOpaqueSourceBounds(img, alphaThreshold = 8) {
  const cached = _opaqueBoundsCache.get(img);
  if (cached) return cached;
  const canvas = getAlphaMaskCanvas(img, img.naturalWidth, img.naturalHeight);
  const ctx = canvas.getContext("2d");
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const a = data[(y * canvas.width + x) * 4 + 3];
      if (a > alphaThreshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const out =
    maxX >= minX && maxY >= minY
      ? { sx: minX, sy: minY, sw: maxX - minX + 1, sh: maxY - minY + 1 }
      : { sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight };
  _opaqueBoundsCache.set(img, out);
  return out;
}

function getDrawMetricsForImageInObjectBox(obj, img) {
  const boxW = Math.max(obj.w ?? 1, 1) * TILE;
  const boxH = Math.max(obj.h ?? 1, 1) * TILE;
  const boxX = obj.x * TILE;
  const boxY = obj.y * TILE;
  const { sx, sy, sw, sh } = getOpaqueSourceBounds(img);
  const scale = Math.min(boxW / sw, boxH / sh);
  const drawW = Math.max(1, Math.round(sw * scale));
  const drawH = Math.max(1, Math.round(sh * scale));
  const drawX = boxX + Math.floor((boxW - drawW) / 2);
  const drawY = boxY + Math.floor((boxH - drawH) / 2);
  return { sx, sy, sw, sh, drawX, drawY, drawW, drawH };
}

function opaqueRatioInRect(data, width, x, y, w, h) {
  let opaque = 0;
  const total = Math.max(w * h, 1);
  for (let iy = y; iy < y + h; iy++) {
    for (let ix = x; ix < x + w; ix++) {
      const a = data[(iy * width + ix) * 4 + 3];
      if (a > 40) opaque++;
    }
  }
  return opaque / total;
}

function getMaskAwareItemSlots(obj, count, parentImg, { preferLower = false } = {}) {
  const slot = Math.floor(TILE * 0.92);
  if (!parentImg?.complete || !parentImg.naturalWidth) {
    return Array.from(
      { length: count },
      (_, i) => (obj.category === "surface" ? getSurfaceItemBounds(obj, i) : getContainerItemBounds(obj, i))
    );
  }
  const metrics = getDrawMetricsForImageInObjectBox(obj, parentImg);
  const maskCanvas = getAlphaMaskCanvas(parentImg, metrics.drawW, metrics.drawH);
  const maskCtx = maskCanvas.getContext("2d");
  const data = maskCtx.getImageData(0, 0, metrics.drawW, metrics.drawH).data;
  const step = Math.max(2, Math.floor(slot / 3));
  const candidates = [];
  for (let y = 0; y <= metrics.drawH - slot; y += step) {
    for (let x = 0; x <= metrics.drawW - slot; x += step) {
      const ratio = opaqueRatioInRect(data, metrics.drawW, x, y, slot, slot);
      if (ratio >= 0.42) {
        const centerDist = Math.abs(x + slot / 2 - metrics.drawW / 2);
        const yCenterDist = Math.abs(y + slot / 2 - metrics.drawH / 2);
        const centerScore = -(centerDist + yCenterDist * 0.6);
        const lowerBonus = preferLower ? y * 0.4 : 0;
        candidates.push({ x, y, ratio, score: centerScore + lowerBonus });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const picked = [];
  for (const cand of candidates) {
    const overlaps = picked.some(
      (p) =>
        Math.abs(p.x - cand.x) < slot * 0.8 &&
        Math.abs(p.y - cand.y) < slot * 0.8
    );
    if (!overlaps) picked.push(cand);
    if (picked.length >= count) break;
  }
  if (picked.length === 0) {
    return Array.from(
      { length: count },
      (_, i) => (obj.category === "surface" ? getSurfaceItemBounds(obj, i) : getContainerItemBounds(obj, i))
    );
  }
  return Array.from({ length: count }, (_, i) => {
    const p = picked[i % picked.length];
    return { x: metrics.drawX + p.x, y: metrics.drawY + p.y, w: slot, h: slot };
  });
}

export function getContainerItemDisplayBounds(obj, count, getWorldImage) {
  const containerImg = obj.worldSvgKey && getWorldImage ? getWorldImage(obj.worldSvgKey) : null;
  return getMaskAwareItemSlots(obj, count, containerImg, { preferLower: true });
}

export function getSurfaceItemDisplayBounds(obj, count, getWorldImage) {
  const surfaceImg = obj.worldSvgKey && getWorldImage ? getWorldImage(obj.worldSvgKey) : null;
  return getMaskAwareItemSlots(obj, count, surfaceImg, { preferLower: false });
}

export function pointHitsImageOpaquePixel(img, bounds, px, py) {
  if (!img?.complete || !img.naturalWidth) return false;
  if (px < bounds.x || py < bounds.y || px > bounds.x + bounds.w || py > bounds.y + bounds.h) return false;
  const { sx, sy, sw, sh } = getOpaqueSourceBounds(img);
  const relX = Math.floor(sx + ((px - bounds.x) / Math.max(bounds.w, 1)) * sw);
  const relY = Math.floor(sy + ((py - bounds.y) / Math.max(bounds.h, 1)) * sh);
  const canvas = getAlphaMaskCanvas(img, img.naturalWidth, img.naturalHeight);
  const ctx = canvas.getContext("2d");
  const clampedX = Math.min(Math.max(relX, 0), canvas.width - 1);
  const clampedY = Math.min(Math.max(relY, 0), canvas.height - 1);
  const pixel = ctx.getImageData(clampedX, clampedY, 1, 1).data;
  return pixel[3] > 30;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} obj
 * @param {(key: string) => HTMLImageElement | null} [getWorldImage]
 */
export function drawItemsOnSurface(ctx, obj, getWorldImage) {
  if (!obj.items?.length) return;
  const slots = getSurfaceItemDisplayBounds(obj, obj.items.length, getWorldImage);
  obj.items.forEach((item, i) => {
    const box = slots[i] ?? getSurfaceItemBounds(obj, i);
    drawItemDropShadow(ctx, box.x, box.y, box.w);
    const img = item.worldItemSvgKey && getWorldImage ? getWorldImage(item.worldItemSvgKey) : null;
    if (img) drawWorldItemIcon(ctx, box.x, box.y, box.w, img);
    else drawItemIcon(ctx, box.x, box.y, box.w, item);
  });
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} obj
 * @param {(key: string) => HTMLImageElement | null} [getWorldImage]
 */
export function drawItemsInContainer(ctx, obj, getWorldImage) {
  if (!obj.items?.length || !obj.open) return;
  const slots = getContainerItemDisplayBounds(obj, obj.items.length, getWorldImage);
  obj.items.forEach((item, i) => {
    const box = slots[i] ?? getContainerItemBounds(obj, i);
    drawItemDropShadow(ctx, box.x, box.y, box.w);
    const img = item.worldItemSvgKey && getWorldImage ? getWorldImage(item.worldItemSvgKey) : null;
    if (img) drawWorldItemIcon(ctx, box.x, box.y, box.w, img);
    else drawItemIcon(ctx, box.x, box.y, box.w, item);
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

export function drawObjectDropShadow(ctx, obj) {
  const w = Math.max(obj.w ?? 1, 1) * TILE;
  const h = Math.max(obj.h ?? 1, 1) * TILE;
  const cx = obj.x * TILE + w / 2;
  const cy = obj.y * TILE + h - 2;
  const rx = w * 0.4;
  const ry = Math.max(3, h * 0.08);
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawObjectLabel(ctx, obj) {
  const name = obj.name;
  if (!name) return;
  const w = Math.max(obj.w ?? 1, 1) * TILE;
  const cx = obj.x * TILE + w / 2;
  const bottomY = obj.y * TILE + Math.max(obj.h ?? 1, 1) * TILE;
  ctx.save();
  ctx.font = "bold 9px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const textWidth = ctx.measureText(name).width;
  ctx.fillStyle = "rgba(12, 10, 20, 0.65)";
  ctx.fillRect(cx - textWidth / 2 - 3, bottomY + 1, textWidth + 6, 12);
  ctx.fillStyle = "#e8e0d0";
  ctx.fillText(name, cx, bottomY + 2);
  ctx.restore();
}
