import { useState, useCallback, useMemo } from "react";
import { GRID_W, GRID_H } from "../constants/grid.js";
import { generateDungeon } from "../domain/dungeonGeneration.js";

function getInitialDungeonState() {
  const dungeon = generateDungeon();
  const startRoom = dungeon.rooms[dungeon.startRoomId];
  return {
    dungeon,
    currentRoomId: dungeon.startRoomId,
    visitedRoomIds: new Set([dungeon.startRoomId]),
    playerPos: startRoom
      ? { x: Math.floor(startRoom.gridW / 2), y: Math.floor(startRoom.gridH / 2) }
      : { x: Math.floor(GRID_W / 2), y: Math.floor(GRID_H / 2) },
  };
}

const FALLBACK_PLAYER_POS = { x: Math.floor(GRID_W / 2), y: Math.floor(GRID_H / 2) };

export function useGameState() {
  const [dungeonState, setDungeonState] = useState(getInitialDungeonState);
  const { dungeon, currentRoomId, visitedRoomIds, playerPos: statePlayerPos } = dungeonState;

  const [path, setPath] = useState([]);
  const [selectedObjId, setSelectedObjId] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [pendingObjId, setPendingObjId] = useState(null);

  const playerPos = statePlayerPos ?? FALLBACK_PLAYER_POS;

  const setPlayerPos = useCallback((posOrUpdater) => {
    setDungeonState((prev) => ({
      ...prev,
      playerPos:
        typeof posOrUpdater === "function" ? posOrUpdater(prev.playerPos ?? FALLBACK_PLAYER_POS) : posOrUpdater,
    }));
  }, []);

  const room = useMemo(() => {
    if (!dungeon?.rooms) return null;
    return (
      dungeon.rooms[currentRoomId] ??
      (dungeon.startRoomId ? dungeon.rooms[dungeon.startRoomId] : null)
    );
  }, [dungeon, currentRoomId]);

  const setCurrentRoomId = useCallback((id) => {
    setDungeonState((prev) => ({ ...prev, currentRoomId: id }));
  }, []);

  const setVisitedRoomIds = useCallback((updater) => {
    setDungeonState((prev) => ({
      ...prev,
      visitedRoomIds: typeof updater === "function" ? updater(prev.visitedRoomIds) : updater,
    }));
  }, []);

  const addVisited = useCallback((id) => {
    setDungeonState((prev) =>
      prev.visitedRoomIds.has(id) ? prev : { ...prev, visitedRoomIds: new Set([...prev.visitedRoomIds, id]) }
    );
  }, []);

  const setRoom = useCallback((updater) => {
    setDungeonState((prev) => ({
      ...prev,
      dungeon: {
        ...prev.dungeon,
        rooms: {
          ...prev.dungeon.rooms,
          [prev.currentRoomId]:
            typeof updater === "function"
              ? updater(prev.dungeon.rooms[prev.currentRoomId])
              : updater,
        },
      },
    }));
  }, []);

  const regenerate = useCallback(() => {
    const next = getInitialDungeonState();
    setDungeonState(next);
    setPath([]);
    setSelectedObjId(null);
    setInventory([]);
    setPendingObjId(null);
  }, []);

  return {
    dungeon,
    currentRoomId,
    setCurrentRoomId,
    visitedRoomIds,
    setVisitedRoomIds,
    addVisited,
    room,
    setRoom,
    playerPos,
    setPlayerPos,
    path,
    setPath,
    selectedObjId,
    setSelectedObjId,
    inventory,
    setInventory,
    pendingObjId,
    setPendingObjId,
    regenerate,
  };
}
