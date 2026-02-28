/**
 * Unit tests for generateSvgVariantsForType (mocked LLM port).
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { generateSvgVariantsForType } from "./generateSvgVariantsForType.js";

const minimalSvg = (key) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"><rect fill="brown" width="80" height="40"/><text>${key}</text></svg>`;

async function mockGateway(userMessage, opts) {
  return JSON.stringify({
    open: minimalSvg("open"),
    closed_locked: minimalSvg("closed_locked"),
    closed_unlocked: minimalSvg("closed_unlocked"),
  });
}

describe("generateSvgVariantsForType", () => {
  it("returns all three visual state keys when port returns valid JSON", async () => {
    const result = await generateSvgVariantsForType("container_box", mockGateway);
    assert.strictEqual(Object.keys(result).length, 3);
    assert(result.open?.includes("<svg"));
    assert(result.closed_locked?.includes("<svg"));
    assert(result.closed_unlocked?.includes("<svg"));
  });

  it("throws for non-lockable type", async () => {
    await assert.rejects(
      () => generateSvgVariantsForType("surface_table", mockGateway),
      /does not have lockable variants/
    );
  });
});
