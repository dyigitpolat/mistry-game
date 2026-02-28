import { resetUid } from "./room.js";
import { generateRoom } from "./roomGeneration.js";
import { randInt } from "./random.js";

const GRID_ROWS = 4;
const GRID_COLS = 4;
const MIN_ROOMS = 5;
const MAX_ROOMS = 12;

function roomId(row, col) {
  return `r_${row}_${col}`;
}

export function generateDungeon() {
  resetUid();

  const numRooms = randInt(MIN_ROOMS, MAX_ROOMS);
  const filled = new Set();
  const startRow = randInt(0, GRID_ROWS - 1);
  const startCol = randInt(0, GRID_COLS - 1);
  filled.add(`${startRow},${startCol}`);
  const order = [{ row: startRow, col: startCol }];

  const rowColDeltas = [[-1, 0], [0, 1], [1, 0], [0, -1]];
  while (filled.size < numRooms) {
    const candidates = [];
    filled.forEach((key) => {
      const [r, c] = key.split(",").map(Number);
      for (const [dr, dc] of rowColDeltas) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS && !filled.has(`${nr},${nc}`)) {
          candidates.push({ row: nr, col: nc });
        }
      }
    });
    if (candidates.length === 0) break;
    const next = candidates[randInt(0, candidates.length - 1)];
    filled.add(`${next.row},${next.col}`);
    order.push(next);
  }

  const layout = {};
  const rooms = {};
  const startRoomId = roomId(order[0].row, order[0].col);

  for (const { row, col } of order) {
    const id = roomId(row, col);
    layout[id] = { row, col };
    const exits = {};
    if (row > 0 && filled.has(`${row - 1},${col}`)) exits.N = roomId(row - 1, col);
    if (row < GRID_ROWS - 1 && filled.has(`${row + 1},${col}`)) exits.S = roomId(row + 1, col);
    if (col > 0 && filled.has(`${row},${col - 1}`)) exits.W = roomId(row, col - 1);
    if (col < GRID_COLS - 1 && filled.has(`${row},${col + 1}`)) exits.E = roomId(row, col + 1);

    rooms[id] = generateRoom({
      id,
      exits,
      skipResetUid: true,
    });
  }

  return { rooms, layout, startRoomId };
}
