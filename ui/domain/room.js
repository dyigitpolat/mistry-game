import { INTERIOR_W, INTERIOR_H } from "../constants/grid.js";

let _uid = 0;

export function uid(prefix = "o") {
  return `${prefix}_${++_uid}`;
}

export function resetUid() {
  _uid = 0;
}

export function createItem(name, color) {
  return { id: uid("item"), name, color };
}

const DEFAULTS = {
  container_box:    { w: 2, h: 1, locked: false, open: false, items: [] },
  container_safe:   { w: 1, h: 1, locked: true,  open: false, items: [] },
  surface_table:    { w: 2, h: 1, items: [] },
  decoration_flower: { w: 1, h: 1 },
  decoration_lamp:   { w: 1, h: 1 },
  window:            { w: 2, h: 0, wall: "N" },
};

export function createRoomObject(type, x, y, props = {}) {
  return { id: uid("obj"), type, x, y, ...(DEFAULTS[type] || {}), ...props };
}

export function createRoom(config = {}) {
  const {
    id = null,
    width = INTERIOR_W,
    height = INTERIOR_H,
    floorType = "wood",
    gates = { S: true },
    exits = {},
    objects = [],
  } = config;
  const gatesResolved = Object.keys(exits).length
    ? { N: !!exits.N, E: !!exits.E, S: !!exits.S, W: !!exits.W }
    : gates;
  return {
    id,
    width,
    height,
    gridW: width + 2,
    gridH: height + 2,
    floorType,
    gates: gatesResolved,
    exits: exits && typeof exits === "object" ? exits : {},
    objects,
  };
}
