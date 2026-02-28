export function getGateTiles(dir, gw, gh) {
  const cx = Math.floor(gw / 2), cy = Math.floor(gh / 2);
  switch (dir) {
    case "N": return [{ x: cx - 1, y: 0 }, { x: cx, y: 0 }];
    case "S": return [{ x: cx - 1, y: gh - 1 }, { x: cx, y: gh - 1 }];
    case "W": return [{ x: 0, y: cy - 1 }, { x: 0, y: cy }];
    case "E": return [{ x: gw - 1, y: cy - 1 }, { x: gw - 1, y: cy }];
    default: return [];
  }
}

export function getObjectTiles(obj) {
  const tiles = [];
  for (let dy = 0; dy < Math.max(obj.h, 1); dy++)
    for (let dx = 0; dx < Math.max(obj.w, 1); dx++)
      tiles.push({ x: obj.x + dx, y: obj.y + dy });
  return tiles;
}

export function blocksMovement(type) {
  return ["container_box", "container_safe", "surface_table"].includes(type);
}
