# Engineering Spec

Architecture, module contracts, data flow, and testing strategy for the daedalus MVP. This spec locks the implementation choices flagged in the PRD ("locked in the engineering spec") and closes ambiguity that would otherwise leak into ticket scope.

Related documents:
- Product intent: [`docs/specs/prds/2-daedalus-mvp-llm-generated-voxels.md`](prds/2-daedalus-mvp-llm-generated-voxels.md)
- UI behavior: [`docs/specs/design-spec.md`](design-spec.md)
- Contract surface: [`docs/specs/api-contracts.md`](api-contracts.md)
- Architectural decisions: [`docs/adrs/`](../adrs/)

---

## 1. Architecture overview

Static frontend. Four deep modules behind small, stable interfaces. Thin React glue on top.

```
                 +---------------------+
                 |    React UI         |
                 |  (chat, viewport,   |
                 |   settings, code,   |
                 |   compare)          |
                 +----------+----------+
                            |
                    Zustand store
                            |
      +---------------------+---------------------+
      |                     |                     |
      v                     v                     v
+-----------+       +---------------+     +--------------+
| LLM       |       | Sandbox       |     | Voxel        |
| Provider  |       | Executor      |     | Renderer     |
| (deep)    |       | (deep)        |     | (deep)       |
+-----+-----+       +-------+-------+     +------+-------+
      |                     |                    |
  fetch to               Web Worker           three.js
  Anthropic /            (isolated)           InstancedMesh
  Ollama                     |
                             v
                     +---------------+
                     | Voxel API     |
                     | + Grid        |
                     | (deep)        |
                     +---------------+
```

**Deep** in the John Ousterhout sense: a lot of behavior behind a small interface, testable in isolation, replaceable without touching callers.

**Data flow (happy path):**
1. Visitor submits a prompt in the chat panel.
2. Zustand action calls `LLMProvider.generateVoxelScript(prompt)` on the active provider.
3. Provider returns a JS string.
4. Zustand action calls `SandboxExecutor.execute(scriptString)`.
5. Executor spawns a Web Worker, injects the voxel API, runs the script, returns `{ grid, error?, durationMs }`.
6. On success, Zustand updates `lastGoodGrid` and `currentScript`.
7. Renderer subscribes to `lastGoodGrid` and rebuilds the `InstancedMesh`.

**Data flow (cached demo):**
1. On first load, Zustand initializes with the default cached demo already in `lastGoodGrid`.
2. Chat chips can trigger a cached demo directly (Zustand action swaps `lastGoodGrid` from the imported file — no LLM call, no sandbox).

---

## 2. Module: Voxel API + Grid

The core contract of the project. This is the "API" the LLM writes code against, and the highest-leverage module to get right.

### Grid geometry

- **Dimensions:** 64 × 64 × 64. Fixed. Total possible cells: 262,144.
- **Coordinate system:** integer coordinates. Origin at `(0, 0, 0)`. Center at `(32, 32, 32)`. Ground plane at `y = 0`. `y` is up.
- **Cell storage:** `Uint8Array` of length 262,144. Index formula: `x + y*64 + z*64*64`.
  - `0` = empty.
  - `1..N` = palette index + 1 (offset so 0 stays "empty").
- **Bounds:** any primitive operation is clipped to `0 ≤ x,y,z < 64`. Silent no-op for `place`; clipping (not throw) for `box`/`sphere`/`line`.

### Palette

Fixed enum of exactly 16 named colors. Names locked here so the system prompt is stable and cached demos never break.

| index | name | hex |
|---|---|---|
| 0 | `white` | `#F4F4F5` |
| 1 | `black` | `#0A0A0B` |
| 2 | `red` | `#EF4444` |
| 3 | `orange` | `#F59E0B` |
| 4 | `yellow` | `#FBBF24` |
| 5 | `green` | `#10B981` |
| 6 | `blue` | `#3B82F6` |
| 7 | `indigo` | `#5E6AD2` |
| 8 | `purple` | `#A855F7` |
| 9 | `pink` | `#EC4899` |
| 10 | `brown` | `#8B4513` |
| 11 | `stone` | `#78716C` |
| 12 | `wood` | `#B08050` |
| 13 | `grass` | `#65A30D` |
| 14 | `water` | `#0EA5E9` |
| 15 | `gold` | `#D4AF37` |

- Unknown color name → `throw new Error("Unknown color: <name>")`. Surfaced to visitor via the [error taxonomy](design-spec.md#error-taxonomy).
- Colors chosen for coverage across the six canonical prompts. Reviewable, but no additions without also refreshing all cached demos.

### Primitives

Four primitives. No `fill`, no flood, no clear (the grid starts empty every run).

```ts
place(x: number, y: number, z: number, color: string): void
box(x: number, y: number, z: number, w: number, h: number, d: number, color: string): void
sphere(cx: number, cy: number, cz: number, r: number, color: string): void
line(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, color: string): void
```

**Semantics:**
- `place` — writes one cell. Out-of-bounds is silent no-op.
- `box` — fills an axis-aligned rectangular region starting at `(x,y,z)` with size `(w,h,d)`. Clips at grid bounds. Zero or negative size is silent no-op.
- `sphere` — fills every cell whose centroid is within `r` of `(cx, cy, cz)` (Euclidean). Clips. Radius < 1 fills only the center cell if in bounds.
- `line` — 3D Bresenham from `(x1,y1,z1)` to `(x2,y2,z2)` inclusive. Clips.
- All primitives coerce numeric args via `Math.floor` before use. Non-numeric args throw.

### Public interface (module boundary)

```ts
export function createGrid(): Grid;

export interface Grid {
  place(...): void;
  box(...): void;
  sphere(...): void;
  line(...): void;
  readback(): GridReadback;
}

export interface GridReadback {
  size: 64;
  cells: Uint8Array;        // 262,144 length, palette-index+1 (0 = empty)
  palette: readonly PaletteColor[];  // stable, indexed
}

export interface PaletteColor {
  name: string;
  hex: string;
}
```

### File layout

```
src/voxel/
  grid.ts          # createGrid, Grid, GridReadback
  palette.ts       # PALETTE constant, name → index lookup
  primitives.ts    # place, box, sphere, line (pure fns, take grid + args)
  index.ts         # public exports
  grid.test.ts
  primitives.test.ts
```

---

## 3. Module: Sandbox Executor

Runs an untrusted JS string in a Web Worker with only the voxel API in scope.

### Public interface

```ts
export interface Executor {
  execute(scriptString: string): Promise<ExecuteResult>;
}

export type ExecuteResult =
  | { ok: true; grid: GridReadback; durationMs: number }
  | { ok: false; error: ExecuteError; durationMs: number };

export type ExecuteError =
  | { kind: "syntax"; message: string; line?: number }
  | { kind: "runtime"; message: string; line?: number; errorType: string }
  | { kind: "timeout"; message: string }
  | { kind: "unknown-color"; message: string; colorName: string };
```

### Behavior

1. Spawn a fresh Web Worker per `execute` call. Single-use — terminate after result. No state leak between runs.
2. Worker bundle contains:
   - The voxel API module (grid + primitives).
   - A bootstrap that receives `{ script }` via `postMessage`.
3. Bootstrap:
   - Creates a grid instance.
   - Wraps `grid.place/box/sphere/line` as globals in the worker scope (via `self.place = grid.place.bind(grid)` etc.).
   - Calls `new Function(script)()` inside a try/catch and a `Promise.race` against a timeout.
   - On success, calls `grid.readback()` and posts back `{ ok: true, cells, palette, durationMs }`.
   - On throw, posts back `{ ok: false, error }` with the error mapped to one of the four `ExecuteError` shapes.
4. Timeout: **3000ms** wall-clock from `postMessage` sent to result received. If exceeded, the main thread calls `worker.terminate()` and returns `{ ok: false, error: { kind: "timeout" } }`.
5. `Uint8Array` is `Transferable` — pass ownership on `postMessage` to avoid copy overhead.

### Failure mapping

| Thrown inside worker | `ExecuteError.kind` |
|---|---|
| `SyntaxError` from `new Function(script)` | `syntax` |
| `Error` matching `/Unknown color: (\w+)/` | `unknown-color` |
| Any other thrown value | `runtime` |
| Worker did not respond within 3000ms | `timeout` |

### File layout

```
src/sandbox/
  executor.ts       # Executor class, spawn/postMessage/timeout logic
  worker.ts         # Bootstrap that runs inside the Worker
  errors.ts         # ExecuteError types + mapper
  executor.test.ts
```

`worker.ts` is bundled by Vite as a Web Worker via the `?worker` import suffix.

---

## 4. Module: LLMProvider

Abstracts the LLM behind one method so any future provider drops in without touching downstream code.

### Public interface

```ts
export interface LLMProvider {
  readonly id: "anthropic" | "ollama";
  generateVoxelScript(prompt: string): Promise<string>;
}
```

- Returns the raw JS string, **already stripped of markdown code fences** (see [Post-processing](#post-processing)).
- Throws `LLMProviderError` on HTTP / network failure. The store maps errors to the [error taxonomy](design-spec.md#error-taxonomy).

```ts
export class LLMProviderError extends Error {
  constructor(
    public providerId: string,
    public kind: "http" | "network" | "shape",
    public status?: number,
    message?: string,
  ) { super(message); }
}
```

### System prompt

Single shared string, in `src/llm/system-prompt.ts`. Same prompt for both providers so comparison is fair.

**Contents:**
1. Role framing: `You are writing JavaScript for a voxel grid.`
2. Grid geometry: `64x64x64 grid. Origin at (0,0,0). Center at (32,32,32). Ground at y=0. y is up.`
3. API: exact signatures of `place`, `box`, `sphere`, `line`.
4. Palette: comma-separated list of the 16 names.
5. Constraints: `Return only executable JavaScript. No markdown. No explanations. No import statements. No function definitions unless you call them.`
6. Style hint: `Prefer compact code. Use box/sphere/line for volumes; use place for details.`
7. One worked example (a red sphere: `sphere(32, 20, 32, 8, "red")`).

Prompt lives in one file so tuning is a diff, not a hunt. Both providers `import` it.

### Anthropic implementation

- Endpoint: `POST https://api.anthropic.com/v1/messages`.
- Auth: `x-api-key: <key from store>` + `anthropic-version: 2023-06-01`.
- Model: from the settings drawer. Default: `claude-sonnet-4-6`. Options in the dropdown are locked to the currently-recommended list (see api-contracts).
- **`anthropic-dangerous-direct-browser-access: true`** header — required for browser use of the Anthropic API.
- Body:
  ```json
  {
    "model": "<model-slug>",
    "max_tokens": 2048,
    "system": "<system prompt>",
    "messages": [{ "role": "user", "content": "<visitor prompt>" }]
  }
  ```
- Parse: `response.content[0].text`, run through post-processing.
- No streaming (out of scope per PRD).
- No `@anthropic-ai/sdk` dependency — plain `fetch`.

### Ollama implementation

- Endpoint: `POST <configured-url>/api/chat`.
- No auth.
- Model: from settings. Default: `qwen3-coder:30b`.
- Body:
  ```json
  {
    "model": "<model-slug>",
    "stream": false,
    "messages": [
      { "role": "system", "content": "<system prompt>" },
      { "role": "user", "content": "<visitor prompt>" }
    ]
  }
  ```
- Parse: `response.message.content`, run through post-processing.

### Post-processing

Both providers pipe the raw text through one function `stripToScript(raw: string): string`:

1. If the response contains one or more ` ```javascript ` / ` ```js ` / ` ``` ` fenced blocks, extract the first block's contents.
2. Trim leading/trailing whitespace.
3. If the result is empty after stripping, throw `LLMProviderError(kind: "shape")`.

Returning JS as the string the sandbox will execute — no wrapping, no `eval`-of-a-`function-body` gymnastics.

### File layout

```
src/llm/
  index.ts               # LLMProvider, LLMProviderError, factory
  system-prompt.ts       # THE_SYSTEM_PROMPT
  anthropic-provider.ts
  ollama-provider.ts
  strip-to-script.ts
  anthropic-provider.test.ts
  ollama-provider.test.ts
  strip-to-script.test.ts
```

---

## 5. Module: Voxel Renderer

Turns a `GridReadback` into a three.js scene node. React-agnostic — a plain class with an imperative interface, wrapped by a thin React component.

### Public interface

```ts
export class VoxelRenderer {
  constructor(container: HTMLElement, options?: RendererOptions);
  setGrid(grid: GridReadback): void;
  setCamera(state: CameraState): void;
  getCameraState(): CameraState;
  onCameraChange(cb: (s: CameraState) => void): () => void; // returns unsubscribe
  dispose(): void;
}

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
}
```

### Rendering strategy

- **Single `InstancedMesh`** sized to the count of occupied cells in the current grid. Rebuilt on every `setGrid` call. 64³ is small enough that a full rebuild per generation is imperceptible.
- **Geometry:** `BoxGeometry(1, 1, 1)`.
- **Material:** `MeshLambertMaterial` — cheap, dark-scene friendly. Per-instance color via `InstancedMesh.setColorAt`.
- **Lighting:** one `HemisphereLight` (sky = `#F4F4F5`, ground = `#26262C`, intensity 0.6) + one `DirectionalLight` from above-front (intensity 0.8). No shadows in MVP.
- **Camera:** `PerspectiveCamera(45°, aspect, 0.1, 1000)`. Default position `(80, 60, 80)`, target `(32, 20, 32)`.
- **Controls:** three.js `OrbitControls`. Emit `CameraState` on `change` via `onCameraChange`.
- **Background:** `renderer.setClearColor(0x0A0A0B)` — matches `DESIGN.md`'s `background` token.

### Palette mapping

Renderer holds a `THREE.Color[]` parallel to the palette. Instance color = `palette[cellValue - 1]`.

### Shared camera (Compare view)

Compare view instantiates two `VoxelRenderer`s in two containers. It wires them:
```ts
rendererA.onCameraChange(state => rendererB.setCamera(state));
rendererB.onCameraChange(state => rendererA.setCamera(state));
```
A dedup guard (compare last-applied state) prevents infinite feedback.

### File layout

```
src/renderer/
  voxel-renderer.ts
  react/
    ViewportCanvas.tsx    # thin React wrapper, mounts VoxelRenderer in a div ref
  voxel-renderer.test.ts
```

---

## 6. State: Zustand store

Single store. Slices are conceptual — one file per slice, combined at the top level.

### Shape

```ts
interface Store {
  // Provider config
  activeProvider: "cached" | "anthropic" | "ollama";
  anthropicKey: string;
  anthropicModel: string;
  ollamaUrl: string;
  ollamaModel: string;

  // Current generation
  currentPrompt: string | null;
  currentScript: string | null;     // last executed script (any source)
  currentSource: "cached" | "anthropic" | "ollama" | null;
  currentModelSlug: string | null;  // for the assistant message label

  // Result
  lastGoodGrid: GridReadback | null;  // never null after first-load init
  isGenerating: boolean;
  lastError: ExecuteError | LLMProviderError | null;

  // Chat
  messages: ChatMessage[];

  // Camera (shared in Compare view)
  cameraA: CameraState | null;
  cameraB: CameraState | null;

  // Actions
  submitPrompt(prompt: string): Promise<void>;
  loadCachedDemo(promptSlug: string, modelSlug: string): void;
  setProvider(id: "cached" | "anthropic" | "ollama"): void;
  cycleProvider(): void;
  // ...settings setters, chat helpers
}
```

### Persistence

- Persist only: `activeProvider`, `anthropicKey`, `anthropicModel`, `ollamaUrl`, `ollamaModel`.
- Do not persist: messages, current grid, camera. Fresh every load.
- Use Zustand's `persist` middleware with `localStorage`.
- Persistence key: `daedalus-mvp-v1`.

### First-run initialization

On store creation:
1. If `lastGoodGrid` is null, synchronously load the default cached demo (`docs/specs/prds/2-daedalus-mvp-llm-generated-voxels.md` names `a small castle with four towers`; slug `castle-with-four-towers`, model `claude-sonnet-4-6`).
2. Prepend a stub assistant message representing that cached demo.

### File layout

```
src/store/
  index.ts               # combined store + persist config
  provider-slice.ts
  chat-slice.ts
  camera-slice.ts
  actions.ts             # submitPrompt, loadCachedDemo — orchestration
  actions.test.ts
```

---

## 7. Cached demos

The always-working default state. Six prompts × two models = 12 files, all checked into `demos/`.

### File layout

```
demos/
  red-sphere/
    claude-sonnet-4-6.js
    qwen3-coder-30b.js
  green-tree/
    ...
  castle-with-four-towers/
    ...
  spiral-staircase/
    ...
  small-robot/
    ...
  mushroom/
    ...
  manifest.json
```

- `manifest.json` — list of prompts with slug, human-readable prompt text, and array of model slugs available.
- Each `.js` file: raw generated script exactly as returned by the model (post-processed to strip fences, but not otherwise edited). Diffable in PRs.

### Runtime loading

- **Not** loaded via `fetch` — bundled at build time using Vite's `?raw` import suffix.
- A single generated `src/demos/index.ts` module (Vite `import.meta.glob` with `{ query: '?raw', import: 'default', eager: true }`) exposes:
  ```ts
  export const CACHED_DEMOS: Record<PromptSlug, Record<ModelSlug, string>>;
  ```
- This means adding a demo file is a filesystem write + rebuild; no runtime registration.

### Executing a cached demo

Cached demos flow through the sandbox executor exactly like a live-generated script. This is deliberate — it exercises the same code path in the browser, so a cached demo failing is a signal that something changed in the API surface.

### Bench script writes

`pnpm bench` writes into this directory (see next section).

---

## 8. `pnpm bench` script

Node script that regenerates cached demos on demand. Not shipped in the frontend bundle.

### Location

`scripts/bench.ts` — executed via `tsx` (dev dependency).

### Behavior

1. Read providers from environment: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`), `OLLAMA_URL` (default `http://localhost:11434`), `OLLAMA_MODEL` (default `qwen3-coder:30b`).
2. **Fail loud** if a provider is not configured. Per user story #26 — never silently regenerate demos from the wrong source.
   - Anthropic not configured = `ANTHROPIC_API_KEY` empty → error.
   - Ollama not configured = URL unreachable (fetch fails on health check) → error.
3. For each of the six canonical prompts × each configured provider:
   - Call `generateVoxelScript(prompt)` using the shared `LLMProvider` code (reused, not duplicated).
   - Execute the script through a Node-compatible port of the sandbox (see below).
   - If execution fails, log the failure and skip writing that file (so a broken generation doesn't overwrite a good cached demo).
   - On success, write to `demos/<prompt-slug>/<model-slug>.js`.
4. Update `demos/results.md` — a markdown table of prompts × models with success/failure and script line count. Human-readable review artifact.

### Node-side sandbox

The browser sandbox uses Web Workers, which don't exist in Node. Bench uses `node:vm` `Script.runInNewContext` with the voxel API injected — same failure taxonomy, different isolation primitive. Consolidated behind the same `ExecuteResult` shape.

### File layout

```
scripts/
  bench.ts
  bench-sandbox.ts       # Node vm implementation of the Executor interface
package.json             # "scripts": { "bench": "tsx scripts/bench.ts" }
```

---

## 9. System-prompt design

The prompt is where portfolio craft shows. Kept short so both models stay reliable and the token bill stays low.

**Rules of thumb:**
- No pleasantries. Direct instruction.
- Include exactly one worked example — the smallest possible.
- List the palette as bare comma-separated names, not a table.
- Do not describe error handling — the sandbox surfaces errors.
- Do not ask the model to "think step by step" — that inflates output for no gain here.

**Iteration protocol:** the prompt is a single string in `src/llm/system-prompt.ts`. Changes ship in a PR, cached demos are refreshed via `pnpm bench`, PR reviewer sees both diffs. Portfolio-visible iteration per the PRD's `Iteration posture`.

---

## 10. Failure handling summary

| Failure | Where detected | Where surfaced | Recovery |
|---|---|---|---|
| Provider not configured | Zustand action | Chat panel hint | Open settings |
| Anthropic HTTP 4xx/5xx | `AnthropicProvider` throws `LLMProviderError` | Assistant message | Retry / fix key |
| Ollama fetch fails | `OllamaProvider` throws `LLMProviderError(kind:"network")` | Assistant message | Start Ollama |
| Model returned non-code | `stripToScript` throws `LLMProviderError(kind:"shape")` | Assistant message | Retry |
| Script syntax error | Worker `new Function` throws | Assistant message + Code panel banner | Retry |
| Script runtime throw | Worker try/catch | Assistant message + Code panel banner | Retry |
| Script timeout | Main thread `Promise.race` | Assistant message | Retry with simpler prompt |
| Unknown palette color | Voxel API throws | Assistant message | Retry |

Every path leaves `lastGoodGrid` intact so the viewport never blanks.

---

## 11. Testing strategy

Vitest. `*.test.ts` colocated with source. No E2E in MVP — the four deep-module suites plus a smoke test for the renderer cover the contract surface.

### Voxel API + Grid (highest leverage)

- `place`: hits the cell you expect; out-of-bounds no-op; overwrites cleanly.
- `box`: fills the volume; clips at bounds without throwing; zero-size no-op.
- `sphere`: fills expected cell count for known radii; clips.
- `line`: 3D Bresenham traces expected cells for axis-aligned, diagonal, and 3D cases; clips.
- Palette: unknown color throws with the expected message; all 16 names resolve.
- Grid: readback returns the right size + palette; new grid is empty.
- No state leak: two grids are independent.

### Sandbox Executor

- Valid script fills the grid you expect (fixture: `place(0,0,0,"red")` → readback cell at 0 is red).
- Syntax error → `{ ok: false, error: { kind: "syntax" } }` — not a Promise rejection.
- Runtime throw → `{ ok: false, error: { kind: "runtime" } }`.
- Infinite loop (`while(true){}`) → `{ ok: false, error: { kind: "timeout" } }` in ~3s.
- Unknown color → `{ ok: false, error: { kind: "unknown-color", colorName: "chartreuse" } }`.
- **API surface regression guard:** run the assertion `typeof place === "function" && typeof box === "function" && ...` inside the sandbox and check it returns true — locks the contract the system prompt makes.

### LLMProvider

- Mocked `fetch`. Assert request shape (URL, headers, body) matches the api-contracts doc.
- Canned response → `stripToScript` extracts the fenced block.
- HTTP 4xx → `LLMProviderError(kind:"http", status:4xx)`.
- Network error → `LLMProviderError(kind:"network")`.
- Empty response after strip → `LLMProviderError(kind:"shape")`.
- No real HTTP, no keys required in CI.

### Voxel Renderer

- Smoke test. Feed a grid with 5 known cells → `InstancedMesh` created with `.count === 5` → per-instance colors match palette lookup. No visual snapshot testing.

### Store

- `submitPrompt` with cached provider → loads the cached demo without HTTP.
- `submitPrompt` on Anthropic when key is empty → sets error state, does not call fetch.
- `submitPrompt` success → `lastGoodGrid` updated, message appended.
- `submitPrompt` failure → `lastGoodGrid` unchanged, error message appended.

### What is not tested

- Three.js rendering pixels. Smoke test only.
- Real HTTP against Anthropic / Ollama. Manual verification via `pnpm dev`.
- Visual regression of UI. Manual via `pnpm dev`.
- Cross-browser. MVP is Chromium-first.

---

## 12. Repo structure (target)

```
daedalus/
  demos/                       # cached generated scripts
  docs/
    adrs/
    brainstorms/
    specs/
      prds/
      design-spec.md
      engineering-spec.md
      api-contracts.md
  scripts/
    bench.ts
    bench-sandbox.ts
  src/
    demos/
      index.ts                 # Vite raw-import glob
    llm/
    renderer/
      react/
    sandbox/
    store/
    ui/                        # React components
      App.tsx
      ChatPanel.tsx
      Viewport.tsx
      SettingsDrawer.tsx
      CodePanel.tsx
      CompareView.tsx
      TopStrip.tsx
    voxel/
    main.tsx
    index.css                  # Plex import, DESIGN.md tokens as CSS custom properties
  DESIGN.md
  README.md
  index.html
  vite.config.ts
  tsconfig.json
  package.json
```

---

## 13. Dependencies (locked)

Runtime:
- `react`, `react-dom`
- `three`
- `zustand`

Dev:
- `vite`, `@vitejs/plugin-react`
- `typescript`
- `vitest`
- `tsx` — for `pnpm bench`
- `@biomejs/biome` — lint + format

**Not** used (deliberately):
- `@anthropic-ai/sdk` — plain fetch is enough, one less dependency.
- `react-three-fiber`, `drei` — imperative three.js is smaller and gives us full control over the shared-camera Compare view.
- `tailwindcss` — DESIGN.md tokens as CSS custom properties + hand-rolled component styles. Tailwind's utility churn works against DESIGN.md's "no templated defaults" principle.
- `axios`, `ky`, any fetch wrapper.

---

## 14. What this spec does not cover

- Visual tokens — see `DESIGN.md`.
- UI states and copy — see `design-spec.md`.
- Exact request/response schemas for external APIs — see `api-contracts.md`.
- The rationale for the largest choices (no backend, Web Worker sandbox, JS not TS, named palette, cached demos as default) — see `docs/adrs/`.
