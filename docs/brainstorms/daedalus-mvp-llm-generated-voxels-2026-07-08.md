# Daedalus MVP: LLM-Generated Voxels

**Date:** 2026-07-08
**Grilled:** 2026-07-08
**Status:** PRD Created
**PRD:** https://github.com/itonskie/daedalus/issues/2

## Summary

Reframe daedalus from a MagicaVoxel-style manual voxel editor to a browser-based demo of the **code-execution-tool-use pattern** — using voxels as the visual output. User types a prompt; an LLM writes a JavaScript generated script that calls a small voxel API; the script runs in a sandboxed Web Worker and renders a 64³ voxel grid in three.js. The MVP ships as a `git clone && pnpm dev` demo with two live providers (Anthropic BYOK, Ollama local) and a first-run experience backed by cached demos so it's never broken out of the box. A static "Compare Models" view lets recruiters see side-by-side output from Claude vs. a state-of-the-art open-weight coding model without any configuration.

## Problem / Motivation

The original v1 spec (README + issue #1) describes a browser-based MagicaVoxel competitor: hand-rolled greedy meshing in Go, STL/GLTF export, `.vox` import, single static binary via GoReleaser, and a full manual editing toolset. Ambitious, but two things don't fit:

1. **The point of the project is AI/ML portfolio work**, not shipping a MagicaVoxel competitor. The v1 spec has zero AI in it. The greedy-meshing-Go-backend "showpiece" doesn't showcase what the portfolio actually needs to show.
2. **v1 is a lot to build** before proving anything works or lands with anyone.

The MVP should collapse the concept to its smallest interesting form — one that is genuinely useful as a portfolio artifact for AI/ML roles, and can ship fast enough to iterate.

## Proposed Approach

Core loop:

1. User types a prompt in a chat interface.
2. Prompt is sent to an LLM with a system prompt describing the voxel API.
3. LLM returns a short JavaScript generated script that calls the voxel API.
4. Script executes in a sandboxed Web Worker with the voxel API injected.
5. Resulting 64³ voxel grid renders in three.js via InstancedMesh.
6. UI has a "show code" toggle so users can inspect (and eventually edit) the generated script.

**Why LLM-writes-code rather than LLM-emits-voxel-data.** Following Anthropic's "code execution with MCP" pattern, letting the model write a program that calls a small API is dramatically more token-efficient than emitting thousands of raw coordinates. It also produces a showable, editable, portfolio-friendly artifact — "look, the AI wrote this, here's the code." **This pattern is the story of the project** — voxels are just the visual medium that makes the pattern legible.

**Voxel API (four primitives, named palette).**

- `place(x, y, z, color)` — single voxel
- `box(x, y, z, w, h, d, color)` — filled axis-aligned box
- `sphere(cx, cy, cz, r, color)` — filled sphere
- `line(x1, y1, z1, x2, y2, z2, color)` — 3D line (Bresenham)

Colors are drawn from a fixed named palette (~16 colors: `"red"`, `"stone"`, `"grass"`, `"gold"`, etc.). LLMs are far more reliable at picking from a labeled enum than at inventing hex codes, and the constrained palette gives the demo a coherent visual identity. `fill` (flood-fill) is deliberately excluded — LLMs frequently misuse it, and the three shape primitives + `place` cover essentially all interesting output.

**Two live providers + cached first-run state.**

1. **Cached demos (first-run state, not a provider)** — Repo ships with pre-generated scripts for six canonical prompts. First-run experience is "load demo → see castle." Always works, no setup, no keys required.
2. **Anthropic (BYOK)** — Settings drawer accepts an Anthropic API key (stored in `localStorage`). Called via plain `fetch` (no SDK dependency). Best quality output.
3. **Ollama (local)** — Settings drawer accepts a local Ollama URL (default `http://localhost:11434`) and model name (default `qwen3-coder:30b`, with `qwen2.5-coder:14b` documented as a lower-hardware fallback for machines that can't fit the 30B). Offline, no-cost, and grounds the "SOTA open-weight coding model" side of the compare story.

Both live providers route through a single `LLMProvider` interface with one method — `generateVoxelScript(prompt: string): Promise<string>`. The rest of the pipeline is provider-agnostic.

**Six canonical prompts.**

The compare view and cached-demo set are built around six prompts chosen for complexity spread and visual variety:

1. "a red sphere" — smoke test
2. "a green tree" — organic, easy win
3. "a small castle with four towers" — structural, hero image for README/OG
4. "a spiral staircase" — geometric reasoning
5. "a small robot" — multi-part composition
6. "a mushroom" — organic, easy win

Prompts 1, 2, 6 are the "both models should nail this" set. Prompts 3, 4, 5 are where Claude will visibly outperform the local model — good compare-view drama.

**Compare Models view (static, cached-only).**

Two side-by-side viewports — Claude vs. Qwen3-Coder — with a shared orbit camera (rotating one rotates the other). A prompt dropdown at the top selects one of the six canonical prompts. Below each viewport: model name, "view code" button, script length in bytes. No live regeneration here — the Compare view is cached-only. Live generation happens in the main chat panel. This buys the "I know how to compare LLMs" story with zero visitor friction (no key, no Ollama install required).

**Maintainer benchmark script (`pnpm bench`).**

Node/tsx script that runs the six canonical prompts through both configured providers, saves the resulting scripts to `demos/<prompt-slug>/<model-slug>.js` (checked into the repo), and updates a markdown results file. Run when the maintainer wants to refresh the cached set — not part of the visitor experience.

## Structure & Architecture

**Frontend (all of it, for MVP):**

- **TypeScript + React** with Vite
- **React Three Fiber + drei** — orbit controls, lighting, scene setup
- **Three.js InstancedMesh** — voxel rendering (trivial at 64³ = 262,144 possible cells)
- **Zustand** — voxel grid state, LLM settings, current/last generated script
- **Tailwind CSS** — chat panel, viewport, settings drawer, code panel, compare view
- **Web Worker sandbox** — receives JS string + voxel API definition, executes, posts back voxel grid data
- **Voxel API** — TypeScript-typed for editor / autocomplete. Four primitives + named palette (as above).

**Provider layer:**

- `interface LLMProvider { generateVoxelScript(prompt: string): Promise<string> }`
- Two live implementations: `AnthropicProvider`, `OllamaProvider`
- Cached demos are static assets imported at build time — not a provider, just the default state Zustand initializes into
- Provider settings live in Zustand + `localStorage`

**Cached demos artifact:**

- Stored at `demos/<prompt-slug>/<model-slug>.js` — flat, checked into the repo
- Frontend imports them at build time as strings (no runtime fetch)
- `pnpm bench` regenerates them from the six canonical prompts

**No backend for the MVP.** Everything is static frontend + direct calls to the Anthropic API or a local Ollama URL. This kills the Go backend, greedy meshing, and single-binary distribution story from the original v1 spec — but they were built for export (STL/GLTF), which the MVP doesn't do.

**Runtime language for the sandbox is plain JavaScript.** TypeScript is the language of the frontend and the API type definitions, but the string the LLM produces and the Web Worker executes is JS. Avoids shipping an in-browser transpiler.

## Dependencies

- **Plain `fetch`** — for both `AnthropicProvider` and `OllamaProvider`. No `@anthropic-ai/sdk` — BYOK in-browser is ~15 lines of `fetch` with the right headers, and the SDK adds ~100kb to the bundle for a single endpoint. Revisit if we add streaming or tool use.
- **React Three Fiber + drei + three** — 3D rendering
- **Zustand** — state
- **Tailwind + Vite** — as in original stack
- **Vitest + Biome** — as in original stack
- **Ollama itself** (external, user installs) with **`qwen3-coder:30b`** pulled as the recommended default. `qwen2.5-coder:14b` documented as a fallback for 16GB machines where the 30B is too tight.

## Open Questions & Risks

- **Local model quality on the voxel API.** `qwen3-coder:30b` producing coherent generated scripts against a novel API at 64³ is not guaranteed. Mitigation: cached demos are always the first-run experience, so the demo never feels broken even if live gen wobbles. Prompt engineering will need iteration — we build, ship, file issues on what breaks, iterate visibly.
- **Prompt design.** The system prompt has to teach the model the voxel API, the grid dimensions, the coordinate system (center at (32,32,32), ground at y=0), and encourage compact code. Non-trivial — likely where most of the portfolio-craft goes.
- **Sandbox scope.** Web Worker + scoped-API is enough for a local-only `pnpm dev` demo. Anthropic key in `localStorage` is fine for local-only use — if the project is ever hosted publicly, the sandbox + key story needs another look.

## Out of Scope

Everything from the original v1 spec that isn't the AI generation loop is deferred:

- Go backend
- Greedy meshing algorithm
- STL export
- GLTF/GLB export
- MagicaVoxel `.vox` import
- Manual editing tools as human-clickable toolbar (place / erase / paint / eyedropper)
- Custom color palette save/load
- Mirror modes (X / Y / Z)
- Orthographic camera toggle (basic orbit only for MVP)
- Undo/redo history
- Project save/load as JSON files
- Single static binary via Go `embed`
- Cross-platform releases via GoReleaser
- 128³ grid (MVP is 64³)
- Live benchmark UI with metadata capture, prompt playground, and side-by-side runs against arbitrary providers (the maintainer's `pnpm bench` script + a static Compare Models view cover the eval-harness story without the UI cost)

These aren't wrong ideas — they're future scope that only makes sense to build once the AI generation loop lands.

## Next Steps

1. Run `/design-brainstorm` to establish a design system (`DESIGN.md`) before the PRD — the MVP has real UI surface (chat panel, viewport, settings drawer, code panel, Compare view) and a portfolio piece needs visual polish, not Tailwind-vanilla defaults.
2. Convert this brainstorm to a PRD via `/idea-to-prd`.
3. Write an engineering spec that nails down the voxel API type definitions, the Web Worker sandbox implementation, the provider `fetch` shapes, and the system-prompt draft.
4. Rewrite the README to match the new framing (code-execution pattern, browser-only, `pnpm dev` demo, two live providers + cached first-run).
5. Close issue #1 with a comment linking to the new PRD; open a fresh MVP tracking issue.
6. Build. When things break, file issues, replicate, work on it, show progress.

## Grill Resolutions

Session: 2026-07-08. Key decisions and changes vs. the original brainstorm.

**Portfolio story locked as the code-execution pattern.** The pitch is: "a working demo of the code-execution-tool-use pattern, using voxels as a visual output." Voxels are the medium; the pattern is the artifact. This should lead the README and any portfolio card copy. The provider-abstraction / model-comparison angle is a *supporting* story, not the lead.

**Benchmark mode split into two things.** The live benchmark UI (with metadata capture, prompt playground, side-by-side runs) is cut from MVP. Replaced with:
- A static **Compare Models view** in the browser — two viewports, cached-only, shared orbit camera, no visitor configuration required. This is the recruiter-facing artifact.
- A **`pnpm bench`** maintainer script — Node/tsx, runs the canonical prompts through both providers, writes cached scripts to `demos/`, updates a markdown results file. Not part of the visitor experience.

This preserves the eval-harness story with an order-of-magnitude less UI cost.

**Grid bumped from 32³ to 64³.** At 32³ a "castle" is a bumpy cube — output ceiling too low for a portfolio demo. 64³ has real headroom for towers, walls, and structure while staying trivial for InstancedMesh. The API surface is identical; the LLM just uses larger coordinates. 128³ stays out of scope as future upgrade room.

**Provider count reduced from three to two live + a cached first-run state.** Cached demos are a startup *state* the app initializes into, not a `CachedProvider`. Live providers are `AnthropicProvider` and `OllamaProvider`. Both go through the same `LLMProvider` interface. Compare view is Claude vs. Qwen3-Coder — two panels, not three (showing two Qwen variants side by side was redundant framing).

**Default local model changed from `qwen2.5-coder:7b` to `qwen3-coder:30b`.** Rationale from the mid-2026 landscape: `qwen3-coder:30b` (MoE, 3.3B active) is the current SOTA open-weight code-tuned model that runs on a local machine — 19GB on disk at Q4_K_M, fast inference on Apple Silicon unified memory, benchmarks with the top tier (GLM-4.7, DeepSeek-V3.2). No 7B/14B Qwen3-Coder variant exists. `qwen2.5-coder:14b` (~8-9GB Q4) is documented as a fallback for 16GB machines where the 30B is too tight. Story reads better: "Claude vs. SOTA open model" not "Claude vs. a 2024 7B."

**Voxel API frozen at four primitives + named palette.**
- Primitives: `place`, `box`, `sphere`, `line`. `fill` dropped — LLMs misuse flood-fill; the three shape primitives + `place` cover interesting output.
- Colors: fixed named palette (~16 colors — `"red"`, `"stone"`, `"grass"`, `"gold"`, etc.). LLMs are more reliable with a labeled enum than arbitrary hex/RGB, and the constraint gives the demo a coherent visual identity.

**Six canonical prompts locked.** `a red sphere`, `a green tree`, `a small castle with four towers`, `a spiral staircase`, `a small robot`, `a mushroom`. Chosen for complexity spread and to give the Compare view drama (some easy wins for both models, some where Claude visibly outperforms).

**Compare view is cached-only.** Live regeneration in the Compare view was rejected — it would require visitors to have both an Anthropic key AND local Ollama running before seeing any comparison. Cached-only means zero visitor friction. Live gen still exists in the main chat panel.

**Cached artifact layout.** `demos/<prompt-slug>/<model-slug>.js`, flat directory, checked into the repo. Frontend imports at build time as strings.

**`@anthropic-ai/sdk` dropped.** BYOK in-browser is ~15 lines of `fetch` with the right headers. SDK adds ~100kb bundle for one endpoint. Revisit if streaming or tool use enters scope.

**Terminology canonicalized.** Two terms locked to avoid drift as this becomes a PRD + tickets:
- **"voxel API"** (not "voxel primitive API", "voxel scripting API")
- **"generated script"** (not "voxel script", "LLM script", "output code")

**Spike / de-risking framing corrected.** The original brainstorm's step 6 called for a de-risking spike. The grill briefly proposed a formal go/no-go with scored pass criteria — user rejected that framing hard. Correct approach for this MVP: build the thing end-to-end, find real problems as they surface, file issues, replicate, iterate visibly. Portfolio work benefits from *shown* iteration more than exhaustive upfront de-risking.

**Old v1 spec disposition.** README will be rewritten entirely to match the new framing. Issue #1 (v1 MagicaVoxel-competitor scope) will be closed with a comment linking to the new PRD; a fresh MVP tracking issue will be opened.

**Design detection.** MVP has real UI surface (chat panel, viewport, settings drawer, code panel, Compare view). No `DESIGN.md` exists. `/design-brainstorm` is the recommended next step before `/idea-to-prd` — a portfolio piece needs visual polish, and default Tailwind reads as templated.

