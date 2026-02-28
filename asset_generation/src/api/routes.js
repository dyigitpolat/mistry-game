/**
 * HTTP API: thin layer over generateSvgForObject and generateSvgVariantsForType.
 * Caches SVGs by type:locked:open. For lockables, generates all 3 states in one LLM call.
 * GET /svg/preload generates all assets in parallel and returns them in one response.
 */

import { generateSvgForObject } from "../application/generateSvgForObject.js";
import { generateSvgVariantsForType } from "../application/generateSvgVariantsForType.js";
import { LOCKABLE_TYPES, LOCKABLE_VISUAL_STATE_TO_GAME_STATE } from "../domain/objectDescriptions.js";
import { generateSvgFromDescription, VARIANT_JSON_INSTRUCTIONS } from "../infrastructure/mistralGateway.js";

const SUPPORTED_TYPES = [
  "container_box",
  "container_safe",
  "surface_table",
  "decoration_flower",
  "decoration_lamp",
];

/** In-memory cache: "type:locked:open" -> SVG string. */
const svgCache = new Map();

function cacheKey(type, locked, open) {
  return `${type}:${locked}:${open}`;
}

/** Call gateway with variant JSON instructions for batch generation. */
function generateWithVariantInstructions(userMessage, opts = {}) {
  return generateSvgFromDescription(userMessage, {
    ...opts,
    instructions: VARIANT_JSON_INSTRUCTIONS,
  });
}

/** Run all asset generations in parallel; fill cache and return map of cacheKey -> svg. */
async function generateAllInParallel() {
  const [boxVariants, safeVariants, tableSvg, flowerSvg, lampSvg] = await Promise.all([
    generateSvgVariantsForType("container_box", generateWithVariantInstructions),
    generateSvgVariantsForType("container_safe", generateWithVariantInstructions),
    generateSvgForObject("surface_table", { locked: false, open: false }, generateSvgFromDescription),
    generateSvgForObject("decoration_flower", { locked: false, open: false }, generateSvgFromDescription),
    generateSvgForObject("decoration_lamp", { locked: false, open: false }, generateSvgFromDescription),
  ]);
  const out = /** @type {Record<string, string>} */ ({});
  for (const [visualKey, gameState] of Object.entries(LOCKABLE_VISUAL_STATE_TO_GAME_STATE)) {
    const s = boxVariants[visualKey];
    if (s) {
      const key = cacheKey("container_box", gameState.locked, gameState.open);
      svgCache.set(key, s);
      out[key] = s;
    }
  }
  for (const [visualKey, gameState] of Object.entries(LOCKABLE_VISUAL_STATE_TO_GAME_STATE)) {
    const s = safeVariants[visualKey];
    if (s) {
      const key = cacheKey("container_safe", gameState.locked, gameState.open);
      svgCache.set(key, s);
      out[key] = s;
    }
  }
  const singleKeys = [
    ["surface_table", tableSvg],
    ["decoration_flower", flowerSvg],
    ["decoration_lamp", lampSvg],
  ];
  for (const [type, svg] of singleKeys) {
    const key = cacheKey(type, false, false);
    svgCache.set(key, svg);
    out[key] = svg;
  }
  return out;
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function getSvg(req, res) {
  const type = req.query.type;
  const locked = req.query.locked === "true";
  const open = req.query.open === "true";

  if (!type || !SUPPORTED_TYPES.includes(type)) {
    res.status(400).json({
      error: "Missing or invalid 'type' query parameter",
      allowed: SUPPORTED_TYPES,
    });
    return;
  }

  const key = cacheKey(type, locked, open);

  try {
    let svg = svgCache.get(key);
    if (svg) {
      const accept = req.headers.accept || "";
      if (accept.includes("application/json")) {
        res.set("Content-Type", "application/json").json({ svg });
      } else {
        res.set("Content-Type", "image/svg+xml").send(svg);
      }
      return;
    }

    if (LOCKABLE_TYPES.includes(type)) {
      const variants = await generateSvgVariantsForType(type, generateWithVariantInstructions);
      for (const [visualKey, gameState] of Object.entries(LOCKABLE_VISUAL_STATE_TO_GAME_STATE)) {
        const s = variants[visualKey];
        if (s) svgCache.set(cacheKey(type, gameState.locked, gameState.open), s);
      }
      svg = svgCache.get(key) ?? null;
    } else {
      svg = await generateSvgForObject(type, { locked, open }, generateSvgFromDescription);
      svgCache.set(key, svg);
    }

    if (!svg) {
      res.status(500).json({ error: "Failed to generate SVG" });
      return;
    }
    const accept = req.headers.accept || "";
    if (accept.includes("application/json")) {
      res.set("Content-Type", "application/json").json({ svg });
    } else {
      res.set("Content-Type", "image/svg+xml").send(svg);
    }
  } catch (err) {
    console.error("getSvg error:", err.message);
    res.status(500).json({ error: err.message || "Failed to generate SVG" });
  }
}

/**
 * GET /svg/preload: generate all assets in parallel, fill cache, return JSON { "type:locked:open": "<svg>...", ... }.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function getPreload(req, res) {
  try {
    const all = await generateAllInParallel();
    res.set("Content-Type", "application/json").json(all);
  } catch (err) {
    console.error("getPreload error:", err.message);
    res.status(500).json({ error: err.message || "Failed to preload assets" });
  }
}
