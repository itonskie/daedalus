import manifestJson from "../../demos/manifest.json";

export interface Manifest {
  version: number;
  prompts: readonly ManifestPrompt[];
}

export interface ManifestPrompt {
  slug: string;
  text: string;
  models: readonly string[];
}

export const MANIFEST: Manifest = manifestJson as Manifest;

const rawFiles = import.meta.glob<string>("../../demos/**/*.js", {
  query: "?raw",
  import: "default",
  eager: true,
});

export const CACHED_DEMOS: Record<string, Record<string, string>> = (() => {
  const out: Record<string, Record<string, string>> = {};
  for (const [path, content] of Object.entries(rawFiles)) {
    const match = path.match(/\/demos\/([^/]+)\/([^/]+)\.js$/);
    if (!match) continue;
    const [, promptSlug, modelSlug] = match;
    (out[promptSlug] ??= {})[modelSlug] = content;
  }
  return out;
})();

export const DEFAULT_DEMO = {
  promptSlug: "castle-with-four-towers",
  modelSlug: "claude-sonnet-4-6",
} as const;

export function getCachedScript(promptSlug: string, modelSlug: string): string | null {
  return CACHED_DEMOS[promptSlug]?.[modelSlug] ?? null;
}

export function getPromptText(promptSlug: string): string | null {
  return MANIFEST.prompts.find((p) => p.slug === promptSlug)?.text ?? null;
}
