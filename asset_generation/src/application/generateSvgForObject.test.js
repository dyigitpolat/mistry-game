/**
 * Unit tests for generateSvgForObject use case (mocked LLM port).
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { generateSvgForObject } from "./generateSvgForObject.js";

async function mockSvgGenerator(userMessage, _options) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"><rect width="80" height="40" fill="brown"/></svg>`;
}

describe("generateSvgForObject", () => {
  it("returns SVG string when port returns valid SVG", async () => {
    const svg = await generateSvgForObject(
      "container_box",
      { locked: false, open: false },
      mockSvgGenerator
    );
    assert(svg.includes("<svg"));
    assert(svg.includes("viewBox"));
  });
  it("throws when port returns non-SVG", async () => {
    const noSvg = async () => "Just text";
    await assert.rejects(
      () => generateSvgForObject("container_box", {}, noSvg),
      /does not contain SVG/
    );
  });
});
