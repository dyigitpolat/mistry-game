/**
 * Unit tests for object descriptions (domain).
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { getObjectDescription, getViewBoxForType, getVisualStateKey } from "./objectDescriptions.js";

describe("getObjectDescription", () => {
  it("returns descriptions for container_box by state", () => {
    assert(getObjectDescription("container_box", {}).includes("wooden"));
    assert(getObjectDescription("container_box", { open: true }).includes("open"));
    assert(getObjectDescription("container_box", { locked: true }).includes("locked"));
  });
  it("returns descriptions for container_safe by state", () => {
    assert(getObjectDescription("container_safe", { locked: true }).includes("locked"));
    assert(getObjectDescription("container_safe", { open: true }).includes("open"));
  });
  it("returns descriptions for other types", () => {
    assert(getObjectDescription("surface_table").includes("table"));
    assert(getObjectDescription("decoration_flower").includes("flower"));
    assert(getObjectDescription("decoration_lamp").includes("lamp"));
  });
  it("returns fallback for unknown type", () => {
    assert.strictEqual(getObjectDescription("unknown_type"), "game object: unknown_type");
  });
});

describe("getViewBoxForType", () => {
  it("returns viewBox for known types", () => {
    assert.deepStrictEqual(getViewBoxForType("container_box"), { w: 80, h: 40 });
    assert.deepStrictEqual(getViewBoxForType("container_safe"), { w: 40, h: 40 });
  });
  it("returns default for unknown type", () => {
    assert.deepStrictEqual(getViewBoxForType("unknown"), { w: 40, h: 40 });
  });
});

describe("getVisualStateKey", () => {
  it("returns open for lockables when open", () => {
    assert.strictEqual(getVisualStateKey("container_box", false, true), "open");
    assert.strictEqual(getVisualStateKey("container_safe", true, true), "open");
  });
  it("returns closed_locked for lockables when closed and locked", () => {
    assert.strictEqual(getVisualStateKey("container_box", true, false), "closed_locked");
    assert.strictEqual(getVisualStateKey("container_safe", true, false), "closed_locked");
  });
  it("returns closed_unlocked for lockables when closed and unlocked", () => {
    assert.strictEqual(getVisualStateKey("container_box", false, false), "closed_unlocked");
    assert.strictEqual(getVisualStateKey("container_safe", false, false), "closed_unlocked");
  });
  it("returns open/closed for non-lockables", () => {
    assert.strictEqual(getVisualStateKey("surface_table", false, true), "open");
    assert.strictEqual(getVisualStateKey("surface_table", false, false), "closed");
  });
});
