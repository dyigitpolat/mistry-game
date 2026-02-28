import { useEffect } from "react";
import { MOVE_DELAY } from "../constants/grid.js";
import { getGateDirectionAt, getTileInsideGate, OPPOSITE_DIR } from "../domain/geometry.js";

export function useMovement({
  path,
  setPath,
  setPlayerPos,
  pendingObjId,
  setPendingObjId,
  setSelectedObjId,
  room,
  currentRoomId,
  dungeon,
  setCurrentRoomId,
  addVisited,
  onLockedGate,
}) {
  useEffect(() => {
    if (path.length === 0) {
      if (pendingObjId) {
        setSelectedObjId(pendingObjId);
        setPendingObjId(null);
      }
      return;
    }

    const nextStep = path[0];
    const hasDungeon = dungeon?.rooms && room?.exits;
    const exitDir =
      hasDungeon && room
        ? getGateDirectionAt(nextStep.x, nextStep.y, room.gridW, room.gridH)
        : null;
    const nextRoomId = exitDir && room.exits[exitDir] ? room.exits[exitDir] : null;

    if (nextRoomId) {
      const connState = room.connectionStates?.[exitDir];
      if (connState === "locked") {
        setPath([]);
        setPendingObjId(null);
        onLockedGate?.(room.exitNames?.[exitDir] ?? nextRoomId);
        return;
      }
      const nextRoom = dungeon.rooms[nextRoomId];
      if (nextRoom) {
        addVisited(currentRoomId);
        addVisited(nextRoomId);
        setCurrentRoomId(nextRoomId);
        const enteredFrom = OPPOSITE_DIR[exitDir];
        setPlayerPos(getTileInsideGate(enteredFrom, nextRoom.gridW, nextRoom.gridH));
        setPath([]);
        setPendingObjId(null);
        setSelectedObjId(null);
      }
      return;
    }

    const timer = setTimeout(() => {
      setPlayerPos(nextStep);
      setPath((p) => p.slice(1));
    }, MOVE_DELAY);
    return () => clearTimeout(timer);
  }, [
    path,
    pendingObjId,
    room,
    currentRoomId,
    dungeon,
    setPath,
    setPlayerPos,
    setPendingObjId,
    setSelectedObjId,
    setCurrentRoomId,
    addVisited,
    onLockedGate,
  ]);
}
