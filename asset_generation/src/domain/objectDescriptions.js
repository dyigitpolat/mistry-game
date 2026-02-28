/**
 * Maps object type and state to a short human description for the LLM prompt.
 * Also provides default viewBox dimensions per type (for consistent SVG sizing).
 * Pure domain logic; no I/O.
 */

/** Default viewBox width and height per type. UI tile is 40px; 1 tile = 40 units. */
export const VIEWBOX_BY_TYPE = {
  container_box: { w: 80, h: 40 },
  container_safe: { w: 40, h: 40 },
  surface_table: { w: 80, h: 40 },
  decoration_flower: { w: 40, h: 40 },
  decoration_lamp: { w: 40, h: 40 },
};

/**
 * @param {string} type - Object type (e.g. container_box, container_safe)
 * @param {{ locked?: boolean, open?: boolean }} state - Optional state
 * @returns {string} Short description for the LLM
 */
export function getObjectDescription(type, state = {}) {
  const { locked = false, open = false } = state;
  switch (type) {
    case "container_box":
      if (open) return "wooden storage box, lid open, interior visible";
      return locked ? "wooden storage box, closed and locked" : "wooden storage box, closed and unlocked";
    case "container_safe":
      if (open) return "metal safe, door open, interior visible";
      return locked ? "metal safe, closed and locked, dial visible" : "metal safe, closed and unlocked";
    case "surface_table":
      return "wooden table";
    case "decoration_flower":
      return "flower pot with plant";
    case "decoration_lamp":
      return "desk lamp";
    default:
      return `game object: ${type}`;
  }
}

/**
 * @param {string} type
 * @returns {{ w: number, h: number }} viewBox dimensions
 */
export function getViewBoxForType(type) {
  return VIEWBOX_BY_TYPE[type] ?? { w: 40, h: 40 };
}

/** Lockable types: 3 visual states (open, closed_locked, closed_unlocked). */
export const LOCKABLE_TYPES = ["container_box", "container_safe"];

/** JSON keys for lockable batch generation. */
export const LOCKABLE_VISUAL_STATES = ["open", "closed_locked", "closed_unlocked"];

/**
 * Single source of truth: what each lockable visual state means. Use in prompts so the model does not confuse "open" with "unlocked".
 * - open: lid/door is open, interior visible (physical state).
 * - closed_locked: closed and locked (e.g. padlock or dial visible); cannot open without unlocking.
 * - closed_unlocked: closed but not locked; can be opened (no padlock visible).
 */
export const LOCKABLE_STATE_DESCRIPTIONS = {
  open: "open: the lid or door is open; the interior is visible.",
  closed_locked: "closed_locked: the container is closed and locked (e.g. padlock or dial visible); it cannot be opened without unlocking.",
  closed_unlocked: "closed_unlocked: the container is closed but not locked; no padlock visible; it can be opened.",
};

/**
 * Map game state (locked, open) to visual state key. Single source of truth.
 * Lockables: open -> "open"; closed+locked -> "closed_locked"; closed+unlocked -> "closed_unlocked".
 * Non-lockables with open/close: open -> "open"; closed -> "closed". Single-state types -> "closed".
 * @param {string} type
 * @param {boolean} locked
 * @param {boolean} open
 * @returns {string}
 */
export function getVisualStateKey(type, locked, open) {
  if (LOCKABLE_TYPES.includes(type)) {
    if (open) return "open";
    return locked ? "closed_locked" : "closed_unlocked";
  }
  if (open) return "open";
  return "closed";
}

/** For lockables: (locked, open) for each visual state key. Used by API to fill cache. */
export const LOCKABLE_VISUAL_STATE_TO_GAME_STATE = {
  open: { locked: false, open: true },
  closed_locked: { locked: true, open: false },
  closed_unlocked: { locked: false, open: false },
};

/**
 * Human-readable description of the 3 lockable states for the batch prompt. Uses LOCKABLE_STATE_DESCRIPTIONS for coherence.
 * @param {string} type - container_box or container_safe
 * @returns {{ objectName: string, viewBox: { w: number, h: number }, stateDescriptions: string, visualStateKeys: string[] }}
 */
export function getVariantBatchPromptInfo(type) {
  const viewBox = getViewBoxForType(type);
  const stateDescriptions = LOCKABLE_VISUAL_STATES.map((k) => LOCKABLE_STATE_DESCRIPTIONS[k]).join(" ");
  switch (type) {
    case "container_box":
      return {
        objectName: "wooden storage box",
        viewBox,
        stateDescriptions,
        visualStateKeys: LOCKABLE_VISUAL_STATES,
      };
    case "container_safe":
      return {
        objectName: "metal safe with dial",
        viewBox,
        stateDescriptions,
        visualStateKeys: LOCKABLE_VISUAL_STATES,
      };
    default:
      return { objectName: type, viewBox, stateDescriptions, visualStateKeys: LOCKABLE_VISUAL_STATES };
  }
}
