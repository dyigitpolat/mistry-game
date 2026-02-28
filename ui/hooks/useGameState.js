import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { GRID_W, GRID_H } from "../constants/grid.js";
import { worldViewToDungeon } from "../domain/worldToDungeon.js";
import * as assetApi from "../services/assetApi.js";

function getInitialDungeonState() {
  return {
    dungeon: { rooms: {}, layout: {}, startRoomId: null },
    currentRoomId: null,
    visitedRoomIds: new Set(),
    playerPos: { x: Math.floor(GRID_W / 2), y: Math.floor(GRID_H / 2) },
    worldSvgImages: null,
    worldView: null,
  };
}

const FALLBACK_PLAYER_POS = { x: Math.floor(GRID_W / 2), y: Math.floor(GRID_H / 2) };

export function useGameState() {
  const didAutoLoad = useRef(false);
  const [dungeonState, setDungeonState] = useState(getInitialDungeonState);
  const {
    dungeon,
    currentRoomId,
    visitedRoomIds,
    playerPos: statePlayerPos,
    worldSvgImages,
    worldView,
  } = dungeonState;

  const [path, setPath] = useState([]);
  const [selectedObjId, setSelectedObjId] = useState(null);
  const [pendingObjId, setPendingObjId] = useState(null);
  const [worldLoadPending, setWorldLoadPending] = useState(false);
  const [worldLoadError, setWorldLoadError] = useState(/** @type {string | null} */ (null));

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
    setDungeonState((prev) => {
      if (!prev.currentRoomId || !prev.dungeon?.rooms?.[prev.currentRoomId]) return prev;
      const current = prev.dungeon.rooms[prev.currentRoomId];
      const nextRoom = typeof updater === "function" ? updater(current) : updater;
      return {
        ...prev,
        dungeon: {
          ...prev.dungeon,
          rooms: {
            ...prev.dungeon.rooms,
            [prev.currentRoomId]: nextRoom,
          },
        },
      };
    });
  }, []);

  const applyWorldView = useCallback((view, options = {}) => {
    const dungeonNext = worldViewToDungeon(view);
    const startRoom = dungeonNext.rooms[dungeonNext.startRoomId];
    const defaultPlayerPos = startRoom
      ? { x: Math.floor(startRoom.gridW / 2), y: Math.floor(startRoom.gridH / 2) }
      : FALLBACK_PLAYER_POS;
    setDungeonState((prev) => {
      const preferredRoomId = options.keepCurrentRoom && prev.currentRoomId && dungeonNext.rooms[prev.currentRoomId]
        ? prev.currentRoomId
        : dungeonNext.startRoomId;
      return {
        dungeon: dungeonNext,
        currentRoomId: preferredRoomId,
        visitedRoomIds: options.keepVisited && prev.visitedRoomIds.size > 0
          ? new Set([...prev.visitedRoomIds, preferredRoomId])
          : new Set([preferredRoomId]),
        playerPos: options.keepPlayerPos && prev.playerPos ? prev.playerPos : defaultPlayerPos,
        worldSvgImages: new Map(),
        worldView: view,
      };
    });

    assetApi
      .preloadWorldSvgImages(view.artifacts ?? {})
      .then((worldImages) => {
        setDungeonState((prev) => ({ ...prev, worldSvgImages: worldImages }));
      })
      .catch((err) => {
        setWorldLoadError(err?.message ?? "Failed to load world images");
      });

    setPath([]);
    setSelectedObjId(null);
    setPendingObjId(null);
  }, []);

  const loadTestWorld = useCallback(async () => {
    setWorldLoadPending(true);
    setWorldLoadError(null);
    try {
      const worldRes = await fetch("/exampleWorld.json");
      if (!worldRes.ok) throw new Error("Failed to fetch example world");
      const world = await worldRes.json();
      const view = await assetApi.initializeWorld(world, 0);
      applyWorldView(view);
    } catch (err) {
      setWorldLoadError(err?.message ?? "Failed to load test world");
    } finally {
      setWorldLoadPending(false);
    }
  }, [applyWorldView]);

  const refreshWorld = useCallback(async () => {
    if (!worldView?.world || !worldView?.layout || !worldView?.placement) return;
    setWorldLoadPending(true);
    setWorldLoadError(null);
    try {
      const next = await assetApi.updateWorld(
        worldView.world,
        worldView.layout,
        worldView.placement,
        worldView.world_hash ?? null
      );
      applyWorldView(next, { keepCurrentRoom: true, keepVisited: true, keepPlayerPos: true });
    } catch (err) {
      setWorldLoadError(err?.message ?? "Failed to refresh world view");
    } finally {
      setWorldLoadPending(false);
    }
  }, [worldView, applyWorldView]);

  useEffect(() => {
    if (didAutoLoad.current) return;
    didAutoLoad.current = true;
    loadTestWorld();
  }, [loadTestWorld]);

  const getWorldImage = useCallback(
    (key) => (worldSvgImages && worldSvgImages.get(key)) ?? null,
    [worldSvgImages]
  );

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
    pendingObjId,
    setPendingObjId,
    loadTestWorld,
    refreshWorld,
    getWorldImage,
    isWorldMode: worldSvgImages != null,
    worldLoadPending,
    worldLoadError,
  };
}
