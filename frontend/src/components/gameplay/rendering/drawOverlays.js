import { CANVAS_W } from "../constants/grid.js";

export function drawRoomBanner(ctx, room) {
  if (!room?.name) return;
  ctx.save();

  const bannerH = 28;
  ctx.fillStyle = "rgba(12, 10, 20, 0.6)";
  ctx.fillRect(0, 0, CANVAS_W, bannerH);

  ctx.fillStyle = "rgba(90, 82, 117, 0.4)";
  ctx.fillRect(0, bannerH - 1, CANVAS_W, 1);

  ctx.font = "bold 12px 'Courier New', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffe088";
  ctx.fillText(room.name, 10, bannerH / 2);

  if (room.description) {
    const maxDescW = CANVAS_W - ctx.measureText(room.name).width - 30;
    if (maxDescW > 60) {
      ctx.font = "10px 'Courier New', monospace";
      ctx.fillStyle = "#9e98b0";
      ctx.textAlign = "right";
      let desc = room.description;
      if (ctx.measureText(desc).width > maxDescW) {
        while (ctx.measureText(desc + "...").width > maxDescW && desc.length > 10) {
          desc = desc.slice(0, -1);
        }
        desc += "...";
      }
      ctx.fillText(desc, CANVAS_W - 10, bannerH / 2);
    }
  }

  ctx.restore();
}
