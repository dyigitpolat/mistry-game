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
  const [worldLoadStage, setWorldLoadStage] = useState("idle");
  const [worldLoadProgress, setWorldLoadProgress] = useState({ loaded: 0, total: 0 });
  const [worldLoadPreviewSrcs, setWorldLoadPreviewSrcs] = useState([]);

  const trace = useCallback((stage, extra = null) => {
    const suffix = extra ? ` ${JSON.stringify(extra)}` : "";
    // eslint-disable-next-line no-console
    console.log(`[useGameState] ${stage}${suffix}`);
    setWorldLoadStage(stage);
  }, []);

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

  const applyWorldView = useCallback(async (view, options = {}) => {
    trace("applyWorldView:start", { artifactCount: Object.keys(view?.artifacts ?? {}).length });
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

    setWorldLoadPreviewSrcs([]);
    setWorldLoadProgress({ loaded: 0, total: Object.keys(view.artifacts ?? {}).length });
    const worldImages = await assetApi.preloadWorldSvgImages(view.artifacts ?? {}, ({ image, loaded, total }) => {
      setWorldLoadProgress({ loaded, total });
      if (image?.src) {
        setWorldLoadPreviewSrcs((prev) => {
          if (prev.includes(image.src)) return prev;
          return prev.length >= 18 ? [...prev.slice(-17), image.src] : [...prev, image.src];
        });
      }
    });
    trace("applyWorldView:imagesLoaded", { imageCount: worldImages.size });
    setDungeonState((prev) => ({ ...prev, worldSvgImages: worldImages }));

    setPath([]);
    setSelectedObjId(null);
    setPendingObjId(null);
    trace("applyWorldView:done");
  }, [trace]);

  const loadTestWorld = useCallback(async () => {
    trace("loadTestWorld:start");
    setWorldLoadPending(true);
    setWorldLoadError(null);
    try {
      trace("loadTestWorld:fetchExampleWorld");
      const worldRes = await fetch("/exampleWorld.json");
      if (!worldRes.ok) throw new Error("Failed to fetch example world");
      const world = await worldRes.json();
      trace("loadTestWorld:initializeWorld:request");
      const view = await assetApi.initializeWorld(world, 0);
      trace("loadTestWorld:initializeWorld:response");
      trace("loadTestWorld:preloadImages:start");
      await applyWorldView(view);
      trace("loadTestWorld:preloadImages:done");
    } catch (err) {
      trace("loadTestWorld:error", { message: err?.message ?? String(err) });
      setWorldLoadError(err?.message ?? "Failed to load test world");
    } finally {
      setWorldLoadPending(false);
      trace("loadTestWorld:finally");
    }
  }, [applyWorldView, trace]);

  const refreshWorld = useCallback(async () => {
    if (!worldView?.world || !worldView?.layout || !worldView?.placement) return;
    trace("refreshWorld:start");
    setWorldLoadPending(true);
    setWorldLoadError(null);
    try {
      trace("refreshWorld:updateWorld:request");
      const next = await assetApi.updateWorld(
        worldView.world,
        worldView.layout,
        worldView.placement,
        worldView.world_hash ?? null
      );
      trace("refreshWorld:updateWorld:response");
      trace("refreshWorld:preloadImages:start");
      await applyWorldView(next, { keepCurrentRoom: true, keepVisited: true, keepPlayerPos: true });
      trace("refreshWorld:preloadImages:done");
    } catch (err) {
      trace("refreshWorld:error", { message: err?.message ?? String(err) });
      setWorldLoadError(err?.message ?? "Failed to refresh world view");
    } finally {
      setWorldLoadPending(false);
      trace("refreshWorld:finally");
    }
  }, [worldView, applyWorldView, trace]);

  useEffect(() => {
    if (didAutoLoad.current) return;
    didAutoLoad.current = true;
    loadTestWorld();
  }, [loadTestWorld]);

  useEffect(() => {
    if (!worldLoadPending) return undefined;
    let stopped = false;
    const poll = async () => {
      try {
        const snap = await assetApi.fetchDebugPreviews();
        if (stopped || !snap) return;
        if (typeof snap.expected_total === "number" && typeof snap.completed_total === "number") {
          setWorldLoadProgress({ loaded: snap.completed_total, total: snap.expected_total });
        }
        if (Array.isArray(snap.previews)) {
          const srcs = snap.previews
            .map((p) => p?.data_url)
            .filter((v) => typeof v === "string" && v.startsWith("data:image/png;base64,"));
          if (srcs.length > 0) {
            setWorldLoadPreviewSrcs(srcs.slice(-18));
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log("[useGameState] debug-preview poll failed", err?.message ?? String(err));
      }
    };
    poll();
    const id = setInterval(poll, 1000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [worldLoadPending]);

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
    worldLoadStage,
    worldLoadProgress,
    worldLoadPreviewSrcs,
  };
}
