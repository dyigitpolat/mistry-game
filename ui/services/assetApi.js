const BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_ASSET_API_URL
    ? import.meta.env.VITE_ASSET_API_URL.replace(/\/$/, "")
    : typeof import.meta !== "undefined" && import.meta.env?.DEV
      ? "http://127.0.0.1:3001"
      : "";
const API_TIMEOUT_MS =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_ASSET_API_TIMEOUT_MS
    ? Number(import.meta.env.VITE_ASSET_API_TIMEOUT_MS)
    : 45000;
const INITIALIZE_WORLD_TIMEOUT_MS =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_INITIALIZE_WORLD_TIMEOUT_MS
    ? Number(import.meta.env.VITE_INITIALIZE_WORLD_TIMEOUT_MS)
    : 10 * 60 * 1000;
const DEBUG_LOGS =
  typeof import.meta !== "undefined" && import.meta.env?.DEV;

function log(...args) {
  if (!DEBUG_LOGS) return;
  // eslint-disable-next-line no-console
  console.log("[assetApi]", ...args);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  log("request:start", options?.method ?? "GET", url, { timeoutMs });
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    log("request:end", options?.method ?? "GET", url, {
      ok: response.ok,
      status: response.status,
      ms: Math.round(performance.now() - startedAt),
    });
    return response;
  } catch (err) {
    log("request:error", options?.method ?? "GET", url, err?.message ?? String(err));
    if (err?.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

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

const artifactCache = new Map();
const imageCache = new Map();

function artifactToDataUrl(artifact) {
  if (!artifact || typeof artifact !== "object") return null;
  const mime = typeof artifact.mime_type === "string" ? artifact.mime_type : "image/png";
  const content = typeof artifact.content === "string" ? artifact.content.trim() : "";
  if (!content) return null;
  if (content.startsWith("data:")) return content;
  if (mime === "image/png") return `data:image/png;base64,${content}`;
  if (mime === "image/svg+xml") {
    const blob = new Blob([content], { type: "image/svg+xml" });
    return URL.createObjectURL(blob);
  }
  return `data:${mime};base64,${content}`;
}

export async function fetchArtifact(type, state = {}) {
  const { locked = false, open = false } = state;
  const key = cacheKey(type, locked, open);
  if (artifactCache.has(key)) return artifactCache.get(key);
  if (!BASE) return null;

  const request = {
    key,
    subject_type: "generic_object",
    subject_id: type,
    state: visualState(locked, open),
    description: typeDescription(type, state),
    target_format: "png",
    view_box: { w: type.startsWith("container_") || type.startsWith("surface_") ? 80 : 40, h: 40 },
    metadata: { source: "ui_preload" },
  };
  const res = await fetchWithTimeout(`${BASE}/v1/renders/batch`, {
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
  const content = artifact?.content;
  if (typeof content === "string" && content.trim()) {
    artifactCache.set(key, artifact);
    return artifact;
  }
  throw new Error("Asset API returned empty or invalid artifact");
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
      target_format: "png",
      view_box: { w: type.startsWith("container_") || type.startsWith("surface_") ? 80 : 40, h: 40 },
      metadata: { source: "ui_preload_batch" },
    };
  });
  const res = await fetchWithTimeout(`${BASE}/v1/renders/batch`, {
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
    const content = artifact?.content;
    if (typeof content === "string" && content.trim()) {
      artifactCache.set(key, artifact);
      map[key] = artifact;
    }
  }
  return map;
}

/**
 * Create Images from a preload map in parallel; store in imageCache. Resolves when all loaded, rejects on first error.
 * @param {Record<string, { mime_type: string, content: string }>} map - cacheKey -> artifact
 * @returns {Promise<void>}
 */
export function preloadAllImagesFromMap(map) {
  const entries = Object.entries(map).filter(([, artifact]) => artifactToDataUrl(artifact));
  if (entries.length === 0) return Promise.resolve();
  return Promise.all(
    entries.map(([key, artifact]) => {
      return new Promise((resolve, reject) => {
        const url = artifactToDataUrl(artifact);
        if (!url) {
          reject(new Error("Failed to resolve artifact URL"));
          return;
        }
        const img = new Image();
        img.onload = () => {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
          imageCache.set(key, img);
          resolve();
        };
        img.onerror = () => {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
          reject(new Error("Failed to load image"));
        };
        img.src = url;
      });
    })
  ).then(() => {});
}

export async function initializeWorld(world, seed = 0) {
  if (!BASE) throw new Error("VITE_ASSET_API_URL is not set");
  const res = await fetchWithTimeout(
    `${BASE}/v1/worlds/initialize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ world, seed, target_format: "png" }),
    },
    INITIALIZE_WORLD_TIMEOUT_MS
  );
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
    target_format: "png",
  };
  if (previousWorldHash) payload.previous_world_hash = previousWorldHash;
  const res = await fetchWithTimeout(`${BASE}/v1/worlds/update`, {
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

export async function fetchDebugPreviews() {
  if (!BASE) return null;
  const res = await fetchWithTimeout(`${BASE}/v1/debug/previews`, {}, 10000);
  if (!res.ok) return null;
  return res.json();
}

export function preloadWorldSvgImages(artifacts, onImageLoaded) {
  const map = new Map();
  const entries = Object.entries(artifacts)
    .map(([key, artifact]) => [key, artifact])
    .filter(([, artifact]) => !!artifactToDataUrl(artifact));
  if (entries.length === 0) return Promise.resolve(map);
  let loaded = 0;
  const total = entries.length;
  return Promise.allSettled(
    entries.map(([key, artifact]) => {
      return new Promise((resolve) => {
        const url = artifactToDataUrl(artifact);
        if (!url) {
          resolve();
          return;
        }
        const img = new Image();
        img.onload = () => {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
          map.set(key, img);
          loaded += 1;
          onImageLoaded?.({ key, image: img, loaded, total });
          resolve();
        };
        img.onerror = () => {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
          loaded += 1;
          onImageLoaded?.({ key, image: null, loaded, total, error: true });
          resolve();
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
  return fetchArtifact(type, state).then((artifact) => {
    if (!artifact) return;
    return new Promise((resolve, reject) => {
      const url = artifactToDataUrl(artifact);
      if (!url) {
        reject(new Error("Invalid artifact data"));
        return;
      }
      const img = new Image();
      img.onload = () => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
        imageCache.set(key, img);
        onLoad?.();
        resolve();
      };
      img.onerror = () => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
        reject(new Error("Failed to load image"));
      };
      img.src = url;
    });
  });
}
