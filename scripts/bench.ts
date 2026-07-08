import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AnthropicProvider, type LLMProvider, LLMProviderError, OllamaProvider } from "../src/llm";
import type { Executor } from "../src/sandbox";
import { BenchSandboxExecutor } from "./bench-sandbox";

interface PromptSpec {
  slug: string;
  text: string;
}

const PROMPTS: readonly PromptSpec[] = [
  { slug: "red-sphere", text: "a red sphere" },
  { slug: "green-tree", text: "a green tree" },
  { slug: "castle-with-four-towers", text: "a small castle with four towers" },
  { slug: "spiral-staircase", text: "a spiral staircase" },
  { slug: "small-robot", text: "a small robot" },
  { slug: "mushroom", text: "a mushroom" },
];

export interface ProviderEntry {
  provider: LLMProvider;
  displayModel: string;
  modelSlug: string;
}

export interface BenchOptions {
  demosDir?: string;
  env?: Record<string, string | undefined>;
  providers?: ProviderEntry[];
  executor?: Executor;
  now?: () => Date;
  fetchImpl?: typeof fetch;
}

export interface BenchResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface CellResult {
  ok: boolean;
  lineCount?: number;
  errorKind?: string;
  elapsedMs?: number;
}

export function sanitizeModelSlug(model: string): string {
  return model.toLowerCase().replace(/[:/]/g, "-");
}

export async function runBench(options: BenchOptions = {}): Promise<BenchResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const demosDir = options.demosDir ?? defaultDemosDir();
  const now = options.now ?? (() => new Date());

  const providersOrError = options.providers
    ? { providers: options.providers }
    : await resolveProvidersFromEnv(options.env ?? process.env, options.fetchImpl);

  if ("errors" in providersOrError) {
    for (const e of providersOrError.errors) stderr.push(e);
    return {
      exitCode: 1,
      stdout: stdout.join("\n"),
      stderr: stderr.join("\n"),
    };
  }

  const providers = providersOrError.providers;
  const executor = options.executor ?? new BenchSandboxExecutor();

  const results = new Map<string, Map<string, CellResult>>();
  for (const p of PROMPTS) results.set(p.slug, new Map());

  await mkdir(demosDir, { recursive: true });

  for (const p of PROMPTS) {
    for (const entry of providers) {
      const cell = await benchOne(p, entry, executor, demosDir);
      results.get(p.slug)?.set(entry.modelSlug, cell);
      const label = `${p.slug}/${entry.modelSlug}`;
      if (cell.ok) {
        const secs = formatElapsedSeconds(cell.elapsedMs ?? 0);
        stdout.push(
          `${label}: ok · ${cell.lineCount} line${cell.lineCount === 1 ? "" : "s"} · ${secs}s`,
        );
      } else {
        stdout.push(`${label}: failed · ${cell.errorKind}`);
      }
    }
  }

  await writeManifest(demosDir);
  await writeResultsMarkdown(demosDir, providers, results, now());

  return {
    exitCode: 0,
    stdout: stdout.join("\n"),
    stderr: stderr.join("\n"),
  };
}

async function benchOne(
  prompt: PromptSpec,
  entry: ProviderEntry,
  executor: Executor,
  demosDir: string,
): Promise<CellResult> {
  let script: string;
  const startedAt = Date.now();
  try {
    script = await entry.provider.generateVoxelScript(prompt.text);
  } catch (e) {
    const kind = e instanceof LLMProviderError ? e.kind : "provider";
    return { ok: false, errorKind: kind, elapsedMs: Date.now() - startedAt };
  }
  const elapsedMs = Date.now() - startedAt;

  const exec = await executor.execute(script);
  if (!exec.ok) {
    return { ok: false, errorKind: exec.error.kind, elapsedMs };
  }

  const dir = join(demosDir, prompt.slug);
  await mkdir(dir, { recursive: true });
  const contents = script.endsWith("\n") ? script : `${script}\n`;
  await writeFile(join(dir, `${entry.modelSlug}.js`), contents);
  const lineCount = script.trimEnd().split("\n").length;
  return { ok: true, lineCount, elapsedMs };
}

function formatElapsedSeconds(ms: number): string {
  return Math.max(0, Math.round(ms / 1000)).toString();
}

async function writeManifest(demosDir: string): Promise<void> {
  const prompts: Array<{ slug: string; text: string; models: string[] }> = [];
  for (const p of PROMPTS) {
    const dir = join(demosDir, p.slug);
    let files: string[] = [];
    try {
      files = await readdir(dir);
    } catch {
      files = [];
    }
    const models = files
      .filter((f) => f.endsWith(".js"))
      .map((f) => f.slice(0, -3))
      .sort();
    if (models.length > 0) {
      prompts.push({ slug: p.slug, text: p.text, models });
    }
  }
  const manifest = { version: 1, prompts };
  await writeFile(join(demosDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function writeResultsMarkdown(
  demosDir: string,
  providers: ProviderEntry[],
  results: Map<string, Map<string, CellResult>>,
  now: Date,
): Promise<void> {
  const dateStr = now.toISOString().slice(0, 10);
  const headers = providers.map((p) => p.displayModel);
  const rows: string[] = [];
  rows.push("# Bench Results");
  rows.push("");
  rows.push(`Last run: ${dateStr}`);
  rows.push("");
  rows.push(`| Prompt | ${headers.join(" | ")} |`);
  rows.push(`|---|${headers.map(() => "---").join("|")}|`);
  for (const p of PROMPTS) {
    const cells = providers.map((entry) => {
      const cell = results.get(p.slug)?.get(entry.modelSlug);
      if (!cell) return "—";
      const secs = formatElapsedSeconds(cell.elapsedMs ?? 0);
      if (cell.ok) {
        return `ok · ${cell.lineCount} line${cell.lineCount === 1 ? "" : "s"} · ${secs}s`;
      }
      return `failed · ${cell.errorKind} · ${secs}s`;
    });
    rows.push(`| ${p.text} | ${cells.join(" | ")} |`);
  }
  rows.push("");
  await writeFile(join(demosDir, "results.md"), rows.join("\n"));
}

type ProviderResolution = { providers: ProviderEntry[] } | { errors: string[] };

async function resolveProvidersFromEnv(
  env: Record<string, string | undefined>,
  fetchImpl?: typeof fetch,
): Promise<ProviderResolution> {
  const errors: string[] = [];
  const providers: ProviderEntry[] = [];

  const anthropicKey = env.ANTHROPIC_API_KEY ?? "";
  const anthropicModel = env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  if (!anthropicKey) {
    errors.push("ANTHROPIC_API_KEY is not set — Anthropic provider is not configured.");
  } else {
    providers.push({
      provider: new AnthropicProvider({ apiKey: anthropicKey, model: anthropicModel }),
      displayModel: anthropicModel,
      modelSlug: sanitizeModelSlug(anthropicModel),
    });
  }

  const ollamaUrl = env.OLLAMA_URL ?? "http://localhost:11434";
  const ollamaModel = env.OLLAMA_MODEL ?? "qwen3-coder:30b";
  const ollamaHealthy = await pingOllama(ollamaUrl, fetchImpl);
  if (!ollamaHealthy) {
    errors.push(`Ollama at ${ollamaUrl} is not reachable — Ollama provider is not configured.`);
  } else {
    providers.push({
      provider: new OllamaProvider({ baseUrl: ollamaUrl, model: ollamaModel }),
      displayModel: ollamaModel,
      modelSlug: sanitizeModelSlug(ollamaModel),
    });
  }

  if (errors.length > 0) return { errors };
  return { providers };
}

async function pingOllama(baseUrl: string, fetchImpl?: typeof fetch): Promise<boolean> {
  const impl = fetchImpl ?? globalThis.fetch;
  if (!impl) return false;
  try {
    const url = baseUrl.replace(/\/+$/, "");
    const response = await impl(url);
    return response.status < 500;
  } catch {
    return false;
  }
}

function defaultDemosDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(dirname(here), "demos");
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const result = await runBench();
  if (result.stdout) process.stdout.write(`${result.stdout}\n`);
  if (result.stderr) process.stderr.write(`${result.stderr}\n`);
  process.exit(result.exitCode);
}
