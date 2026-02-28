/**
 * Hook: preloads all generated SVG variants once at startup and exposes getImage for rendering.
 * When VITE_USE_GENERATED_ASSETS is not true, getImage always returns null (procedural fallback).
 * Exposes isInitializing (true until all SVGs are loaded or one fails) and error (message if any load failed).
 * Assets are loaded only once; object state changes (locked/open) use the cache.
 */

import { useState, useEffect, useCallback } from "react";
import * as assetApi from "../services/assetApi.js";

const USE_GENERATED = typeof import.meta !== "undefined" && import.meta.env?.VITE_USE_GENERATED_ASSETS === "true";

/** All (type, locked, open) combinations we ever need. Lockables: 3 states (open, closed_locked, closed_unlocked). Loaded once so state changes don't re-fetch. */
const ALL_ASSET_KEYS = [
  { type: "container_box", locked: false, open: true },
  { type: "container_box", locked: true, open: false },
  { type: "container_box", locked: false, open: false },
  { type: "container_safe", locked: false, open: true },
  { type: "container_safe", locked: true, open: false },
  { type: "container_safe", locked: false, open: false },
  { type: "surface_table", locked: false, open: false },
  { type: "decoration_flower", locked: false, open: false },
  { type: "decoration_lamp", locked: false, open: false },
];

/**
 * @returns {{ getImage: (type: string, state: { locked?: boolean, open?: boolean }) => HTMLImageElement | null, isInitializing: boolean, error: string | null }}
 */
export function useGeneratedAssets() {
  const [isInitializing, setIsInitializing] = useState(USE_GENERATED);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [, setTick] = useState(0);
  const onLoad = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!USE_GENERATED) {
      setIsInitializing(false);
      setError(null);
      return;
    }
    setIsInitializing(true);
    setError(null);
    assetApi
      .fetchPreload()
      .then((map) => assetApi.preloadAllImagesFromMap(map))
      .then(() => {
        setIsInitializing(false);
        onLoad();
      })
      .catch((err) => {
        setIsInitializing(false);
        setError(err?.message ?? "Failed to load assets");
      });
  }, [onLoad]);

  const getImage = useCallback((type, state = {}) => {
    if (!USE_GENERATED) return null;
    return assetApi.getImage(type, state);
  }, []);

  return { getImage, isInitializing, error };
}
