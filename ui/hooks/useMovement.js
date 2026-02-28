import { useEffect } from "react";
import { MOVE_DELAY } from "../constants/grid.js";

export function useMovement({
  path,
  setPath,
  setPlayerPos,
  pendingObjId,
  setPendingObjId,
  setSelectedObjId,
}) {
  useEffect(() => {
    if (path.length === 0) {
      if (pendingObjId) {
        setSelectedObjId(pendingObjId);
        setPendingObjId(null);
      }
      return;
    }
    const timer = setTimeout(() => {
      setPlayerPos(path[0]);
      setPath(p => p.slice(1));
    }, MOVE_DELAY);
    return () => clearTimeout(timer);
  }, [path, pendingObjId, setPath, setPlayerPos, setPendingObjId, setSelectedObjId]);
}
