# API Contracts

Every interface across a module boundary. Includes:

1. **Voxel API** — the sandbox-injected globals the LLM writes code against. THE core contract of daedalus.
2. **LLMProvider** — the internal provider interface.
3. **Sandbox Executor** — the internal executor interface.
4. **Anthropic Messages API** — the exact HTTP shape used.
5. **Ollama Chat API** — the exact HTTP shape used.
6. **Cached demo file format** — the on-disk contract for `demos/`.

Related documents:
- Product intent: [`docs/specs/prds/2-daedalus-mvp-llm-generated-voxels.md`](prds/2-daedalus-mvp-llm-generated-voxels.md)
- Module implementations: [`docs/specs/engineering-spec.md`](engineering-spec.md)

---

## 1. Voxel API (sandbox globals)

Injected into the Web Worker's `self` scope by the sandbox bootstrap. This is the interface the LLM is *taught* by the system prompt. Any change here is a breaking change to every cached demo.

### `place(x, y, z, color)`

Write a single voxel.

**Parameters:**
| name | type | notes |
|---|---|---|
| `x` | `number` | integer via `Math.floor`; may be out-of-bounds |
| `y` | `number` | integer via `Math.floor`; may be out-of-bounds |
| `z` | `number` | integer via `Math.floor`; may be out-of-bounds |
| `color` | `string` | must match a palette name |

**Returns:** `undefined`.

**Behavior:**
- Out-of-bounds coordinates (`< 0` or `≥ 64` on any axis) — silent no-op.
- Unknown `color` — throws `Error("Unknown color: <name>")`.
- Non-numeric `x`/`y`/`z` — throws `TypeError`.
- Overwrites any existing cell at that coordinate.

### `box(x, y, z, w, h, d, color)`

Fill an axis-aligned rectangular region.

**Parameters:**
| name | type | notes |
|---|---|---|
| `x`, `y`, `z` | `number` | starting corner, integer via `Math.floor` |
| `w`, `h`, `d` | `number` | dimensions on the x/y/z axes, integer via `Math.floor` |
| `color` | `string` | palette name |

**Returns:** `undefined`.

**Behavior:**
- Fills the region `[x, x+w) × [y, y+h) × [z, z+d)`.
- Any dimension `≤ 0` — silent no-op.
- Region clipped to `[0, 64)` on each axis. Never throws for bounds; only throws for unknown color or non-numeric args.

### `sphere(cx, cy, cz, r, color)`

Fill a solid sphere.

**Parameters:**
| name | type | notes |
|---|---|---|
| `cx`, `cy`, `cz` | `number` | center, integer via `Math.floor` |
| `r` | `number` | radius, integer via `Math.floor` |
| `color` | `string` | palette name |

**Returns:** `undefined`.

**Behavior:**
- Fills every cell `(i, j, k)` where `(i-cx)² + (j-cy)² + (k-cz)² ≤ r²` (Euclidean, comparing to `r²` after flooring).
- `r ≤ 0` — silent no-op.
- Clipped to grid bounds. Never throws for bounds.

### `line(x1, y1, z1, x2, y2, z2, color)`

Draw a 3D line via Bresenham.

**Parameters:**
| name | type | notes |
|---|---|---|
| `x1`, `y1`, `z1` | `number` | start, integer via `Math.floor` |
| `x2`, `y2`, `z2` | `number` | end, integer via `Math.floor` |
| `color` | `string` | palette name |

**Returns:** `undefined`.

**Behavior:**
- 3D Bresenham. Inclusive on both endpoints.
- Clipped to grid bounds (out-of-bounds steps are skipped, not throwing).

### Palette (16 colors)

Complete, frozen for the MVP.

`white`, `black`, `red`, `orange`, `yellow`, `green`, `blue`, `indigo`, `purple`, `pink`, `brown`, `stone`, `wood`, `grass`, `water`, `gold`

Hex values live in `src/voxel/palette.ts` (see engineering spec for the mapping).

### What is *not* in the API

Deliberately absent. Do not add without a PRD update:

- `fill` / flood-fill.
- `clear` — the grid is fresh per run.
- `getCell` / read-back — the script produces, it does not query.
- `Math`, `console`, or other globals — see [Sandbox scope](#sandbox-scope).

### Sandbox scope

Also available inside the sandbox scope (safe globals):
- `Math` — needed for realistic script complexity (trigonometry for spirals, `Math.random` for organic shapes).
- `Number`, `String`, `Array`, `Object` — standard built-ins.

Explicitly removed / not present:
- `fetch`, `XMLHttpRequest`, `WebSocket` — no network from within the script.
- `document`, `window` — Web Workers don't have these anyway; belt and suspenders.
- `postMessage`, `onmessage` — the bootstrap uses these; the script must not.
- `console` — script `console.log` output is not captured or shown. Do not encourage the model to log.

The bootstrap deletes these before evaluating the script (`delete self.postMessage`).

---

## 2. LLMProvider interface

Internal TypeScript contract. Both providers implement it identically.

```ts
export interface LLMProvider {
  readonly id: "anthropic" | "ollama";
  generateVoxelScript(prompt: string): Promise<string>;
}

export class LLMProviderError extends Error {
  constructor(
    public providerId: "anthropic" | "ollama",
    public kind: "http" | "network" | "shape",
    public status?: number,
    message?: string,
  );
}
```

**Contract:**
- Returns a string containing **executable JavaScript with no markdown fences** (post-processed).
- Throws `LLMProviderError` on any failure. Never returns a rejected promise from a non-`LLMProviderError`.
- Never mutates the input `prompt`.
- Never reads state outside its constructor-injected config.

**Constructor config:**

```ts
new AnthropicProvider({ apiKey: string, model: string });
new OllamaProvider({ baseUrl: string, model: string });
```

Constructors do not validate — they trust the caller (store handles pre-submit checks).

---

## 3. Sandbox Executor interface

Internal TypeScript contract.

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

export interface GridReadback {
  size: 64;
  cells: Uint8Array;                  // length 262144; 0 empty; else paletteIndex + 1
  palette: readonly PaletteColor[];   // stable ordering
}

export interface PaletteColor {
  name: string;    // e.g. "red"
  hex: string;     // e.g. "#EF4444"
}
```

**Contract:**
- `execute` always resolves — never rejects. All errors are returned as `{ ok: false, error }`.
- Timeout: **3000ms**. Locked here so ticket authors and cached-demo authors know the limit.
- The executor is stateless across calls. Concurrent `execute` calls are legal and independent.

---

## 4. Anthropic Messages API (external HTTP)

Exact shape daedalus sends and expects. Reference: `docs.anthropic.com/en/api/messages`. Locked here so the mocked-fetch tests can assert against a stable contract.

### Request

```
POST https://api.anthropic.com/v1/messages
```

**Headers:**
```
Content-Type: application/json
x-api-key: <visitor-supplied>
anthropic-version: 2023-06-01
anthropic-dangerous-direct-browser-access: true
```

The last header is required by Anthropic for calls from a browser (CORS + explicit acknowledgment of BYOK-in-browser posture).

**Body:**
```json
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 2048,
  "system": "<system prompt from src/llm/system-prompt.ts>",
  "messages": [
    { "role": "user", "content": "<visitor prompt>" }
  ]
}
```

- `model`: one of the values in the settings dropdown (see [Anthropic model list](#anthropic-model-list)).
- `max_tokens`: `2048` — generous enough for compact-but-detailed scripts, tight enough to bound cost.
- `system`: exactly the shared prompt, no interpolation.
- Single user message. No assistant history. No streaming.

### Response (200)

```json
{
  "id": "msg_...",
  "type": "message",
  "role": "assistant",
  "model": "claude-sonnet-4-6",
  "content": [
    { "type": "text", "text": "<generated script, possibly fenced>" }
  ],
  "stop_reason": "end_turn",
  "usage": { "input_tokens": 123, "output_tokens": 456 }
}
```

daedalus reads only `content[0].text`. Everything else is ignored (fine — no logging, no cost accounting in the MVP).

### Response (4xx / 5xx)

```json
{
  "type": "error",
  "error": { "type": "invalid_request_error", "message": "..." }
}
```

Mapped to `LLMProviderError({ kind: "http", status })`. Assistant message shows the [error taxonomy](design-spec.md#error-taxonomy) copy — never the raw `error.message`.

### Anthropic model list

Options exposed in the settings dropdown. Update alongside `docs/adrs/` if the list changes.

- `claude-opus-4-7` — highest quality, slowest, most expensive
- `claude-sonnet-4-6` — **default**, best price/perf
- `claude-haiku-4-5` — fastest, lowest quality

The default's slug is also the model used for cached Anthropic demos.

---

## 5. Ollama Chat API (external HTTP)

Reference: `github.com/ollama/ollama/blob/main/docs/api.md`. Locked shape:

### Request

```
POST <configured-base-url>/api/chat
```

Default base URL: `http://localhost:11434`. Configurable via settings drawer.

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "model": "qwen3-coder:30b",
  "stream": false,
  "messages": [
    { "role": "system", "content": "<system prompt>" },
    { "role": "user",   "content": "<visitor prompt>" }
  ]
}
```

- `stream: false` — daedalus does not consume SSE.
- System prompt goes as a message here (not a top-level field like Anthropic).

### Response (200)

```json
{
  "model": "qwen3-coder:30b",
  "created_at": "2026-07-08T15:04:05Z",
  "message": {
    "role": "assistant",
    "content": "<generated script, possibly fenced>"
  },
  "done": true,
  "total_duration": 1234567890
}
```

daedalus reads only `message.content`.

### Response errors

Ollama returns non-2xx with `{ "error": "..." }`. Mapped to `LLMProviderError({ kind: "http", status })`.

`fetch` failure (Ollama not running, CORS, DNS) → mapped to `LLMProviderError({ kind: "network" })`.

### Ollama model recommendations

Not enforced — the settings drawer takes a free-text input. Documented defaults / fallbacks:

- `qwen3-coder:30b` — default, best quality tested
- `qwen2.5-coder:14b` — lower-hardware fallback

The default's slug is also the model used for cached Ollama demos (with `:` replaced by `-` in the filename — see [file format](#6-cached-demo-file-format)).

---

## 6. Cached demo file format

On-disk contract for `demos/`. Every file is a plain `.js` file — one full generated script.

### Directory layout

```
demos/
  manifest.json
  results.md
  <prompt-slug>/
    <model-slug>.js
```

### Slug conventions

**Prompt slugs** (frozen for the MVP):

| prompt | slug |
|---|---|
| `a red sphere` | `red-sphere` |
| `a green tree` | `green-tree` |
| `a small castle with four towers` | `castle-with-four-towers` |
| `a spiral staircase` | `spiral-staircase` |
| `a small robot` | `small-robot` |
| `a mushroom` | `mushroom` |

**Model slugs:** the model identifier, sanitized:
- `:` → `-` (e.g. `qwen3-coder:30b` → `qwen3-coder-30b`)
- `/` → `-`
- All lowercase.

Applied uniformly by `pnpm bench` when writing files.

### File contents

Each `.js` file is the raw generated JavaScript, post-processed (fences stripped) but otherwise unedited. No headers, no wrapping IIFE, no exports. Example:

```js
// demos/red-sphere/claude-sonnet-4-6.js
sphere(32, 24, 32, 8, "red");
```

**Rules:**
- One file per (prompt, model) pair.
- Editing a demo by hand is allowed but marked in the PR description — future `pnpm bench` runs will overwrite.
- Files must execute successfully in the sandbox — CI runs a smoke test that loads every demo and verifies `execute` returns `ok: true`.

### `manifest.json`

Machine-readable index. Written by `pnpm bench`, checked in.

```json
{
  "version": 1,
  "prompts": [
    {
      "slug": "red-sphere",
      "text": "a red sphere",
      "models": ["claude-sonnet-4-6", "qwen3-coder-30b"]
    },
    { "slug": "green-tree", "text": "a green tree", "models": ["..."] }
  ]
}
```

Used by:
- The chat panel to render the six canonical prompt chips.
- The Compare view to enumerate available (prompt, model) pairs.
- CI smoke test to know which files to load.

### `results.md`

Human-readable review artifact. Markdown table written by `pnpm bench`.

```markdown
# Bench Results

Last run: 2026-07-08

| Prompt | claude-sonnet-4-6 | qwen3-coder-30b |
|---|---|---|
| a red sphere | ok · 1 line | ok · 3 lines |
| a green tree | ok · 12 lines | ok · 18 lines |
| ... | | |
```

Not consumed by runtime code. Exists so PR reviewers can see the shape of what changed without opening 12 `.js` files.

---

## 7. What this doc does not cover

- Rationale for the palette size / composition — see engineering spec + ADR on named palette.
- Reason for choosing `fetch` over `@anthropic-ai/sdk` — see engineering spec.
- The system prompt content itself — lives in `src/llm/system-prompt.ts`, iterated in PRs.
- UI copy for the errors surfaced by these contracts — see design-spec.
