import { useEffect } from "react";
import { MOVE_DELAY } from "../constants/grid.js";
import { getGateDirectionAt, getTileInsideGate, OPPOSITE_DIR } from "../domain/geometry.js";

/**
 * Consumes `path` step-by-step to move the player.
 *
 * When the player steps onto a gate tile:
 *   - If `onRoomChangeRequest` is provided, it fires the callback with the
 *     target location name and blocks the transition.  The actual room switch
 *     happens later when the parent updates `currentLocation`.
 *   - Otherwise falls back to instant local room switching (standalone mode).
 */
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
  onRoomChangeRequest,
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

      // Mediated room change: fire callback and wait for parent to update currentLocation
      if (onRoomChangeRequest) {
        const targetName = room.exitNames?.[exitDir] ?? nextRoomId;
        setPath([]);
        setPendingObjId(null);
        setSelectedObjId(null);
        onRoomChangeRequest(targetName);
        return;
      }

      // Fallback: instant local room switch (standalone mode)
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
    onRoomChangeRequest,
  ]);
}
