import { useMemo } from "react";
import { minimapStyles } from "../styles.js";

const CELL_SIZE = 24;
const PAD = 12;
const NODE_R = 6;
const VISITED_FILL = "#2a2840";
const VISITED_STROKE = "#44405a";
const CURRENT_FILL = "#3a3860";
const CURRENT_STROKE = "#ffe088";
const LINE_STROKE = "#44405a";

export default function Minimap({ layout = {}, visitedRoomIds, currentRoomId, rooms = {} }) {
  const { nodes, edges, bounds } = useMemo(() => {
    const visitedSet = visitedRoomIds instanceof Set ? visitedRoomIds : new Set(visitedRoomIds || []);
    const visited = Array.from(visitedSet);
    if (visited.length === 0) {
      return { nodes: [], edges: [], bounds: { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 } };
    }
    const nodes = visited.map((id) => {
      const pos = layout[id];
      return pos ? { id, row: pos.row, col: pos.col } : null;
    }).filter(Boolean);

    const minRow = Math.min(...nodes.map((n) => n.row));
    const maxRow = Math.max(...nodes.map((n) => n.row));
    const minCol = Math.min(...nodes.map((n) => n.col));
    const maxCol = Math.max(...nodes.map((n) => n.col));

    const edgeSet = new Set();
    const edges = [];
    nodes.forEach(({ id }) => {
      const r = rooms[id];
      if (!r?.exits) return;
      ["N", "E", "S", "W"].forEach((dir) => {
        const otherId = r.exits[dir];
        if (otherId && visitedSet.has(otherId)) {
          const key = [id, otherId].sort().join(",");
          if (edgeSet.has(key)) return;
          edgeSet.add(key);
          const a = layout[id];
          const b = layout[otherId];
          if (a && b) edges.push({ from: a, to: b });
        }
      });
    });

    return {
      nodes,
      edges,
      bounds: { minRow, maxRow, minCol, maxCol },
    };
  }, [layout, visitedRoomIds, currentRoomId, rooms]);

  const { width, height, scale, offsetX, offsetY } = useMemo(() => {
    if (nodes.length === 0) return { width: 120, height: 100, scale: CELL_SIZE, offsetX: PAD, offsetY: PAD };
    const { minRow, maxRow, minCol, maxCol } = bounds;
    const w = (maxCol - minCol + 1) * CELL_SIZE + PAD * 2;
    const h = (maxRow - minRow + 1) * CELL_SIZE + PAD * 2;
    return {
      width: Math.max(120, w),
      height: Math.max(100, h),
      scale: CELL_SIZE,
      offsetX: PAD - minCol * CELL_SIZE,
      offsetY: PAD - minRow * CELL_SIZE,
    };
  }, [nodes.length, bounds]);

  const toX = (col) => col * scale + offsetX + scale / 2;
  const toY = (row) => row * scale + offsetY + scale / 2;

  return (
    <div style={minimapStyles.container}>
      <div style={minimapStyles.title}>MAP</div>
      <svg
        width={width}
        height={height}
        style={minimapStyles.svg}
        viewBox={`0 0 ${width} ${height}`}
      >
        {edges.map(({ from, to }, i) => (
          <line
            key={`e-${i}`}
            x1={toX(from.col)}
            y1={toY(from.row)}
            x2={toX(to.col)}
            y2={toY(to.row)}
            stroke={LINE_STROKE}
            strokeWidth={1.5}
          />
        ))}
        {nodes.map(({ id, row, col }) => {
          const isCurrent = id === currentRoomId;
          return (
            <circle
              key={id}
              cx={toX(col)}
              cy={toY(row)}
              r={NODE_R}
              fill={isCurrent ? CURRENT_FILL : VISITED_FILL}
              stroke={isCurrent ? CURRENT_STROKE : VISITED_STROKE}
              strokeWidth={isCurrent ? 2.5 : 1}
            />
          );
        })}
      </svg>
    </div>
  );
}
