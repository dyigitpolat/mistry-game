import { useMemo } from "react";
import { minimapStyles } from "../styles.js";

const CELL_SIZE = 32;
const PAD = 14;
const NODE_R = 6;
const VISITED_FILL = "#2a2840";
const VISITED_STROKE = "#44405a";
const CURRENT_FILL = "#3a3860";
const CURRENT_STROKE = "#ffe088";
const LINE_STROKE = "#44405a";
const LABEL_FILL = "#9e98b0";
const LABEL_FILL_CURRENT = "#ffe088";

function abbreviate(name, maxLen = 10) {
  if (!name) return "";
  if (name.length <= maxLen) return name;
  const words = name.split(/\s+/);
  if (words.length >= 2) {
    return words.map(w => w.charAt(0).toUpperCase()).join("");
  }
  return name.slice(0, maxLen - 1) + ".";
}

export default function Minimap({ layout = {}, visitedRoomIds, currentRoomId, rooms = {} }) {
  const { nodes, edges, bounds } = useMemo(() => {
    const visitedSet = visitedRoomIds instanceof Set ? visitedRoomIds : new Set(visitedRoomIds || []);
    const visited = Array.from(visitedSet);
    if (visited.length === 0) {
      return { nodes: [], edges: [], bounds: { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 } };
    }
    const nodes = visited.map((id) => {
      const pos = layout[id];
      const room = rooms[id];
      return pos ? { id, row: pos.row, col: pos.col, name: room?.name ?? id } : null;
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
          if (a && b) {
            const isLocked = r.connectionStates?.[dir] === "locked";
            edges.push({ from: a, to: b, locked: isLocked });
          }
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
    if (nodes.length === 0) return { width: 140, height: 100, scale: CELL_SIZE, offsetX: PAD, offsetY: PAD };
    const { minRow, maxRow, minCol, maxCol } = bounds;
    const w = (maxCol - minCol + 1) * CELL_SIZE + PAD * 2;
    const h = (maxRow - minRow + 1) * CELL_SIZE + PAD * 2;
    return {
      width: Math.max(140, w),
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
        {edges.map(({ from, to, locked }, i) => (
          <line
            key={`e-${i}`}
            x1={toX(from.col)}
            y1={toY(from.row)}
            x2={toX(to.col)}
            y2={toY(to.row)}
            stroke={locked ? "#7a4040" : LINE_STROKE}
            strokeWidth={1.5}
            strokeDasharray={locked ? "3 2" : undefined}
          />
        ))}
        {nodes.map(({ id, row, col, name }) => {
          const isCurrent = id === currentRoomId;
          return (
            <g key={id}>
              <circle
                cx={toX(col)}
                cy={toY(row)}
                r={NODE_R}
                fill={isCurrent ? CURRENT_FILL : VISITED_FILL}
                stroke={isCurrent ? CURRENT_STROKE : VISITED_STROKE}
                strokeWidth={isCurrent ? 2.5 : 1}
              />
              <text
                x={toX(col)}
                y={toY(row) + NODE_R + 9}
                textAnchor="middle"
                fill={isCurrent ? LABEL_FILL_CURRENT : LABEL_FILL}
                fontSize={7}
                fontFamily="'Courier New', monospace"
                fontWeight={isCurrent ? "bold" : "normal"}
              >
                {abbreviate(name)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
