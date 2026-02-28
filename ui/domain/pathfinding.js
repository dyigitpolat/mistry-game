import { DIRS, D4 } from "../constants/grid.js";
import { getGateTiles, getObjectTiles, blocksMovement } from "./geometry.js";

export function buildWalkableGrid(room) {
  const { gridW: gw, gridH: gh } = room;
  const grid = Array.from({ length: gh }, () => Array(gw).fill(false));
  for (let y = 1; y < gh - 1; y++)
    for (let x = 1; x < gw - 1; x++) grid[y][x] = true;
  for (const dir of DIRS)
    if (room.gates[dir]) getGateTiles(dir, gw, gh).forEach(t => (grid[t.y][t.x] = true));
  room.objects.forEach(obj => {
    if (!blocksMovement(obj.type)) return;
    getObjectTiles(obj).forEach(t => (grid[t.y][t.x] = false));
  });
  return grid;
}

export function findPath(walkable, sx, sy, tx, ty) {
  if (sx === tx && sy === ty) return [];
  const rows = walkable.length, cols = walkable[0].length;
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const queue = [{ x: sx, y: sy, path: [] }];
  visited[sy][sx] = true;
  while (queue.length) {
    const { x, y, path } = queue.shift();
    for (const [dx, dy] of D4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (visited[ny][nx] || !walkable[ny][nx]) continue;
      const newPath = [...path, { x: nx, y: ny }];
      if (nx === tx && ny === ty) return newPath;
      visited[ny][nx] = true;
      queue.push({ x: nx, y: ny, path: newPath });
    }
  }
  return null;
}

export function findAdjacentWalkable(obj, walkable) {
  const tiles = getObjectTiles(obj);
  const candidates = [];
  const tileSet = new Set(tiles.map(t => `${t.x},${t.y}`));
  tiles.forEach(({ x, y }) => {
    D4.forEach(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      const key = `${nx},${ny}`;
      if (!tileSet.has(key) && walkable[ny]?.[nx]) candidates.push({ x: nx, y: ny });
    });
  });
  return candidates;
}
