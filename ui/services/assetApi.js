const BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_ASSET_API_URL
    ? import.meta.env.VITE_ASSET_API_URL.replace(/\/$/, "")
    : "";

function cacheKey(type, locked, open) {
  return `${type}:${!!locked}:${!!open}`;
}

function visualState(locked, open) {
  if (open) return "open";
  if (locked) return "closed_locked";
  return "closed_unlocked";
}

function typeDescription(type, state) {
  const locked = !!state?.locked;
  const open = !!state?.open;
  switch (type) {
    case "container_box":
      return open ? "wooden storage box, open, interior visible" : locked ? "wooden storage box, closed and locked" : "wooden storage box, closed and unlocked";
    case "container_safe":
      return open ? "metal safe, open door, interior visible" : locked ? "metal safe, closed and locked, lock visible" : "metal safe, closed and unlocked";
    case "surface_table":
      return "simple wooden table";
    case "decoration_flower":
      return "flower pot with leaves";
    case "decoration_lamp":
      return "table lamp, cozy light";
    default:
      return `${type} game object`;
  }
}

/**
 * In-memory cache: cacheKey -> { svg, image }.
 * image is set when the Image has loaded (so we can draw synchronously).
 */
const svgCache = new Map();
const imageCache = new Map();

export async function fetchSvg(type, state = {}) {
  const { locked = false, open = false } = state;
  const key = cacheKey(type, locked, open);
  if (svgCache.has(key)) return svgCache.get(key);
  if (!BASE) return null;

  const request = {
    key,
    subject_type: "generic_object",
    subject_id: type,
    state: visualState(locked, open),
    description: typeDescription(type, state),
    target_format: "svg",
    view_box: { w: type.startsWith("container_") || type.startsWith("surface_") ? 80 : 40, h: 40 },
    metadata: { source: "ui_preload" },
  };
  const res = await fetch(`${BASE}/v1/renders/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [request] }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Asset API ${res.status}: ${text || res.statusText}`);
  }
  const json = await res.json();
  const artifact = json?.artifacts?.[key];
  const svg = artifact?.content;
  if (typeof svg === "string" && svg.trim()) {
    svgCache.set(key, svg);
    return svg;
  }
  throw new Error("Asset API returned empty or invalid SVG");
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

export async function fetchPreload() {
  if (!BASE) throw new Error("VITE_ASSET_API_URL is not set");
  const requests = [
    { type: "container_box", state: { open: true, locked: false } },
    { type: "container_box", state: { open: false, locked: true } },
    { type: "container_box", state: { open: false, locked: false } },
    { type: "container_safe", state: { open: true, locked: false } },
    { type: "container_safe", state: { open: false, locked: true } },
    { type: "container_safe", state: { open: false, locked: false } },
    { type: "surface_table", state: { open: false, locked: false } },
    { type: "decoration_flower", state: { open: false, locked: false } },
    { type: "decoration_lamp", state: { open: false, locked: false } },
  ].map(({ type, state }) => {
    const key = cacheKey(type, state.locked, state.open);
    return {
      key,
      subject_type: "generic_object",
      subject_id: type,
      state: visualState(state.locked, state.open),
      description: typeDescription(type, state),
      target_format: "svg",
      view_box: { w: type.startsWith("container_") || type.startsWith("surface_") ? 80 : 40, h: 40 },
      metadata: { source: "ui_preload_batch" },
    };
  });
  const res = await fetch(`${BASE}/v1/renders/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Asset API ${res.status}: ${text || res.statusText}`);
  }
  const body = await res.json();
  const artifacts = body?.artifacts ?? {};
  if (!artifacts || typeof artifacts !== "object") throw new Error("Asset API preload returned invalid response");
  const map = {};
  for (const [key, artifact] of Object.entries(artifacts)) {
    const svg = artifact?.content;
    if (typeof svg === "string" && svg.trim()) svgCache.set(key, svg);
    if (typeof svg === "string" && svg.trim()) map[key] = svg;
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

export async function initializeWorld(world, seed = 0) {
  if (!BASE) throw new Error("VITE_ASSET_API_URL is not set");
  const res = await fetch(`${BASE}/v1/worlds/initialize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ world, seed, target_format: "svg" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`World API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function updateWorld(world, layout, placement, previousWorldHash = null) {
  if (!BASE) throw new Error("VITE_ASSET_API_URL is not set");
  const payload = {
    world,
    layout,
    placement,
    target_format: "svg",
  };
  if (previousWorldHash) payload.previous_world_hash = previousWorldHash;
  const res = await fetch(`${BASE}/v1/worlds/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`World API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export function preloadWorldSvgImages(artifacts) {
  const map = new Map();
  const entries = Object.entries(artifacts)
    .map(([key, artifact]) => [key, artifact?.content])
    .filter(([, svg]) => typeof svg === "string" && svg.trim());
  if (entries.length === 0) return Promise.resolve(map);
  return Promise.all(
    entries.map(([key, svg]) => {
      return new Promise((resolve, reject) => {
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          map.set(key, img);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error(`Failed to load world image: ${key}`));
        };
        img.src = url;
      });
    })
  ).then(() => map);
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
