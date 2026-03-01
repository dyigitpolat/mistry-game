import { TILE, PX } from "../constants/grid.js";
import { PAL } from "../constants/palette.js";
import { getGateTiles } from "../domain/geometry.js";

export function drawWallTile(ctx, gx, gy) {
  const x = gx * TILE, y = gy * TILE;
  ctx.fillStyle = PAL.wallMid;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = PAL.wallTop;
  ctx.fillRect(x, y, TILE, PX * 2);
  ctx.fillStyle = PAL.wallDark;
  ctx.fillRect(x, y + TILE - PX, TILE, PX);
  ctx.fillStyle = PAL.wallDark;
  ctx.fillRect(x, y + PX * 4, TILE, 1);
  const offset = (gy % 2) * PX * 4;
  ctx.fillRect(x + offset, y + PX * 2, 1, PX * 2);
  ctx.fillRect(x + PX * 4 + offset, y + PX * 2, 1, PX * 2);
  ctx.fillRect(x + ((offset + PX * 2) % (PX * 8)), y + PX * 5, 1, PX * 2);
}

export function drawWindow(ctx, obj) {
  const x = obj.x * TILE, y = obj.y * TILE;
  const isHoriz = obj.wall === "N" || obj.wall === "S";
  const w = isHoriz ? TILE * 2 : TILE;
  const h = isHoriz ? TILE : TILE * 2;

  ctx.fillStyle = PAL.winFrame;
  ctx.fillRect(x + PX, y + PX, w - PX * 2, h - PX * 2);
  ctx.fillStyle = PAL.winGlass;
  ctx.fillRect(x + PX * 2, y + PX * 2, w - PX * 4, h - PX * 4);
  ctx.fillStyle = PAL.winShine;
  if (isHoriz) {
    ctx.fillRect(x + PX * 3, y + PX * 2, PX * 2, h - PX * 4);
  } else {
    ctx.fillRect(x + PX * 2, y + PX * 3, w - PX * 4, PX * 2);
  }
  ctx.fillStyle = PAL.winFrame;
  if (isHoriz) ctx.fillRect(x + w / 2 - 1, y + PX * 2, 2, h - PX * 4);
  else ctx.fillRect(x + PX * 2, y + h / 2 - 1, w - PX * 4, 2);
}

export function drawGate(ctx, dir, gw, gh, connectionState, exitName) {
  const tiles = getGateTiles(dir, gw, gh);
  const isLocked = connectionState === "locked";
  const pathColor = isLocked ? "#7a5050" : PAL.gatePath;
  const edgeColor = isLocked ? "#5a3030" : PAL.gateEdge;

  tiles.forEach(t => {
    const x = t.x * TILE, y = t.y * TILE;
    ctx.fillStyle = pathColor;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = edgeColor;
    if (dir === "N" || dir === "S") {
      ctx.fillRect(x, y, TILE, PX);
      ctx.fillRect(x, y + TILE - PX, TILE, PX);
    } else {
      ctx.fillRect(x, y, PX, TILE);
      ctx.fillRect(x + TILE - PX, y, PX, TILE);
    }
  });

  if (tiles.length === 0) return;

  const minX = Math.min(...tiles.map(t => t.x)) * TILE;
  const minY = Math.min(...tiles.map(t => t.y)) * TILE;
  const maxX = Math.max(...tiles.map(t => t.x)) * TILE + TILE;
  const maxY = Math.max(...tiles.map(t => t.y)) * TILE + TILE;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  if (isLocked) {
    ctx.save();
    ctx.fillStyle = "#cc4444";
    ctx.fillRect(cx - 4, cy - 6, 8, 8);
    ctx.fillStyle = "#aa2222";
    ctx.fillRect(cx - 3, cy - 9, 6, 5);
    ctx.clearRect(cx - 1, cy - 8, 2, 3);
    ctx.fillStyle = "#ffcc44";
    ctx.fillRect(cx - 1, cy - 4, 2, 3);
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = "rgba(140, 200, 140, 0.5)";
    const arrowSize = 4;
    ctx.beginPath();
    if (dir === "N") {
      ctx.moveTo(cx, cy - arrowSize);
      ctx.lineTo(cx - arrowSize, cy + arrowSize);
      ctx.lineTo(cx + arrowSize, cy + arrowSize);
    } else if (dir === "S") {
      ctx.moveTo(cx, cy + arrowSize);
      ctx.lineTo(cx - arrowSize, cy - arrowSize);
      ctx.lineTo(cx + arrowSize, cy - arrowSize);
    } else if (dir === "W") {
      ctx.moveTo(cx - arrowSize, cy);
      ctx.lineTo(cx + arrowSize, cy - arrowSize);
      ctx.lineTo(cx + arrowSize, cy + arrowSize);
    } else {
      ctx.moveTo(cx + arrowSize, cy);
      ctx.lineTo(cx - arrowSize, cy - arrowSize);
      ctx.lineTo(cx - arrowSize, cy + arrowSize);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  if (exitName) {
    ctx.save();
    ctx.font = "bold 8px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(exitName).width;

    let labelX = cx;
    let labelY;
    if (dir === "N") {
      labelY = minY + TILE / 2 - 12;
    } else if (dir === "S") {
      labelY = maxY - TILE / 2 + 12;
    } else {
      labelY = cy - 14;
    }

    ctx.fillStyle = "rgba(12, 10, 20, 0.7)";
    ctx.fillRect(labelX - tw / 2 - 4, labelY - 6, tw + 8, 13);
    ctx.fillStyle = isLocked ? "#e06050" : "#c8c0d8";
    ctx.fillText(exitName, labelX, labelY);
    ctx.restore();
  }
}
