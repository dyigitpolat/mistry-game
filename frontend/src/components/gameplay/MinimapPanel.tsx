"use client";

import { useMemo } from "react";

const CELL_W = 150;
const CELL_H = 140;
const PAD = 24;
const RECT_W = 130;
const RECT_H = 120;

interface MinimapPanelProps {
  layout: Record<string, { row: number; col: number }>;
  visitedRoomIds: Set<string> | string[];
  currentRoomId: string | null;
  rooms: Record<string, { name?: string; exits?: Record<string, string>; connectionStates?: Record<string, string> }>;
}

export default function MinimapPanel({
  layout = {},
  visitedRoomIds,
  currentRoomId,
  rooms = {},
}: MinimapPanelProps) {
  const { nodes, edges, bounds } = useMemo(() => {
    const visitedSet =
      visitedRoomIds instanceof Set
        ? visitedRoomIds
        : new Set(visitedRoomIds || []);
    const visited = Array.from(visitedSet);
    if (visited.length === 0) {
      return { nodes: [] as any[], edges: [] as any[], bounds: { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 } };
    }

    const nodes = visited
      .map((id) => {
        const pos = layout[id];
        const room = rooms[id];
        return pos ? { id, row: pos.row, col: pos.col, name: room?.name ?? id } : null;
      })
      .filter(Boolean) as { id: string; row: number; col: number; name: string }[];

    const minRow = Math.min(...nodes.map((n) => n.row));
    const maxRow = Math.max(...nodes.map((n) => n.row));
    const minCol = Math.min(...nodes.map((n) => n.col));
    const maxCol = Math.max(...nodes.map((n) => n.col));

    const edgeSet = new Set<string>();
    const edges: { from: { row: number; col: number }; to: { row: number; col: number }; locked: boolean }[] = [];
    nodes.forEach(({ id }) => {
      const r = rooms[id];
      if (!r?.exits) return;
      (["N", "E", "S", "W"] as const).forEach((dir) => {
        const otherId = r.exits![dir];
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

    return { nodes, edges, bounds: { minRow, maxRow, minCol, maxCol } };
  }, [layout, visitedRoomIds, currentRoomId, rooms]);

  const { width, height, offsetX, offsetY } = useMemo(() => {
    if (nodes.length === 0) return { width: 180, height: 140, offsetX: PAD, offsetY: PAD };
    const { minRow, maxRow, minCol, maxCol } = bounds;
    const w = (maxCol - minCol + 1) * CELL_W + PAD * 2;
    const h = (maxRow - minRow + 1) * CELL_H + PAD * 2;
    return {
      width: Math.max(180, w),
      height: Math.max(140, h),
      offsetX: PAD - minCol * CELL_W,
      offsetY: PAD - minRow * CELL_H,
    };
  }, [nodes.length, bounds]);

  const toX = (col: number) => col * CELL_W + offsetX + CELL_W / 2;
  const toY = (row: number) => row * CELL_H + offsetY + CELL_H / 2;

  return (
    <div className="bg-surface-dark border border-border-dark rounded-lg p-3 min-h-[140px]">
      <div className="text-[10px] text-text-secondary tracking-widest text-center mb-1.5 uppercase font-mono">
        Map
      </div>
      <svg
        width={width}
        height={height}
        className="block mx-auto"
        viewBox={`0 0 ${width} ${height}`}
        style={{ maxWidth: "100%" }}
      >
        {edges.map(({ from, to, locked }, i) => (
          <line
            key={`e-${i}`}
            x1={toX(from.col)}
            y1={toY(from.row)}
            x2={toX(to.col)}
            y2={toY(to.row)}
            stroke={locked ? "#7a4040" : "#3a4d6e"}
            strokeWidth={2}
            strokeDasharray={locked ? "6 4" : undefined}
          />
        ))}
        {nodes.map(({ id, row, col, name }) => {
          const isCurrent = id === currentRoomId;
          const rx = toX(col) - RECT_W / 2;
          const ry = toY(row) - RECT_H / 2;
          return (
            <g key={id}>
              <rect
                x={rx}
                y={ry}
                width={RECT_W}
                height={RECT_H}
                rx={6}
                ry={6}
                fill={isCurrent ? "#1a2a4a" : "#1c2433"}
                stroke={isCurrent ? "#1258e2" : "#2a3d58"}
                strokeWidth={isCurrent ? 2.5 : 1.5}
              />
              <foreignObject
                x={rx + 6}
                y={ry + 6}
                width={RECT_W - 12}
                height={RECT_H - 12}
              >
                <div
                  // @ts-expect-error xmlns required for foreignObject HTML
                  xmlns="http://www.w3.org/1999/xhtml"
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    color: isCurrent ? "#4b8af5" : "#92a4c9",
                    fontSize: 10,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: isCurrent ? "bold" : "normal",
                    lineHeight: 1.3,
                    overflow: "hidden",
                    wordBreak: "break-word",
                    padding: 2,
                  }}
                >
                  {name}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
