/**
 * Application use case: generate all lockable SVG variants (open, closed_locked, closed_unlocked) in one LLM call
 * so the model keeps a consistent visual style across states.
 */

import { LOCKABLE_TYPES, LOCKABLE_VISUAL_STATES, getVariantBatchPromptInfo } from "../domain/objectDescriptions.js";

/**
 * @param {string} type - container_box or container_safe
 * @param {(msg: string, opts: { maxTokens?: number }) => Promise<string>} generateFromPrompt - LLM port
 * @returns {Promise<Record<string, string>>} Map of visual state key (open, closed_locked, closed_unlocked) -> SVG string
 */
export async function generateSvgVariantsForType(type, generateFromPrompt) {
  if (!LOCKABLE_TYPES.includes(type)) {
    throw new Error(`Type ${type} does not have lockable variants`);
  }
  const { objectName, viewBox, stateDescriptions, visualStateKeys } = getVariantBatchPromptInfo(type);
  const keysList = (visualStateKeys ?? LOCKABLE_VISUAL_STATES).map((k) => `"${k}"`).join(", ");
  const userMessage = `Generate three SVG versions of the same ${objectName}. Each key must match this exact meaning: ${stateDescriptions}
Use the exact same visual style, colors, and proportions for all three so they clearly look like the same object in different states.
Return a JSON object with exactly these keys (each value is the full SVG markup string): ${keysList}.
Use viewBox "0 0 ${viewBox.w} ${viewBox.h}" for every SVG. Output only the JSON object, no other text.`;

  const raw = await generateFromPrompt(userMessage, { maxTokens: 8192 });
  const json = parseJsonResponse(raw);
  const result = /** @type {Record<string, string>} */ ({});
  for (const key of LOCKABLE_VISUAL_STATES) {
    const svg = json[key];
    if (typeof svg !== "string" || !svg.trim()) {
      throw new Error(`Model did not return valid SVG for key "${key}"`);
    }
    result[key] = ensureSvgString(svg);
  }
  return result;
}

/**
 * @param {string} raw - Response text (may be wrapped in markdown code fence)
 * @returns {Record<string, string>}
 */
function parseJsonResponse(raw) {
  const trimmed = raw.trim();
  let toParse = trimmed;
  if (trimmed.startsWith("```")) {
    const firstLineEnd = trimmed.indexOf("\n");
    toParse = firstLineEnd >= 0 ? trimmed.slice(firstLineEnd + 1) : trimmed.slice(3);
    const endFence = toParse.lastIndexOf("```");
    if (endFence >= 0) toParse = toParse.slice(0, endFence);
    toParse = toParse.trim();
  }
  try {
    const parsed = JSON.parse(toParse);
    if (!parsed || typeof parsed !== "object") throw new Error("JSON is not an object");
    return parsed;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error("Model response is not valid JSON: " + e.message);
    }
    throw e;
  }
}

function ensureSvgString(s) {
  const t = s.trim();
  if (!t.toLowerCase().includes("<svg")) {
    throw new Error("LLM response does not contain SVG markup");
  }
  return t;
}
