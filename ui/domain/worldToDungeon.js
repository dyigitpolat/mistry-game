/**
 * Transform world API response (world, layout, placement) into dungeon/room shape for the UI.
 * Objects get worldSvgKey for rendering; items get worldItemSvgKey when drawn from world SVGs.
 */

const CONTAINER_STATE_TO_VISUAL = {
  open: "open",
  closed: "closed_unlocked",
  locked: "closed_locked",
};

function visualStateForObject(category, state) {
  if (category === "container" && state) {
    return CONTAINER_STATE_TO_VISUAL[state] ?? "closed_unlocked";
  }
  return "closed";
}

const FLOOR_KEYWORDS = {
  ceramic: ["kitchen", "bathroom", "tile", "ceramic", "hearth"],
  grass: ["garden", "courtyard", "yard", "outside", "forest", "clearing"],
  stone: ["hallway", "corridor", "cellar", "dungeon", "basement", "crypt", "cave", "passage"],
};

function inferFloorType(description) {
  const lower = (description || "").toLowerCase();
  for (const [type, keywords] of Object.entries(FLOOR_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return type;
  }
  return "wood";
}

function buildExitNames(exits, locations) {
  const names = {};
  for (const [dir, locId] of Object.entries(exits)) {
    if (locId && locations[locId]) {
      names[dir] = locations[locId].name ?? locId;
    }
  }
  return names;
}

/**
 * @param {{ world: { locations: Record<string, { name: string, objects: unknown[], people: unknown[] }> }, layout: { grid: object, locations: Record<string, { row: number, col: number, gridW: number, gridH: number, gates: object, exits: object }> }, placement: { rooms: Record<string, { objects: Array<{ id: string, x: number, y: number, w: number, h: number }>, people: Array<{ id: string, x: number, y: number }> }> } }} view
 * @returns {{ rooms: Record<string, import("./room.js").Room>, layout: Record<string, { row: number, col: number }>, startRoomId: string }}
 */
export function worldViewToDungeon(view) {
  const { world, layout, placement, moods } = view;
  const locIds = Object.keys(world.locations).sort();
  const startRoomId = locIds[0] ?? null;
  const rooms = {};
  const layoutOut = {};

  for (const locId of locIds) {
    const loc = world.locations[locId];
    const layoutLoc = layout.locations[locId];
    const placed = placement?.rooms?.[locId] ?? { objects: [], people: [] };
    if (!layoutLoc) continue;

    layoutOut[locId] = { row: layoutLoc.row, col: layoutLoc.col };

    const objectsByPlaced = new Map(placed.objects.map((o) => [o.id, o]));

    const roomObjects = [];
    for (const obj of loc.objects ?? []) {
      const placedObj = objectsByPlaced.get(obj.id);
      if (!placedObj) continue;
      const visualState = visualStateForObject(obj.category, obj.state);
      const worldSvgKey = `object:${locId}:${obj.id}:${visualState}`;
      const items = (obj.contains ?? []).map((item) => ({
        id: item.id,
        name: item.name ?? item.id,
        color: "#8a7355",
        description: item.description ?? "",
        notes: item.notes ?? "",
        worldItemSvgKey: `item:${locId}:${obj.id}:${item.id}`,
      }));
      roomObjects.push({
        id: obj.id,
        name: obj.name ?? obj.id,
        description: obj.description ?? "",
        type: "world_object",
        worldSvgKey,
        x: placedObj.x,
        y: placedObj.y,
        w: placedObj.w ?? (obj.category === "item" ? 1 : 2),
        h: placedObj.h ?? 1,
        locked: obj.state === "locked",
        open: obj.state === "open",
        items,
        category: obj.category,
        notes: obj.notes ?? "",
      });
    }

    for (const person of loc.people ?? []) {
      const placedPerson = (placed.people ?? []).find((p) => p.id === person.id);
      if (!placedPerson) continue;
      const state = person.state ?? "alive";
      const worldSvgKey = `person:${locId}:${person.id}:${state}`;
      roomObjects.push({
        id: person.id,
        name: person.name ?? person.id,
        description: person.description ?? "",
        notes: person.notes ?? "",
        state: state,
        type: "world_person",
        worldSvgKey,
        x: placedPerson.x,
        y: placedPerson.y,
        w: 2,
        h: 2,
        locked: false,
        open: false,
        items: [],
      });
    }

    rooms[locId] = {
      id: locId,
      name: loc.name ?? locId,
      description: loc.description ?? "",
      width: layoutLoc.gridW - 2,
      height: layoutLoc.gridH - 2,
      gridW: layoutLoc.gridW,
      gridH: layoutLoc.gridH,
      floorType: inferFloorType(loc.description ?? ""),
      mood: moods?.[locId] ?? null,
      gates: layoutLoc.gates ?? { N: false, E: false, S: false, W: false },
      exits: layoutLoc.exits ?? {},
      connectionStates: layoutLoc.connectionStates ?? {},
      exitNames: buildExitNames(layoutLoc.exits ?? {}, world.locations),
      objects: roomObjects,
    };
  }

  return {
    rooms,
    layout: layoutOut,
    startRoomId: startRoomId || Object.keys(rooms)[0],
  };
}
