import { describe, expect, test } from "vitest";
import { SandboxExecutor } from "../sandbox";
import { CACHED_DEMOS, MANIFEST } from "./index";

describe("cached demos", () => {
  test("manifest contains all six canonical prompts in frozen order", () => {
    expect(MANIFEST.prompts.map((p) => p.slug)).toEqual([
      "red-sphere",
      "green-tree",
      "castle-with-four-towers",
      "spiral-staircase",
      "small-robot",
      "mushroom",
    ]);
    expect(MANIFEST.prompts.map((p) => p.text)).toEqual([
      "a red sphere",
      "a green tree",
      "a small castle with four towers",
      "a spiral staircase",
      "a small robot",
      "a mushroom",
    ]);
  });

  test("every manifest (prompt, model) has a corresponding cached script", () => {
    for (const p of MANIFEST.prompts) {
      for (const m of p.models) {
        const script = CACHED_DEMOS[p.slug]?.[m];
        expect(script, `${p.slug}/${m}.js missing`).toBeTruthy();
      }
    }
  });

  const entries: Array<[string, string, string]> = [];
  for (const [promptSlug, byModel] of Object.entries(CACHED_DEMOS)) {
    for (const [modelSlug, script] of Object.entries(byModel)) {
      entries.push([promptSlug, modelSlug, script]);
    }
  }

  test.each(entries)("demo executes without error: %s / %s", async (_p, _m, script) => {
    const executor = new SandboxExecutor();
    const result = await executor.execute(script);
    expect(result.ok, result.ok ? "" : JSON.stringify(result.error)).toBe(true);
  });
});
