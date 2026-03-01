"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { GRID_W, GRID_H } from "../constants/grid.js";
import { worldViewToDungeon } from "../domain/worldToDungeon.js";
import * as assetApi from "../services/assetApi.js";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DungeonRoom {
  id: string;
  name: string;
  description: string;
  gridW: number;
  gridH: number;
  objects: any[];
  exits: Record<string, string>;
  connectionStates: Record<string, string>;
  exitNames: Record<string, string>;
  mood: any;
  [key: string]: any;
}

interface Dungeon {
  rooms: Record<string, DungeonRoom>;
  layout: Record<string, { row: number; col: number }>;
  startRoomId: string | null;
}

interface Pos {
  x: number;
  y: number;
}

interface WorldView {
  world: any;
  world_hash?: string;
  layout: any;
  placement: any;
  artifacts: Record<string, any>;
  moods: Record<string, any>;
  decorations: Record<string, any[]>;
}

export interface GameplayState {
  dungeon: Dungeon;
  currentRoomId: string | null;
  visitedRoomIds: Set<string>;
  playerPos: Pos;
  worldSvgImages: Map<string, HTMLImageElement> | null;
  worldView: WorldView | null;
}

export interface StatePatch {
  removedItems?: string[];
  objectStateChanges?: Array<{
    locationId: string;
    objectId: string;
    newState?: string;
  }>;
  connectionChanges?: Array<{
    locationId: string;
    targetLocationId: string;
    newState: "locked" | "unlocked";
  }>;
  addedItems?: Array<{
    locationId: string;
    objectId: string;
    item: { id: string; name: string; worldItemSvgKey: string };
  }>;
  newArtifacts?: Record<string, { content: string; mime_type: string }>;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

const FALLBACK_POS: Pos = {
  x: Math.floor(GRID_W / 2),
  y: Math.floor(GRID_H / 2),
};

function initialState(): GameplayState {
  return {
    dungeon: { rooms: {}, layout: {}, startRoomId: null },
    currentRoomId: null,
    visitedRoomIds: new Set(),
    playerPos: { ...FALLBACK_POS },
    worldSvgImages: null,
    worldView: null,
  };
}

export function useGameplayState(sessionId: string | null, currentLocation: string | undefined) {
  const [state, setState] = useState<GameplayState>(initialState);
  const {
    dungeon,
    currentRoomId,
    visitedRoomIds,
    playerPos: statePlayerPos,
    worldSvgImages,
    worldView,
  } = state;

  const [path, setPath] = useState<Pos[]>([]);
  const [selectedObjId, setSelectedObjId] = useState<string | null>(null);
  const [pendingObjId, setPendingObjId] = useState<string | null>(null);
  const [worldLoadPending, setWorldLoadPending] = useState(false);
  const [worldLoadError, setWorldLoadError] = useState<string | null>(null);
  const [worldLoadStage, setWorldLoadStage] = useState("idle");
  const [worldLoadProgress, setWorldLoadProgress] = useState({ loaded: 0, total: 0 });
  const [worldLoadPreviewSrcs, setWorldLoadPreviewSrcs] = useState<string[]>([]);

  const initRef = useRef(false);

  const playerPos = statePlayerPos ?? FALLBACK_POS;

  const setPlayerPos = useCallback((posOrUpdater: Pos | ((prev: Pos) => Pos)) => {
    setState((prev) => ({
      ...prev,
      playerPos:
        typeof posOrUpdater === "function"
          ? posOrUpdater(prev.playerPos ?? FALLBACK_POS)
          : posOrUpdater,
    }));
  }, []);

  const room = useMemo(() => {
    if (!dungeon?.rooms) return null;
    return dungeon.rooms[currentRoomId!] ?? (dungeon.startRoomId ? dungeon.rooms[dungeon.startRoomId] : null);
  }, [dungeon, currentRoomId]);

  const setCurrentRoomId = useCallback((id: string) => {
    setState((prev) => ({ ...prev, currentRoomId: id }));
  }, []);

  const addVisited = useCallback((id: string) => {
    setState((prev) =>
      prev.visitedRoomIds.has(id)
        ? prev
        : { ...prev, visitedRoomIds: new Set([...prev.visitedRoomIds, id]) },
    );
  }, []);

  const setRoom = useCallback((updater: (room: DungeonRoom) => DungeonRoom) => {
    setState((prev) => {
      if (!prev.currentRoomId || !prev.dungeon?.rooms?.[prev.currentRoomId]) return prev;
      const current = prev.dungeon.rooms[prev.currentRoomId];
      const nextRoom = updater(current);
      return {
        ...prev,
        dungeon: {
          ...prev.dungeon,
          rooms: { ...prev.dungeon.rooms, [prev.currentRoomId]: nextRoom },
        },
      };
    });
  }, []);

  /* ── Apply a WorldView (layout + artifacts) to dungeon state ──── */

  const applyWorldView = useCallback(
    async (view: WorldView, options: { keepCurrentRoom?: boolean; keepVisited?: boolean; keepPlayerPos?: boolean } = {}) => {
      const dungeonNext = worldViewToDungeon(view) as Dungeon;
      const startRoom = dungeonNext.rooms[dungeonNext.startRoomId!];
      const defaultPos = startRoom
        ? { x: Math.floor(startRoom.gridW / 2), y: Math.floor(startRoom.gridH / 2) }
        : FALLBACK_POS;

      setState((prev) => {
        const preferredRoomId =
          options.keepCurrentRoom && prev.currentRoomId && dungeonNext.rooms[prev.currentRoomId]
            ? prev.currentRoomId
            : dungeonNext.startRoomId;
        return {
          dungeon: dungeonNext,
          currentRoomId: preferredRoomId,
          visitedRoomIds:
            options.keepVisited && prev.visitedRoomIds.size > 0
              ? new Set([...prev.visitedRoomIds, preferredRoomId!])
              : new Set([preferredRoomId!]),
          playerPos: options.keepPlayerPos && prev.playerPos ? prev.playerPos : defaultPos,
          worldSvgImages: new Map(),
          worldView: view,
        };
      });

      setWorldLoadPreviewSrcs([]);
      setWorldLoadProgress({ loaded: 0, total: Object.keys(view.artifacts ?? {}).length });

      const worldImages = await assetApi.preloadWorldSvgImages(
        view.artifacts ?? {},
        ({ image, loaded, total }: any) => {
          setWorldLoadProgress({ loaded, total });
          if (image?.src) {
            setWorldLoadPreviewSrcs((prev: string[]) => {
              if (prev.includes(image.src)) return prev;
              return prev.length >= 18 ? [...prev.slice(-17), image.src] : [...prev, image.src];
            });
          }
        },
      );
      setState((prev) => ({ ...prev, worldSvgImages: worldImages }));
      setPath([]);
      setSelectedObjId(null);
      setPendingObjId(null);
    },
    [],
  );

  /* ── Initialize world from the backend session ───────────────── */

  const initializeFromSession = useCallback(
    async (sid: string) => {
      setWorldLoadPending(true);
      setWorldLoadError(null);
      setWorldLoadStage("initializing");
      try {
        const view = await assetApi.initializeWorldForSession(sid);
        setWorldLoadStage("loading-images");
        await applyWorldView(view);
        setWorldLoadStage("done");
      } catch (err: any) {
        setWorldLoadError(err?.message ?? "Failed to initialize world");
        setWorldLoadStage("error");
      } finally {
        setWorldLoadPending(false);
      }
    },
    [applyWorldView],
  );

  /* ── Auto-initialize when sessionId is first available ────────── */

  useEffect(() => {
    if (!sessionId || initRef.current) return;
    initRef.current = true;
    initializeFromSession(sessionId);
  }, [sessionId, initializeFromSession]);

  /* ── Sync room when the narrative engine changes currentLocation ─ */

  useEffect(() => {
    if (!currentLocation || !dungeon?.rooms) return;

    const matchedRoomId = Object.keys(dungeon.rooms).find((id) => {
      const r = dungeon.rooms[id];
      return r.name === currentLocation || id === currentLocation;
    });

    if (matchedRoomId && matchedRoomId !== currentRoomId) {
      setCurrentRoomId(matchedRoomId);
      addVisited(matchedRoomId);
      const targetRoom = dungeon.rooms[matchedRoomId];
      if (targetRoom) {
        setPlayerPos({
          x: Math.floor(targetRoom.gridW / 2),
          y: Math.floor(targetRoom.gridH / 2),
        });
      }
      setPath([]);
      setSelectedObjId(null);
    }
  }, [currentLocation, dungeon, currentRoomId, setCurrentRoomId, addVisited, setPlayerPos]);

  /* ── Apply state patches from ActionResponse ─────────────────── */

  const applyStatePatch = useCallback(
    (patch: StatePatch) => {
      setState((prev) => {
        if (!prev.currentRoomId) return prev;
        const rooms = { ...prev.dungeon.rooms };
        const rid = prev.currentRoomId;
        const room = rooms[rid];
        if (!room) return prev;

        let objects = [...room.objects];

        // Remove picked-up items from containers/surfaces
        if (patch.removedItems?.length) {
          const removed = new Set(patch.removedItems.map((n) => n.toLowerCase()));
          objects = objects.map((obj) => {
            if (!obj.items?.length) return obj;
            const filtered = obj.items.filter(
              (it: any) => !removed.has(it.name?.toLowerCase()) && !removed.has(it.id?.toLowerCase()),
            );
            if (filtered.length === obj.items.length) return obj;
            return { ...obj, items: filtered };
          });
        }

        // Update object states (container open/close, lock/unlock)
        if (patch.objectStateChanges?.length) {
          for (const change of patch.objectStateChanges) {
            if (change.locationId !== rid) continue;
            objects = objects.map((obj) => {
              if (obj.id !== change.objectId) return obj;
              const newState = change.newState;
              const locked = newState === "locked";
              const open = newState === "open";
              const parts = (obj.worldSvgKey ?? "").split(":");
              const visualState = open ? "open" : locked ? "closed_locked" : "closed_unlocked";
              const worldSvgKey = parts.length >= 4
                ? `${parts.slice(0, 3).join(":")}:${visualState}`
                : obj.worldSvgKey;
              return { ...obj, locked, open, state: newState, worldSvgKey };
            });
          }
        }

        // Add newly introduced items to containers/surfaces
        if (patch.addedItems?.length) {
          for (const added of patch.addedItems) {
            const targetRoomId = added.locationId || rid;
            const targetRoom = rooms[targetRoomId] ?? room;
            if (targetRoomId !== rid) {
              const tr = { ...targetRoom, objects: [...targetRoom.objects] };
              const objIdx = tr.objects.findIndex((o: any) => o.id === added.objectId);
              if (objIdx >= 0) {
                const obj = { ...tr.objects[objIdx], items: [...(tr.objects[objIdx].items ?? [])] };
                obj.items.push(added.item);
                tr.objects[objIdx] = obj;
              }
              rooms[targetRoomId] = tr;
              continue;
            }
            const objIdx = objects.findIndex((o: any) => o.id === added.objectId);
            if (objIdx >= 0) {
              const obj = { ...objects[objIdx], items: [...(objects[objIdx].items ?? [])] };
              obj.items.push(added.item);
              objects[objIdx] = obj;
            }
          }
        }

        // Update connection states
        let connStates = { ...room.connectionStates };
        if (patch.connectionChanges?.length) {
          for (const cc of patch.connectionChanges) {
            if (cc.locationId !== rid) continue;
            for (const [dir, targetId] of Object.entries(room.exits)) {
              if (targetId === cc.targetLocationId) {
                connStates[dir] = cc.newState;
              }
            }
          }
        }

        rooms[rid] = { ...room, objects, connectionStates: connStates };

        // Merge new artifact images into worldSvgImages
        let imgs = prev.worldSvgImages;
        if (patch.newArtifacts && Object.keys(patch.newArtifacts).length > 0) {
          imgs = new Map(prev.worldSvgImages ?? []);
          for (const [key, art] of Object.entries(patch.newArtifacts)) {
            const img = new Image();
            img.src = `data:${art.mime_type};base64,${art.content}`;
            imgs.set(key, img);
          }
        }

        return { ...prev, dungeon: { ...prev.dungeon, rooms }, worldSvgImages: imgs };
      });
    },
    [],
  );

  /* ── Get world image by artifact key ────────────────────────── */

  const getWorldImage = useCallback(
    (key: string) => (worldSvgImages && worldSvgImages.get(key)) ?? null,
    [worldSvgImages],
  );

  return {
    dungeon,
    currentRoomId,
    setCurrentRoomId,
    visitedRoomIds,
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
    getWorldImage,
    isWorldMode: worldSvgImages != null,
    worldLoadPending,
    worldLoadError,
    worldLoadStage,
    worldLoadProgress,
    worldLoadPreviewSrcs,
    applyStatePatch,
    initializeFromSession,
  };
}
