import { TILE, PX } from "../constants/grid.js";
import { PAL } from "../constants/palette.js";
import { seededRand } from "../domain/random.js";

export function drawFloorTile(ctx, gx, gy, type) {
  const x = gx * TILE, y = gy * TILE;
  const r = seededRand(gx, gy);

  if (type === "grass") {
    ctx.fillStyle = r < 0.3 ? PAL.grassA : r < 0.6 ? PAL.grassB : r < 0.85 ? PAL.grassC : PAL.grassD;
    ctx.fillRect(x, y, TILE, TILE);
    if (r > 0.7) {
      ctx.fillStyle = PAL.grassC;
      ctx.fillRect(x + PX * 2, y + PX * 3, PX, PX * 2);
      ctx.fillRect(x + PX * 5, y + PX * 1, PX, PX * 2);
    }
  } else if (type === "wood") {
    ctx.fillStyle = r < 0.5 ? PAL.woodA : PAL.woodB;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = PAL.woodLine;
    ctx.fillRect(x, y + PX * 3, TILE, 1);
    ctx.fillRect(x, y + PX * 7, TILE, 1);
    if (r > 0.6) ctx.fillRect(x + PX * 4, y, 1, TILE);
  } else {
    ctx.fillStyle = r < 0.5 ? PAL.ceramicA : PAL.ceramicB;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = PAL.ceramicLine;
    ctx.fillRect(x, y, TILE, 1);
    ctx.fillRect(x, y, 1, TILE);
  }
}
