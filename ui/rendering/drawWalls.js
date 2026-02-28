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

export function drawGate(ctx, dir, gw, gh) {
  const tiles = getGateTiles(dir, gw, gh);
  tiles.forEach(t => {
    const x = t.x * TILE, y = t.y * TILE;
    ctx.fillStyle = PAL.gatePath;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = PAL.gateEdge;
    if (dir === "N" || dir === "S") {
      ctx.fillRect(x, y, TILE, PX);
      ctx.fillRect(x, y + TILE - PX, TILE, PX);
    } else {
      ctx.fillRect(x, y, PX, TILE);
      ctx.fillRect(x + TILE - PX, y, PX, TILE);
    }
  });
}
