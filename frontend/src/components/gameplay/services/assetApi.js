/**
 * Asset API client — routes through the Next.js proxy to the merged backend.
 *
 * Session-based endpoints go to /api/proxy/game/{sessionId}/world/*
 * Direct asset endpoints go to /api/proxy/v1/*
 */

const PROXY_BASE = "/api/proxy";
const API_TIMEOUT_MS = 45000;
const INITIALIZE_WORLD_TIMEOUT_MS = 10 * 60 * 1000;
const DEBUG_LOGS = typeof window !== "undefined" && process.env.NODE_ENV === "development";

function log(...args) {
  if (!DEBUG_LOGS) return;
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

export async function initializeWorldForSession(sessionId) {
  const res = await fetchWithTimeout(
    `${PROXY_BASE}/game/${sessionId}/world/initialize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    INITIALIZE_WORLD_TIMEOUT_MS,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`World init ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function updateWorldForSession(sessionId, world, layout, placement, previousWorldHash = null) {
  const payload = { world, layout, placement, target_format: "png" };
  if (previousWorldHash) payload.previous_world_hash = previousWorldHash;
  const res = await fetchWithTimeout(
    `${PROXY_BASE}/game/${sessionId}/world/update`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`World update ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function fetchDebugPreviews() {
  const res = await fetchWithTimeout(`${PROXY_BASE}/v1/debug/previews`, {}, 10000);
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
        if (!url) { resolve(); return; }
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
    }),
  ).then(() => map);
}
