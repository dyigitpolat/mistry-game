export const OPPOSITE_DIR = { N: "S", S: "N", E: "W", W: "E" };

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

export function getGateDirectionAt(gx, gy, gw, gh) {
  const cx = Math.floor(gw / 2), cy = Math.floor(gh / 2);
  if (gy === 0 && gx >= cx - 1 && gx <= cx) return "N";
  if (gy === gh - 1 && gx >= cx - 1 && gx <= cx) return "S";
  if (gx === 0 && gy >= cy - 1 && gy <= cy) return "W";
  if (gx === gw - 1 && gy >= cy - 1 && gy <= cy) return "E";
  return null;
}

export function getTileInsideGate(dir, gw, gh) {
  const cx = Math.floor(gw / 2), cy = Math.floor(gh / 2);
  switch (dir) {
    case "N": return { x: cx, y: 1 };
    case "S": return { x: cx, y: gh - 2 };
    case "W": return { x: 1, y: cy };
    case "E": return { x: gw - 2, y: cy };
    default: return { x: cx, y: cy };
  }
}

export function getObjectTiles(obj) {
  const tiles = [];
  for (let dy = 0; dy < Math.max(obj.h, 1); dy++)
    for (let dx = 0; dx < Math.max(obj.w, 1); dx++)
      tiles.push({ x: obj.x + dx, y: obj.y + dy });
  return tiles;
}

export function blocksMovement(type, obj) {
  if (type === "world_object") {
    return obj && (obj.category === "container" || obj.category === "surface");
  }
  if (type === "world_person") return true;
  return ["container_box", "container_safe", "surface_table"].includes(type);
}
