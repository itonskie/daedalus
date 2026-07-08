import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { LLMProvider } from "../src/llm";
import { runBench, sanitizeModelSlug } from "./bench";

async function makeTmp(): Promise<string> {
  return await mkdtemp(join(tmpdir(), "daedalus-bench-"));
}

function stubProvider(id: "anthropic" | "ollama", body: () => string): LLMProvider {
  return {
    id,
    async generateVoxelScript() {
      return body();
    },
  };
}

async function listFilesRecursive(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await listFilesRecursive(p);
      for (const s of sub) out.push(`${entry.name}/${s}`);
    } else {
      out.push(entry.name);
    }
  }
  return out.sort();
}

describe("sanitizeModelSlug", () => {
  test("replaces ':' with '-'", () => {
    expect(sanitizeModelSlug("qwen3-coder:30b")).toBe("qwen3-coder-30b");
  });

  test("replaces '/' with '-'", () => {
    expect(sanitizeModelSlug("meta/llama3")).toBe("meta-llama3");
  });

  test("lowercases", () => {
    expect(sanitizeModelSlug("Claude-Sonnet-4-6")).toBe("claude-sonnet-4-6");
  });
});

describe("runBench", () => {
  let demosDir: string;

  beforeEach(async () => {
    demosDir = await makeTmp();
  });

  afterEach(async () => {
    await rm(demosDir, { recursive: true, force: true });
  });

  test("fails loud when ANTHROPIC_API_KEY is missing", async () => {
    const result = await runBench({
      demosDir,
      env: { OLLAMA_URL: "http://localhost:11434" },
      fetchImpl: (async () => new Response("ok", { status: 200 })) as unknown as typeof fetch,
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/ANTHROPIC_API_KEY/);
  });

  test("fails loud when Ollama is unreachable, even if Anthropic key is set", async () => {
    const result = await runBench({
      demosDir,
      env: { ANTHROPIC_API_KEY: "sk-ant-xxx", OLLAMA_URL: "http://localhost:11434" },
      fetchImpl: (async () => {
        throw new TypeError("Failed to fetch");
      }) as unknown as typeof fetch,
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/Ollama/i);
  });

  test("both providers stubbed → writes 12 .js files + manifest.json + results.md", async () => {
    const script = 'sphere(32,24,32,8,"red")';
    const result = await runBench({
      demosDir,
      providers: [
        {
          provider: stubProvider("anthropic", () => script),
          displayModel: "claude-sonnet-4-6",
          modelSlug: sanitizeModelSlug("claude-sonnet-4-6"),
        },
        {
          provider: stubProvider("ollama", () => script),
          displayModel: "qwen3-coder:30b",
          modelSlug: sanitizeModelSlug("qwen3-coder:30b"),
        },
      ],
    });
    expect(result.exitCode).toBe(0);

    const files = await listFilesRecursive(demosDir);
    const expected = [
      "castle-with-four-towers/claude-sonnet-4-6.js",
      "castle-with-four-towers/qwen3-coder-30b.js",
      "green-tree/claude-sonnet-4-6.js",
      "green-tree/qwen3-coder-30b.js",
      "manifest.json",
      "mushroom/claude-sonnet-4-6.js",
      "mushroom/qwen3-coder-30b.js",
      "red-sphere/claude-sonnet-4-6.js",
      "red-sphere/qwen3-coder-30b.js",
      "results.md",
      "small-robot/claude-sonnet-4-6.js",
      "small-robot/qwen3-coder-30b.js",
      "spiral-staircase/claude-sonnet-4-6.js",
      "spiral-staircase/qwen3-coder-30b.js",
    ];
    expect(files).toEqual(expected);

    const written = await readFile(join(demosDir, "red-sphere", "claude-sonnet-4-6.js"), "utf8");
    expect(written.trim()).toBe(script);
  });

  test("model slug sanitization: qwen3-coder:30b writes qwen3-coder-30b.js", async () => {
    const result = await runBench({
      demosDir,
      providers: [
        {
          provider: stubProvider("ollama", () => 'place(0,0,0,"red")'),
          displayModel: "qwen3-coder:30b",
          modelSlug: sanitizeModelSlug("qwen3-coder:30b"),
        },
      ],
    });
    expect(result.exitCode).toBe(0);
    const files = await readdir(join(demosDir, "red-sphere"));
    expect(files).toContain("qwen3-coder-30b.js");
  });

  test("broken generation (syntax error): does NOT overwrite existing file, results row says failed, exit code stays 0", async () => {
    // Seed an existing good file for red-sphere/claude-sonnet-4-6.js
    const existing = 'sphere(32,24,32,8,"blue")';
    await mkdir(join(demosDir, "red-sphere"), { recursive: true });
    await writeFile(join(demosDir, "red-sphere", "claude-sonnet-4-6.js"), existing);

    // Provider returns broken script only for the first prompt (red-sphere)
    let call = 0;
    const brokenThenOk = () => {
      call += 1;
      if (call === 1) return "!!!not js"; // syntax error
      return 'sphere(32,24,32,8,"red")';
    };

    const result = await runBench({
      demosDir,
      providers: [
        {
          provider: stubProvider("anthropic", brokenThenOk),
          displayModel: "claude-sonnet-4-6",
          modelSlug: sanitizeModelSlug("claude-sonnet-4-6"),
        },
      ],
    });
    expect(result.exitCode).toBe(0);

    // Existing file untouched
    const kept = await readFile(join(demosDir, "red-sphere", "claude-sonnet-4-6.js"), "utf8");
    expect(kept).toBe(existing);

    // results.md mentions failed · syntax
    const results = await readFile(join(demosDir, "results.md"), "utf8");
    expect(results).toMatch(/failed · syntax/);
  });

  test("manifest.json only lists (prompt, model) pairs that have a file on disk after the run", async () => {
    // Only provide a script for prompts whose slug starts with "red" or "green".
    const providerAnthropic: LLMProvider = {
      id: "anthropic",
      async generateVoxelScript(prompt: string) {
        if (prompt === "a red sphere" || prompt === "a green tree") {
          return 'sphere(32,24,32,8,"red")';
        }
        return "!!!broken"; // syntax error → no file written
      },
    };
    const result = await runBench({
      demosDir,
      providers: [
        {
          provider: providerAnthropic,
          displayModel: "claude-sonnet-4-6",
          modelSlug: sanitizeModelSlug("claude-sonnet-4-6"),
        },
      ],
    });
    expect(result.exitCode).toBe(0);

    const manifest = JSON.parse(await readFile(join(demosDir, "manifest.json"), "utf8"));
    expect(manifest.version).toBe(1);
    const bySlug = new Map<string, string[]>();
    for (const p of manifest.prompts) bySlug.set(p.slug, p.models);
    expect(bySlug.get("red-sphere")).toEqual(["claude-sonnet-4-6"]);
    expect(bySlug.get("green-tree")).toEqual(["claude-sonnet-4-6"]);
    // Prompts with no files must be absent (or have empty models)
    for (const other of [
      "castle-with-four-towers",
      "spiral-staircase",
      "small-robot",
      "mushroom",
    ]) {
      const models = bySlug.get(other);
      if (models !== undefined) expect(models).toEqual([]);
    }
  });

  test("results.md includes elapsed seconds for successful cells", async () => {
    const providerScript = 'sphere(32,24,32,8,"red")';
    let calls = 0;
    const slow: LLMProvider = {
      id: "anthropic",
      async generateVoxelScript() {
        calls += 1;
        // Deterministic elapsed via now() clock. We'll drive it below.
        return providerScript;
      },
    };
    // Fixed clock that advances by 3 seconds between successive calls.
    let ticks = 0;
    const now = () => new Date(1_700_000_000_000 + ticks++ * 3000);

    const result = await runBench({
      demosDir,
      providers: [
        {
          provider: slow,
          displayModel: "claude-sonnet-4-6",
          modelSlug: sanitizeModelSlug("claude-sonnet-4-6"),
        },
      ],
      now,
    });
    expect(result.exitCode).toBe(0);
    expect(calls).toBeGreaterThan(0);

    const results = await readFile(join(demosDir, "results.md"), "utf8");
    // Every ok row includes an elapsed number followed by 's'.
    expect(results).toMatch(/ok · \d+ line/);
    expect(results).toMatch(/\d+s/);
  });

  test("results.md header includes 'Last run: YYYY-MM-DD' (UTC ok)", async () => {
    const fixed = new Date("2026-07-08T15:04:05Z");
    const result = await runBench({
      demosDir,
      providers: [
        {
          provider: stubProvider("anthropic", () => 'sphere(32,24,32,8,"red")'),
          displayModel: "claude-sonnet-4-6",
          modelSlug: sanitizeModelSlug("claude-sonnet-4-6"),
        },
      ],
      now: () => fixed,
    });
    expect(result.exitCode).toBe(0);

    const results = await readFile(join(demosDir, "results.md"), "utf8");
    expect(results).toMatch(/Last run: 2026-07-08/);
  });
});
