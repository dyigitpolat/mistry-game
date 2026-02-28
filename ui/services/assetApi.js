/**
 * Fetches SVG from the asset_generation API and caches by type + state.
 * Used by useGeneratedAssets. Application layer: knows base URL, no rendering.
 * Preload: one call to GET /svg/preload returns all SVGs; then create Images in parallel.
 */

const BASE = typeof import.meta !== "undefined" && import.meta.env?.VITE_ASSET_API_URL
  ? import.meta.env.VITE_ASSET_API_URL.replace(/\/$/, "")
  : "";

function cacheKey(type, locked, open) {
  return `${type}:${!!locked}:${!!open}`;
}

/**
 * In-memory cache: cacheKey -> { svg, image }.
 * image is set when the Image has loaded (so we can draw synchronously).
 */
const svgCache = new Map();
const imageCache = new Map();

/**
 * Fetch SVG from backend. Returns cached SVG string if present.
 * When BASE is set and the request fails or returns non-OK, throws (so callers can show an error).
 * @param {string} type - Object type
 * @param {{ locked?: boolean, open?: boolean }} state
 * @returns {Promise<string | null>} SVG string, or null only when BASE is not set
 */
export async function fetchSvg(type, state = {}) {
  const { locked = false, open = false } = state;
  const key = cacheKey(type, locked, open);
  if (svgCache.has(key)) return svgCache.get(key);
  if (!BASE) return null;
  try {
    const url = `${BASE}/svg?type=${encodeURIComponent(type)}&locked=${locked}&open=${open}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Asset API ${res.status}: ${text || res.statusText}`);
    }
    const contentType = res.headers.get("content-type") || "";
    let svg;
    if (contentType.includes("application/json")) {
      const json = await res.json();
      svg = json.svg;
    } else {
      svg = await res.text();
    }
    if (typeof svg === "string" && svg.trim()) {
      svgCache.set(key, svg);
      return svg;
    }
    throw new Error("Asset API returned empty or invalid SVG");
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error("Failed to fetch asset");
  }
}

/**
 * Get a loaded Image for the given type+state, or null if not yet loaded.
 * Call ensureImageFor(type, state, onLoad) to trigger fetch and image creation; onLoad is called when the image is ready (so you can re-render).
 * @param {string} type
 * @param {{ locked?: boolean, open?: boolean }} state
 * @returns {HTMLImageElement | null}
 */
export function getImage(type, state = {}) {
  const { locked = false, open = false } = state;
  const key = cacheKey(type, locked, open);
  const img = imageCache.get(key);
  if (img && img.complete && img.naturalWidth) return img;
  return null;
}

/**
 * Fetch all assets in one request (backend generates them in parallel). Returns map of cacheKey -> SVG string.
 * @returns {Promise<Record<string, string>>}
 */
export async function fetchPreload() {
  if (!BASE) throw new Error("VITE_ASSET_API_URL is not set");
  const res = await fetch(`${BASE}/svg/preload`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Asset API ${res.status}: ${text || res.statusText}`);
  }
  const map = await res.json();
  if (!map || typeof map !== "object") throw new Error("Asset API preload returned invalid response");
  for (const [key, svg] of Object.entries(map)) {
    if (typeof svg === "string" && svg.trim()) svgCache.set(key, svg);
  }
  return map;
}

/**
 * Create Images from a preload map in parallel; store in imageCache. Resolves when all loaded, rejects on first error.
 * @param {Record<string, string>} map - cacheKey -> SVG string
 * @returns {Promise<void>}
 */
export function preloadAllImagesFromMap(map) {
  const entries = Object.entries(map).filter(([, svg]) => typeof svg === "string" && svg.trim());
  if (entries.length === 0) return Promise.resolve();
  return Promise.all(
    entries.map(([key, svg]) => {
      return new Promise((resolve, reject) => {
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          imageCache.set(key, img);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Failed to load image"));
        };
        img.src = url;
      });
    })
  ).then(() => {});
}

/**
 * Ensure we have an SVG and an Image for this type+state. Fetches if needed, creates Image from blob URL.
 * Returns a Promise that resolves when the image is ready, or rejects if fetch or image load fails.
 * @param {string} type
 * @param {{ locked?: boolean, open?: boolean }} state
 * @param {() => void} [onLoad] - Optional callback when the image is ready (e.g. trigger re-render)
 * @returns {Promise<void>}
 */
export function ensureImageFor(type, state, onLoad) {
  const key = cacheKey(type, state.locked ?? false, state.open ?? false);
  if (imageCache.get(key)?.complete) {
    onLoad?.();
    return Promise.resolve();
  }
  return fetchSvg(type, state).then((svg) => {
    if (!svg) return;
    return new Promise((resolve, reject) => {
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        imageCache.set(key, img);
        onLoad?.();
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image"));
      };
      img.src = url;
    });
  });
}
