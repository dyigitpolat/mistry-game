/**
 * Infrastructure: calls Mistral Conversations API.
 * Implements the LLM port used by the generateSvgForObject use case.
 */

const MISTRAL_CONVERSATIONS_URL = "https://api.mistral.ai/v1/conversations";

const SYSTEM_INSTRUCTIONS = `You are an SVG generator. Respond only with valid SVG markup. No explanations, no markdown code fences, no text before or after the SVG.
Rules: Use only the viewBox given in the user message. No script, no external images or URLs. Use simple shapes (rect, circle, path) and solid fills. Keep the design minimal and clear.`;

/** System instructions for batch variant generation (JSON response). State definitions avoid confusing "open" with "unlocked". */
export const VARIANT_JSON_INSTRUCTIONS = `You are an SVG generator. Respond only with a valid JSON object. No markdown code fences, no text before or after the JSON.
The JSON must have exactly these three keys: "open", "closed_locked", "closed_unlocked".
- "open" = lid/door is open, interior visible (physical open state).
- "closed_locked" = closed and locked (e.g. padlock or dial visible); cannot be opened.
- "closed_unlocked" = closed but not locked; no padlock; can be opened.
Each value must be the full SVG markup string for that state. Use the same visual style for all three. Use only the viewBox given. No script, no external images.`;

/**
 * @param {string} userMessage - The prompt describing the object and viewBox (e.g. "Generate SVG for: wooden box. viewBox 0 0 80 40.")
 * @param {{ apiKey?: string, maxTokens?: number, instructions?: string }} options
 * @returns {Promise<string>} Raw text response (SVG string or JSON string)
 */
export async function generateSvgFromDescription(userMessage, { apiKey, maxTokens = 2048, instructions } = {}) {
  const key = apiKey ?? process.env.MISTRAL_API_KEY;
  if (!key) {
    throw new Error("MISTRAL_API_KEY is not set");
  }
  const body = {
    model: "mistral-large-latest",
    inputs: [{ role: "user", content: userMessage }],
    tools: [],
    completion_args: { temperature: 0.3, max_tokens: maxTokens, top_p: 1 },
    instructions: instructions ?? SYSTEM_INSTRUCTIONS,
  };
  const res = await fetch(MISTRAL_CONVERSATIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mistral API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const content = extractMessageContent(data);
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Mistral API returned no content");
  }
  return stripMarkdownFences(content.trim());
}

/**
 * Extract text from conversation response.
 * Conversations API returns { outputs: [{ content: "..." }] }; Chat API returns { choices: [{ message: { content } }] }.
 * @param {object} data - API response
 * @returns {string}
 */
function extractMessageContent(data) {
  // Conversations API (POST /v1/conversations): response has outputs array
  const outputs = data.outputs;
  if (Array.isArray(outputs) && outputs.length > 0) {
    const first = outputs[0];
    const content = first?.content ?? first?.text;
    if (typeof content === "string") return content;
    if (typeof content === "object" && content?.type === "text" && content?.text) return content.text;
  }
  // Chat-style: message or choices[0].message
  const message = data.message ?? data.choices?.[0]?.message;
  if (!message) return "";
  const raw = message.content;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    const textPart = raw.find((p) => p.type === "text" && p.text);
    return textPart?.text ?? "";
  }
  return "";
}

/**
 * Remove markdown code fences if the model wrapped the SVG.
 * @param {string} s
 * @returns {string}
 */
function stripMarkdownFences(s) {
  const trimmed = s.trim();
  if (trimmed.startsWith("```")) {
    const firstLineEnd = trimmed.indexOf("\n");
    const rest = firstLineEnd >= 0 ? trimmed.slice(firstLineEnd + 1) : trimmed.slice(3);
    const endFence = rest.lastIndexOf("```");
    return endFence >= 0 ? rest.slice(0, endFence).trim() : rest.trim();
  }
  return trimmed;
}
