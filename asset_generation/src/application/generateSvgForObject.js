/**
 * Application use case: generate SVG for a game object type and state.
 * Depends on domain (descriptions, viewBox) and an LLM port (injected).
 */

import { getObjectDescription, getViewBoxForType } from "../domain/objectDescriptions.js";

/**
 * @typedef { (description: string, viewBox: { w: number, h: number }) => Promise<string> } SvgGeneratorPort
 */

/**
 * @param {string} type - Object type (e.g. container_box, container_safe)
 * @param {{ locked?: boolean, open?: boolean }} state - Optional state
 * @param {SvgGeneratorPort} generateSvgFromDescription - LLM port (e.g. Mistral gateway)
 * @returns {Promise<string>} SVG markup string
 */
export async function generateSvgForObject(type, state, generateSvgFromDescription) {
  const description = getObjectDescription(type, state);
  const viewBox = getViewBoxForType(type);
  const userMessage = `Generate a very detailed and carefully constructed SVG for: ${description}. Use viewBox "0 0 ${viewBox.w} ${viewBox.h}". Output only the SVG element.`;
  const raw = await generateSvgFromDescription(userMessage, { viewBox });
  return ensureSvgString(raw);
}

/**
 * Ensure we return a string that looks like SVG (optional basic validation).
 * @param {string} raw
 * @returns {string}
 */
function ensureSvgString(raw) {
  const s = raw.trim();
  if (!s.toLowerCase().includes("<svg")) {
    throw new Error("LLM response does not contain SVG markup");
  }
  return s;
}
