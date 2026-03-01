import { DIRS, GRID_W, GRID_H } from "../constants/grid.js";
import { ITEM_COLORS, ITEM_NAMES } from "../constants/palette.js";
import { getGateTiles, getObjectTiles } from "./geometry.js";
import { createRoom, createRoomObject, createItem, resetUid } from "./room.js";
import { pick, randInt } from "./random.js";

export function generateRoom(config = {}) {
  if (!config.skipResetUid) resetUid();
  const floorType = config.floorType ?? pick(["grass", "wood", "ceramic"]);
  let gates;
  if (config.exits && typeof config.exits === "object") {
    gates = {
      N: !!config.exits.N,
      E: !!config.exits.E,
      S: !!config.exits.S,
      W: !!config.exits.W,
    };
  } else {
    const numGates = randInt(1, 4);
    const shuffled = [...DIRS].sort(() => Math.random() - 0.5);
    gates = {};
    for (let i = 0; i < numGates; i++) gates[shuffled[i]] = true;
  }

  const gw = GRID_W, gh = GRID_H;
  const occupied = Array.from({ length: gh }, () => Array(gw).fill(false));

  for (let x = 0; x < gw; x++) { occupied[0][x] = true; occupied[gh - 1][x] = true; }
  for (let y = 0; y < gh; y++) { occupied[y][0] = true; occupied[y][gw - 1] = true; }

  for (const dir of DIRS) {
    if (gates[dir]) getGateTiles(dir, gw, gh).forEach(t => (occupied[t.y][t.x] = false));
  }

  const objects = [];

  const canPlace = (x, y, w, h) => {
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++)
        if (y + dy < 0 || y + dy >= gh || x + dx < 0 || x + dx >= gw || occupied[y + dy][x + dx]) return false;
    return true;
  };
  const markOccupied = (x, y, w, h) => {
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++) occupied[y + dy][x + dx] = true;
  };

  const allGateTiles = new Set();
  for (const dir of DIRS) {
    if (gates[dir]) getGateTiles(dir, gw, gh).forEach(t => allGateTiles.add(`${t.x},${t.y}`));
  }

  const tryPlaceWindow = (wall) => {
    for (let attempt = 0; attempt < 15; attempt++) {
      let x, y;
      if (wall === "N") { x = randInt(1, gw - 3); y = 0; }
      else if (wall === "E") { x = gw - 1; y = randInt(1, gh - 3); }
      else { x = 0; y = randInt(1, gh - 3); }

      const tiles = wall === "N"
        ? [{ x, y }, { x: x + 1, y }]
        : [{ x, y }, { x, y: y + 1 }];

      if (tiles.every(t => !allGateTiles.has(`${t.x},${t.y}`) &&
          !objects.some(o => o.type === "window" && getObjectTiles(o).some(ot => ot.x === t.x && ot.y === t.y)))) {
        const w = wall === "N" ? 2 : 0;
        const h = wall === "N" ? 0 : 2;
        objects.push(createRoomObject("window", tiles[0].x, tiles[0].y, { wall, w: Math.max(w, 1), h: Math.max(h, 1) }));
        return true;
      }
    }
    return false;
  };

  const wallsForWindows = ["N", "E", "W"].filter(d => !gates[d]);
  if (wallsForWindows.length > 0) {
    for (let i = 0; i < randInt(1, 3); i++) tryPlaceWindow(pick(wallsForWindows));
  }

  const placeNearWall = (type) => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const wall = pick(DIRS);
      let x, y;
      const w = type === "container_box" ? 2 : 1;
      if (wall === "N") { y = 1; x = randInt(1, gw - 1 - w); }
      else if (wall === "S") { y = gh - 2; x = randInt(1, gw - 1 - w); }
      else if (wall === "W") { x = 1; y = randInt(1, gh - 2); }
      else { x = gw - 2 - (w - 1); y = randInt(1, gh - 2); }

      if (canPlace(x, y, w, 1)) {
        const items = [];
        for (let j = 0; j < randInt(0, 3); j++) {
          const ci = randInt(0, ITEM_NAMES.length - 1);
          items.push(createItem(ITEM_NAMES[ci], ITEM_COLORS[ci]));
        }
        const locked = type === "container_safe" ? Math.random() > 0.5 : false;
        objects.push(createRoomObject(type, x, y, { items, locked }));
        markOccupied(x, y, w, 1);
        return true;
      }
    }
    return false;
  };

  for (let i = 0; i < randInt(1, 2); i++) placeNearWall("container_box");
  for (let i = 0; i < randInt(0, 2); i++) placeNearWall("container_safe");

  for (let i = 0; i < randInt(1, 2); i++) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = randInt(2, gw - 4);
      const y = randInt(2, gh - 3);
      if (canPlace(x, y, 2, 1)) {
        const items = [];
        for (let j = 0; j < randInt(0, 4); j++) {
          const ci = randInt(0, ITEM_NAMES.length - 1);
          items.push(createItem(ITEM_NAMES[ci], ITEM_COLORS[ci]));
        }
        objects.push(createRoomObject("surface_table", x, y, { items }));
        markOccupied(x, y, 2, 1);
        break;
      }
    }
  }

  for (let i = 0; i < randInt(1, 3); i++) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = randInt(1, gw - 2);
      const y = randInt(1, gh - 2);
      if (canPlace(x, y, 1, 1)) {
        const type = Math.random() > 0.5 ? "decoration_flower" : "decoration_lamp";
        objects.push(createRoomObject(type, x, y));
        markOccupied(x, y, 1, 1);
        break;
      }
    }
  }

  return createRoom({
    id: config.id ?? null,
    floorType,
    gates,
    exits: config.exits ?? {},
    objects,
  });
}
