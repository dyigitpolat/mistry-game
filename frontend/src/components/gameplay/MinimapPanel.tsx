"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";

const CELL_W = 150;
const CELL_H = 140;
const RECT_W = 130;
const RECT_H = 120;

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.15;

interface MinimapPanelProps {
  layout: Record<string, { row: number; col: number }>;
  visitedRoomIds: Set<string> | string[];
  currentRoomId: string | null;
  rooms: Record<string, { name?: string; exits?: Record<string, string>; connectionStates?: Record<string, string> }>;
  sceneImages?: Record<string, string>;
}

export default function MinimapPanel({
  layout = {},
  visitedRoomIds,
  currentRoomId,
  rooms = {},
  sceneImages = {},
}: MinimapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const panState = useRef<{ active: boolean; startX: number; startY: number; startPanX: number; startPanY: number }>({
    active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0,
  });

  const { nodes, edges } = useMemo(() => {
    const visitedSet =
      visitedRoomIds instanceof Set
        ? visitedRoomIds
        : new Set(visitedRoomIds || []);
    const visited = Array.from(visitedSet);
    if (visited.length === 0) {
      return { nodes: [] as any[], edges: [] as any[] };
    }

    const nodes = visited
      .map((id) => {
        const pos = layout[id];
        const room = rooms[id];
        return pos ? { id, row: pos.row, col: pos.col, name: room?.name ?? id } : null;
      })
      .filter(Boolean) as { id: string; row: number; col: number; name: string }[];

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

    return { nodes, edges };
  }, [layout, visitedRoomIds, currentRoomId, rooms]);

  const currentPos = useMemo(() => {
    if (!currentRoomId || !layout[currentRoomId]) return { row: 0, col: 0 };
    return layout[currentRoomId];
  }, [currentRoomId, layout]);

  // Auto-center on current room when it changes
  useEffect(() => {
    setPanOffset({ x: 0, y: 0 });
    setZoom(1.0);
  }, [currentRoomId]);

  const viewBox = useMemo(() => {
    const vw = (CELL_W * 2.2) / zoom;
    const vh = (CELL_H * 2.2) / zoom;
    const cx = currentPos.col * CELL_W + CELL_W / 2;
    const cy = currentPos.row * CELL_H + CELL_H / 2;
    return {
      x: cx - vw / 2 - panOffset.x,
      y: cy - vh / 2 - panOffset.y,
      w: vw,
      h: vh,
    };
  }, [currentPos, zoom, panOffset]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP))));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    panState.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: panOffset.x,
      startPanY: panOffset.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [panOffset]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!panState.current.active) return;
    const svgEl = containerRef.current?.querySelector("svg");
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const scaleX = viewBox.w / rect.width;
    const scaleY = viewBox.h / rect.height;
    const dx = (e.clientX - panState.current.startX) * scaleX;
    const dy = (e.clientY - panState.current.startY) * scaleY;
    setPanOffset({ x: panState.current.startPanX + dx, y: panState.current.startPanY + dy });
  }, [viewBox]);

  const handlePointerUp = useCallback(() => {
    panState.current.active = false;
  }, []);

  const toX = (col: number) => col * CELL_W + CELL_W / 2;
  const toY = (row: number) => row * CELL_H + CELL_H / 2;

  return (
    <div className="bg-surface-dark border border-border-dark rounded-lg p-3" style={{ height: 260, minHeight: 260 }}>
      <div className="text-[10px] text-text-secondary tracking-widest text-center mb-1.5 uppercase font-mono">
        Map
      </div>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "calc(100% - 20px)", overflow: "hidden", cursor: "grab" }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block", userSelect: "none" }}
        >
          <defs>
            {nodes.map(({ id, row, col }) => (
              <clipPath key={`clip-${id}`} id={`clip-${id}`}>
                <rect
                  x={toX(col) - RECT_W / 2}
                  y={toY(row) - RECT_H / 2}
                  width={RECT_W}
                  height={RECT_H}
                  rx={6}
                  ry={6}
                />
              </clipPath>
            ))}
          </defs>
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
            const imgUrl = sceneImages[id];
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
                {imgUrl && (
                  <image
                    href={imgUrl}
                    x={rx}
                    y={ry}
                    width={RECT_W}
                    height={RECT_H}
                    clipPath={`url(#clip-${id})`}
                    preserveAspectRatio="xMidYMid slice"
                    opacity={0.25}
                  />
                )}
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
                      color: isCurrent ? "#6ba3ff" : "#d0daf0",
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: isCurrent ? "bold" : 500,
                      lineHeight: 1.3,
                      overflow: "hidden",
                      wordBreak: "break-word",
                      padding: 2,
                      textShadow: "0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)",
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
    </div>
  );
}
