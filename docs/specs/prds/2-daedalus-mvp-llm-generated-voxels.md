# PRD: Daedalus MVP — LLM-Generated Voxels

**Status:** Draft
**Date:** 2026-07-08
**Brainstorm:** [`docs/brainstorms/daedalus-mvp-llm-generated-voxels-2026-07-08.md`](../../brainstorms/daedalus-mvp-llm-generated-voxels-2026-07-08.md)

## Problem Statement

I want a portfolio artifact for AI/ML roles that demonstrates real understanding of how modern LLMs are actually deployed — specifically the code-execution-tool-use pattern where the model writes a program that calls a domain API, rather than emitting raw data or JSON. The current `daedalus` repo describes a browser-based MagicaVoxel competitor, which is a lot to build and has zero AI content. It doesn't showcase what the portfolio needs to show, and it isn't small enough to ship fast enough to iterate.

## Solution

Reframe daedalus as a browser-based demo of the **code-execution-tool-use pattern**, using voxels as the visual output. A visitor types a prompt in a chat panel; an LLM writes a short JavaScript **generated script** that calls a small **voxel API**; the script runs in a sandboxed Web Worker and renders a 64³ voxel grid via three.js. The demo ships as a `git clone && pnpm dev` static frontend with two live providers (Anthropic BYOK, Ollama local) and a first-run experience backed by six cached demos so it always works out of the box. A static Compare Models view shows Claude vs. Qwen3-Coder side-by-side against cached results — no visitor configuration required. Voxels are the medium; the code-execution pattern is the artifact.

## User Stories

1. As a **portfolio visitor with no setup**, I want the page to load into a working voxel scene, so that I can see what daedalus does without touching settings or installing anything.
2. As a **portfolio visitor**, I want to click through the six canonical prompts as cached demos, so that I can browse the range of what the system produces without spending my own API budget or installing Ollama.
3. As a **portfolio visitor evaluating for a role**, I want a static "Compare Models" view showing Claude and Qwen3-Coder side by side against the same prompt, so that I can see that the author knows how to compare LLM outputs.
4. As a **portfolio visitor in Compare view**, I want the two viewports to share an orbit camera, so that rotating one rotates the other and I'm actually comparing the same angle on both.
5. As a **portfolio visitor**, I want to click "show code" on any generated result, so that I can inspect the generated script the model produced.
6. As a **portfolio visitor with an Anthropic API key**, I want to paste my key into a settings drawer, so that I can try my own prompts live against Claude.
7. As a **portfolio visitor running Ollama locally**, I want to configure a local Ollama URL and model name in a settings drawer, so that I can try my own prompts live against a local open-weight model.
8. As a **portfolio visitor**, I want my Anthropic key and Ollama settings persisted in `localStorage`, so that I don't re-enter them every reload.
9. As a **portfolio visitor**, I want to type an arbitrary prompt in the chat panel, so that I'm not limited to the six canonical examples.
10. As a **portfolio visitor**, I want an obvious control to switch between the currently active live provider (Anthropic vs. Ollama), so that I can try the same prompt against either without hunting through settings.
11. As a **portfolio visitor whose generated script errored**, I want to see a clean, readable error rather than a blank scene, so that I understand the model produced invalid code rather than the app being broken.
12. As a **portfolio visitor**, I want the generated script to run in a sandbox, so that a bad or malicious script from the model can't touch the rest of the page.
13. As a **portfolio visitor**, I want the previously generated result to remain visible while a new one is being generated, so that the viewport doesn't blank out during the LLM round-trip.
14. As a **portfolio visitor**, I want the six canonical prompts one click away in the chat panel, so that I can trigger a live generation of any of them without typing.
15. As a **portfolio visitor**, I want to see the model's output at a resolution that has real structural range (towers, walls, spirals), so that the demo doesn't look like a bumpy cube.
16. As the **maintainer**, I want the LLM provider surface to be a single interface with one method, so that any future provider drops in without touching the rest of the pipeline.
17. As the **maintainer**, I want a `pnpm bench` script that runs the six canonical prompts through both configured providers and writes the results to `demos/`, so that I can refresh the cached set on demand.
18. As the **maintainer**, I want the cached demos checked into the repo as flat files, so that they diff cleanly and reviewers can read the model outputs directly in the PR.
19. As the **maintainer**, I want the voxel API frozen at four primitives + a named palette enum, so that the system prompt stays short, LLMs stay reliable, and the API type surface doesn't sprawl.
20. As the **maintainer**, I want the runtime language inside the sandbox to be plain JavaScript, so that the frontend never has to ship an in-browser transpiler.
21. As the **maintainer**, I want the Compare view to be cached-only, so that a visitor without both an Anthropic key AND local Ollama running can still see the comparison story.
22. As the **maintainer**, I want no backend and no build-time secrets, so that the demo deploys as static assets and there's nothing to run server-side.
23. As the **maintainer**, I want the visual identity to follow `DESIGN.md` (dark, quiet, dense, indigo accent, IBM Plex, grayscale chrome), so that the demo doesn't read as templated Tailwind defaults.
24. As the **maintainer**, I want the "code-execution pattern" framing to lead the README and the app copy, so that visitors and recruiters land on the right story instead of the model-comparison side story.
25. As the **maintainer**, I want the old v1 spec (issue #1) closed with a link to this PRD, so that the repo has one canonical direction of work.
26. As the **maintainer running `pnpm bench` from CI or a laptop**, I want the bench script to fail loud when a provider isn't configured, so that stale cached demos are never silently regenerated from the wrong source.

## Implementation Decisions

### Modules

Four deep modules and a set of thin glue components. Deep modules encapsulate a lot of behavior behind a small, stable interface and are testable in isolation.

**Deep module — Voxel API + Grid.** Owns the 64³ voxel grid and the four primitives the LLM is allowed to call. Coordinate system: center at (32, 32, 32), ground at y=0. The named palette is a fixed enum of ~16 colors (e.g. `"red"`, `"stone"`, `"grass"`, `"gold"` — final list locked in the engineering spec). Interface:

- `place(x, y, z, color)` — writes a single voxel; out-of-bounds is a silent no-op.
- `box(x, y, z, w, h, d, color)` — fills an axis-aligned box; clips at grid bounds.
- `sphere(cx, cy, cz, r, color)` — fills a sphere; clips at grid bounds.
- `line(x1, y1, z1, x2, y2, z2, color)` — 3D Bresenham; clips at grid bounds.
- Grid readback returns a compact structure the renderer can iterate (occupied cells + palette index).
- Unknown color name throws — deliberate, so the sandbox can surface it as a script error.
- No `fill` / flood-fill primitive. LLMs misuse it and the four primitives cover interesting output.

**Deep module — Sandbox Executor.** Wraps a Web Worker. Interface: `execute(scriptString) -> Promise<{ grid, error?, durationMs }>`. Injects the voxel API as globals into the worker's scope, evaluates the script, imposes a timeout (target: a few seconds — engineering spec locks the number), catches thrown errors and maps them to a readable shape, and posts the resulting grid back to the main thread. The worker is single-use per generation to avoid state leaking between runs. Failure modes surfaced: syntax error, runtime throw, timeout, unknown palette color.

**Deep module — LLMProvider.** Interface: `generateVoxelScript(prompt: string) -> Promise<string>`. Two implementations:

- `AnthropicProvider` — plain `fetch` against the Anthropic Messages API using the visitor's BYOK key from `localStorage`. No `@anthropic-ai/sdk` dependency. Fixed system prompt describing the voxel API, coordinate system, palette, and encouraging compact code.
- `OllamaProvider` — plain `fetch` against a configurable local Ollama URL (default `http://localhost:11434`) and model (default `qwen3-coder:30b`; `qwen2.5-coder:14b` documented as a lower-hardware fallback). Same system prompt.

Provider selection lives in Zustand + `localStorage`. Cached demos are **not** a provider — they are the default state the store initializes into.

**Deep module — Voxel Renderer.** Takes a grid and produces the three.js scene. Uses a single `InstancedMesh` sized to the total occupied cell count. Owns the palette-to-Three-color mapping. Renders under a shared orbit camera in the main viewport, and — in the Compare view — under a shared orbit camera driving two `InstancedMesh` instances so both scenes rotate together.

### Thin glue

- **Zustand store** — active provider, provider settings, current generated script, last-good grid, chat history, cached-demo index. Initializes to a cached demo on first load.
- **React components** — chat panel, viewport, settings drawer, code panel, Compare Models view. Follow `DESIGN.md` (dark viewport, `surface` panels, indigo accent for active tool / primary action, IBM Plex, grayscale chrome). No new visual language.
- **Cached-demo loader** — imports the string contents of `demos/<prompt-slug>/<model-slug>.js` at build time via Vite's raw-string import. No runtime fetch.
- **`pnpm bench`** — Node/tsx script, not shipped in the frontend bundle. Runs the six canonical prompts through both configured providers, writes files to `demos/<prompt-slug>/<model-slug>.js`, and updates a markdown results file. Fails loud when a provider isn't configured.

### Canonical prompts (frozen)

1. `a red sphere`
2. `a green tree`
3. `a small castle with four towers`
4. `a spiral staircase`
5. `a small robot`
6. `a mushroom`

Chosen for complexity spread and Compare-view drama (some easy wins for both models; some where Claude visibly outperforms).

### Terminology (frozen)

- **voxel API** — not "voxel primitive API", not "voxel scripting API"
- **generated script** — not "voxel script", "LLM script", "output code"

### Architectural decisions

- **No backend.** Static frontend + direct `fetch` to Anthropic or the visitor's local Ollama. Kills the Go backend, greedy meshing, single-binary distribution from the original v1 spec.
- **JavaScript in the sandbox.** TypeScript is the frontend language; the string the LLM produces and the worker executes is JS. Avoids an in-browser transpiler.
- **Grid 64³.** Enough headroom for towers, walls, spirals. `InstancedMesh` handles 262,144 possible cells trivially. 128³ is future scope.
- **BYOK in the browser.** Anthropic key in `localStorage`, local-only demo. If the demo is ever hosted publicly, the sandbox + key story needs another look — flagged in Open Questions.
- **Cached artifact layout.** `demos/<prompt-slug>/<model-slug>.js`, flat directory, checked into the repo.

### Repo state

- Rewrite the README to lead with the code-execution pattern framing.
- Close issue #1 with a comment linking to this PRD.
- Open a fresh MVP tracking issue (this PRD).

## Testing Decisions

All four deep modules get tests. Tests verify behavior through public interfaces — a good test survives an internal refactor without breaking. Vitest is the runner (already in the stack).

- **Voxel API + Grid** — pure-function tests. For each primitive: hits the cell you expect, clips at bounds without throwing, respects the named palette (unknown color throws), no state leak between runs. Highest leverage because the LLM's system prompt is written against this contract.
- **Sandbox Executor** — fixture-driven. A valid script fills the grid you expect. A syntax-error script returns a `{ error }` shape, not a rejection. A runtime-throw script returns a `{ error }` shape. A too-slow script times out cleanly. The API surface visible to the script exactly matches what the system prompt promises (regression guard).
- **LLMProvider** — mocked `fetch`. `AnthropicProvider` sends the expected request shape (endpoint, headers, body) for a given prompt and parses a canned response into a script string. Same for `OllamaProvider`. No real HTTP, no keys required in CI.
- **Voxel Renderer** — smoke test only. Feed a grid, assert an `InstancedMesh` with the expected instance count is produced and palette indices map to the expected colors. No visual snapshotting.

No prior art in the repo yet — this is the first test suite. Follow Vitest conventions (`*.test.ts` colocated with source).

## Out of Scope

Everything from the original v1 spec that isn't the AI generation loop is deferred, plus a few things surfaced during grilling:

- Go backend and greedy meshing algorithm
- STL export, GLTF/GLB export
- MagicaVoxel `.vox` import
- Manual editing toolbar (place / erase / paint / eyedropper as human tools)
- Custom color palette save/load
- Mirror modes (X / Y / Z)
- Orthographic camera toggle (basic orbit only)
- Undo/redo history
- Project save/load as JSON files
- Single static binary via Go `embed`; GoReleaser cross-platform releases
- 128³ grid (MVP is 64³)
- Live benchmark UI (metadata capture, prompt playground, arbitrary-provider side-by-side runs). Replaced by the static Compare view + `pnpm bench` script.
- Live regeneration inside the Compare view (would require both an Anthropic key AND local Ollama on the visitor's machine before any comparison renders — kills the zero-friction story).
- Public hosting of the demo. MVP is `pnpm dev` local. Public hosting requires revisiting the BYOK-in-browser posture.
- Streaming responses from either provider.
- Anthropic tool-use / MCP inside the browser client (the code-execution pattern is *demonstrated* here, not *reimplemented* against MCP).

These aren't wrong ideas — they're future scope that only makes sense once the AI generation loop lands.

## Further Notes

**Portfolio framing.** The lead story is: *a working demo of the code-execution-tool-use pattern, using voxels as visual output.* The provider-abstraction / model-comparison angle is supporting, not the lead. README, in-app copy, and portfolio card text should all lead with the pattern.

**Design.** `DESIGN.md` (dark viewport, `surface` panels, indigo accent, IBM Plex, grayscale chrome, no gradients, no emoji) already covers the MVP surface — chat panel, viewport, settings drawer, code panel, Compare view all inherit from the same visual system. The "voxels supply all the color; interface supplies structure" principle carries forward directly.

**Iteration posture.** No upfront de-risking spike with pass criteria. Build the thing end-to-end, find real problems as they surface, file issues, replicate, iterate visibly. Portfolio work benefits more from *shown* iteration than from exhaustive up-front hardening.

**Open questions carried forward from the brainstorm.**

- **Local model quality on the voxel API.** `qwen3-coder:30b` producing coherent generated scripts against a novel API at 64³ is not guaranteed. Mitigation: cached demos are the always-working first-run experience, so the demo never *feels* broken while the live path is being tuned. Prompt engineering will need iteration.
- **Prompt design.** The system prompt teaches the model the voxel API, the grid dimensions, the coordinate system, and encourages compact code. Non-trivial — probably where most of the portfolio-craft goes. Belongs in the engineering spec.
- **Sandbox scope.** Web Worker + scoped API is enough for a local-only `pnpm dev` demo. If hosted publicly, revisit both sandboxing and the BYOK-in-browser posture.
