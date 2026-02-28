import { TILE, PX } from "../constants/grid.js";
import { PAL } from "../constants/palette.js";

export function drawPlayer(ctx, gx, gy) {
  const x = gx * TILE, y = gy * TILE;
  ctx.fillStyle = PAL.shadow;
  ctx.beginPath();
  ctx.ellipse(x + TILE / 2, y + TILE - PX, PX * 3, PX, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAL.hair;
  ctx.fillRect(x + PX * 2, y + PX * 0, PX * 4, PX * 2);
  ctx.fillRect(x + PX * 1, y + PX * 1, PX * 6, PX);
  ctx.fillStyle = PAL.skin;
  ctx.fillRect(x + PX * 2, y + PX * 2, PX * 4, PX * 2);
  ctx.fillStyle = "#334";
  ctx.fillRect(x + PX * 3, y + PX * 2, PX, PX);
  ctx.fillRect(x + PX * 5, y + PX * 2, PX, PX);
  ctx.fillStyle = PAL.shirt;
  ctx.fillRect(x + PX * 1, y + PX * 4, PX * 6, PX * 2);
  ctx.fillStyle = PAL.shirtShade;
  ctx.fillRect(x + PX * 1, y + PX * 5, PX * 6, PX);
  ctx.fillStyle = PAL.pants;
  ctx.fillRect(x + PX * 2, y + PX * 6, PX * 2, PX * 2);
  ctx.fillRect(x + PX * 4, y + PX * 6, PX * 2, PX * 2);
  ctx.fillStyle = PAL.shoe;
  ctx.fillRect(x + PX * 2, y + PX * 7, PX * 2, PX);
  ctx.fillRect(x + PX * 4, y + PX * 7, PX * 2, PX);
}
