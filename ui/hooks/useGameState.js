import { useState, useCallback } from "react";
import { GRID_W, GRID_H } from "../constants/grid.js";
import { generateRoom } from "../domain/roomGeneration.js";

export function useGameState() {
  const [room, setRoom] = useState(() => generateRoom());
  const [playerPos, setPlayerPos] = useState({
    x: Math.floor(GRID_W / 2),
    y: Math.floor(GRID_H / 2),
  });
  const [path, setPath] = useState([]);
  const [selectedObjId, setSelectedObjId] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [pendingObjId, setPendingObjId] = useState(null);

  const regenerate = useCallback(() => {
    const newRoom = generateRoom();
    setRoom(newRoom);
    setPlayerPos({ x: Math.floor(newRoom.gridW / 2), y: Math.floor(newRoom.gridH / 2) });
    setPath([]);
    setSelectedObjId(null);
    setInventory([]);
    setPendingObjId(null);
  }, []);

  return {
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
