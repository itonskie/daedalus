# Design Spec

Behavior, layout, and states for the daedalus MVP UI. Visual tokens (colors, spacing, typography, motion) come from `DESIGN.md` — this spec never redefines them, only references them.

Related documents:
- Visual system: [`DESIGN.md`](../../DESIGN.md)
- Product intent: [`docs/specs/prds/2-daedalus-mvp-llm-generated-voxels.md`](prds/2-daedalus-mvp-llm-generated-voxels.md)
- Component contracts: [`docs/specs/engineering-spec.md`](engineering-spec.md)

---

## Global layout

The app is a full-bleed three-region layout inspired by (but simpler than) the workshop layout in `DESIGN.md`. There is no left tool rail in the MVP — the "tools" here are the LLM and the sandbox, not manual placement primitives.

```
+----------------------------------------------------------------+
|  daedalus                                    [◯ Anthropic] [⚙] |  top strip, 32px
+----------------------------------------------------------------+
|                                              |                 |
|                                              |   Chat panel    |
|                                              |   360px         |
|              3D voxel viewport               |                 |
|                (full bleed)                  |   [prompt list] |
|                                              |   [messages]    |
|                                              |   [input]       |
|                                              |                 |
+----------------------------------------------------------------+
```

**Regions:**
- **Top strip (32px)** — brand, provider indicator, settings gear. `surface` background, 1px `border` bottom.
- **Viewport (fills remaining width)** — three.js canvas on `background` (`#0A0A0B`). Bleeds edge-to-edge. No border on the left/top edges. 1px `border` on the right where it meets the chat panel.
- **Chat panel (360px, right)** — `surface` background. Cannot collapse in the MVP (it *is* the primary input).

**Compare view** replaces the single viewport with two viewports side by side. Chat panel is hidden (Compare is cached-only, not interactive). See [Compare Models view](#compare-models-view).

**Below 1024px** — show a placeholder message (`daedalus is built for a bigger screen`), matching `DESIGN.md`. Desktop-first, no responsive collapse.

---

## First-run experience

**Trigger:** the visitor lands with no prior state in `localStorage`.

**Behavior:**
1. App loads. Zustand initializes with a cached demo pre-selected (canonical prompt `a small castle with four towers`, model slug locked in engineering spec).
2. The viewport renders the cached grid immediately — no spinner, no loader, no "click to start."
3. The chat panel shows all six canonical prompts as chips at the top, then a stub assistant message indicating this is a cached example, then the empty input at the bottom.
4. The provider indicator in the top strip reads `Cached` in `text-secondary`.

**Rationale:** the demo cannot look broken. Per `DESIGN.md`, "the tool is *there* when the page renders."

**No onboarding tour, no modal, no welcome screen.** Discoverability comes from the chat chips and the settings gear.

---

## Chat panel

The primary input surface. Vertical stack, 360px wide.

### Layout

```
+-------------------------------------+
| Try a prompt                        |  section header, Label 13/500
| [a red sphere] [a green tree]       |  chips, wrap
| [a small castle with four towers]   |
| [a spiral staircase] [a small robot]|
| [a mushroom]                        |
+-------------------------------------+
|                                     |
|  ▸ user: a small castle...          |  message list, scrollable
|  ▸ assistant: [Cached example]      |
|     [show code]                     |
|                                     |
+-------------------------------------+
| Describe what to build...       [→] |  input + send, sticky bottom
+-------------------------------------+
```

### Canonical prompt chips

- Six chips, the frozen canonical prompt list from the PRD.
- Style: `surface-elevated` bg, `text-primary`, `borderRadius.md`, `spacing.sm` padding, `spacing.xs` gap between chips.
- Click behavior: fills the prompt into the input and immediately submits (single click = generate).
- Hover state: 1px `border` outline appears (100ms ease-out per motion tokens).
- Chips are always visible — they do not scroll with messages.

### Messages

- Vertical stack, `spacing.md` gap.
- User message: right-aligned label `user:` in `text-secondary`, prompt text in `text-primary` body style.
- Assistant message: left-aligned label `assistant:` in `text-secondary`, then a compact status line:
  - `Cached example` (cached demo)
  - `Anthropic · <model-name>` (live Anthropic run)
  - `Ollama · <model-name>` (live Ollama run)
  - `Error` in `danger` color (see error states below)
- Every assistant message has a `show code` link (ghost button, `text-secondary` → `text-primary` on hover). Clicking opens the [Code panel](#code-panel).
- No avatars, no timestamps, no emoji (per `DESIGN.md`).

### Input

- Sticky at the bottom of the panel.
- Placeholder: `Describe what to build...` in `text-secondary`.
- IBM Plex Sans, 13/400 (body).
- Submits on `Enter`. `Shift+Enter` inserts a newline.
- Send button: ghost arrow (`→`) on the right, disabled state when input is empty or a generation is in flight.

### States

- **Default** — input empty, chips visible, message list empty (first-run shows the initial cached-demo assistant message).
- **Generating** — input disabled, send button shows a small `text-secondary` spinner (12px). Previous viewport contents remain visible (do not blank).
- **Success** — new assistant message appended, viewport swaps to the new grid.
- **Error** — assistant message reads `Error` in `danger`, one-line reason underneath in `text-secondary` (see [Error taxonomy](#error-taxonomy)). Viewport keeps showing the previous successful grid.
- **Empty (no messages)** — first-run cached-demo message is the empty state. There is no separate blank state.
- **Provider not configured** — if the visitor tries to submit without any provider key/URL and the store is set to a live provider, show a `text-secondary` hint under the input: `Add a provider in settings to run live prompts.` The input is not blocked — the hint just appears on submit attempt.

### Accessibility

- Chips are `<button>` elements with `aria-label` matching the prompt text.
- Message list is a landmark region with `aria-live="polite"` so screen readers announce new assistant messages.
- Input has a visible `<label>` (`Prompt`) that is `visually-hidden` for sighted users but read by screen readers.
- Tab order: chips → message list → input → send.

---

## Viewport

The 3D scene. Full-bleed on `background`.

### Layout

- Canvas fills the region.
- Orbit controls: left-drag rotate, right-drag pan, scroll zoom. Standard three.js `OrbitControls`.
- Camera: perspective only in the MVP (ortho toggle is out of scope per PRD).
- Grid floor: not rendered in the MVP. The voxels supply structure.

### States

- **Default** — the currently loaded grid renders. Orbit is enabled.
- **Loading** — during a live generation, the previous grid remains. A subtle 12px `text-secondary` `Generating…` label appears bottom-left of the viewport with a small spinner. No blanking, no overlay.
- **Error** — the previous grid remains. A one-line `text-secondary` hint appears bottom-left: `Last generation failed — showing previous scene.` Clears when the next successful generation lands.
- **Empty (impossible in MVP)** — cached demos always initialize a grid, so this state does not exist.

### Interactions

- Orbit is on by default. No modifier keys required.
- Double-click resets camera to the default framing (isometric-ish, centered on the grid). Motion: 220ms ease-in-out per `DESIGN.md` motion tokens.
- No hover interactions on individual voxels. No selection. No editing.

### Accessibility

- Canvas is `aria-hidden` (three.js canvases are inaccessible by default; wrapping with alt text would be misleading).
- A `text-secondary` caption below the viewport reads the current prompt in mono — sighted-and-screen-reader accessible fallback describing what the scene shows.

---

## Settings drawer

Configuration for the two live providers. Opened from the gear icon in the top strip. Overlays from the right, 400px wide.

### Layout

```
+------------------------------------+
| Settings                        [×]|  Display 20/600
+------------------------------------+
| Active provider                    |  Label 13/500
| ( ) Cached demos                   |
| ( ) Anthropic                      |
| ( ) Ollama                         |
+------------------------------------+
| Anthropic                          |
| API key                            |
| [sk-ant-...................]       |  mono input
| Model                              |
| [claude-sonnet-4-6            ▾]   |
+------------------------------------+
| Ollama                             |
| URL                                |
| [http://localhost:11434       ]    |  mono input
| Model                              |
| [qwen3-coder:30b              ]    |  mono input
+------------------------------------+
|                          [Close]   |  secondary button
+------------------------------------+
```

### Behavior

- Values persist to `localStorage` on blur (no `Save` button — this is a tool, trust the input per `DESIGN.md`'s "trust the user" line).
- The active provider radio is the single source of truth for what the chat panel submits against.
- Selecting `Anthropic` or `Ollama` when that provider is not configured shows an inline `text-secondary` hint next to the radio: `Add an API key below.` / `Configure URL and model below.`
- No confirmation modals. Clicking the backdrop or `×` closes the drawer.

### States per input

- **API key input** — `password` type, mono. Reveal button (`show`) on the right that toggles to `text`. `text-secondary` hint underneath: `Stored in localStorage on this device only.`
- **Model dropdown (Anthropic)** — select from a hard-coded list of currently-recommended models. Default: latest Sonnet. Locked in engineering spec.
- **Model input (Ollama)** — free-text mono input. No dropdown (Ollama models are arbitrary strings). Placeholder: `qwen3-coder:30b`.
- **URL input (Ollama)** — free-text mono input. Placeholder: `http://localhost:11434`. Validation: must parse as a URL; on invalid, show `text-secondary` hint `Not a valid URL`.

### Motion

- Drawer slide-in: 180ms ease-in-out (per `DESIGN.md` panel transition token).
- No backdrop blur. Solid 40% black overlay (per `DESIGN.md` modal rules).

### Accessibility

- Drawer is `role="dialog"` `aria-labelledby="settings-title"`.
- Focus moves to the first input on open, returns to the gear icon on close.
- `Esc` closes the drawer.
- Tab traps inside the drawer while open.

---

## Provider toggle (top strip)

A quick switcher between the currently *configured* providers, sitting in the top strip so the visitor doesn't have to open settings to swap.

### Behavior

- Reads: `Cached` / `Anthropic` / `Ollama` — whichever is active.
- Clicking cycles to the next *configured* provider. Cached is always configured. Anthropic/Ollama are configured when their respective inputs in the drawer are non-empty.
- If only one provider is configured, the toggle is disabled (still visible, `text-secondary`, no hover cursor).
- Style: ghost button, `text-secondary`, becomes `text-primary` on hover. Active provider name in mono (`Anthropic`, `Ollama`, `Cached`).

### Rationale

Per user story #10, the toggle exists so visitors can compare live outputs without hunting through the drawer.

---

## Code panel

Shows the generated script that produced the current viewport. Opened via `show code` on any assistant message, or via a persistent `View code` link at the bottom-left of the viewport when a script is loaded.

### Layout

Modal-style overlay from the bottom, 40% viewport height, `surface-elevated` bg.

```
+----------------------------------------------------------+
| Generated script  ·  Anthropic · claude-sonnet-4-6   [×] |  Label 13/500 + text-secondary
+----------------------------------------------------------+
|                                                          |
|  // read-only source, IBM Plex Mono 12/400               |
|  box(20, 0, 20, 24, 4, 24, "stone")                      |
|  ...                                                     |
|                                                          |
+----------------------------------------------------------+
| [Copy]                                                   |  ghost button
+----------------------------------------------------------+
```

### Behavior

- Read-only. No editing — this is provenance, not a REPL.
- `Copy` copies the script to clipboard. On success, button label becomes `Copied` in `success` for 800ms then reverts.
- Closing: `×`, `Esc`, or clicking the viewport above.
- Panel is non-modal — the viewport behind stays interactive (orbit still works).

### States

- **Default** — script visible.
- **Cached** — script is the file contents of `demos/<prompt-slug>/<model-slug>.js`, header shows `Cached · <model-slug>`.
- **Error case (script errored)** — the script is still shown (this is exactly what visitors want to see for debugging), with a one-line `danger` banner above: `This script threw a <error-type> at line <n>.`

---

## Compare Models view

A static, cached-only side-by-side comparison of Claude vs. Qwen3-Coder against the six canonical prompts. Reached from a top-strip link (`Compare models`).

### Layout

```
+----------------------------------------------------------------+
|  ← Back to editor         Compare Models                       |  top strip
+----------------------------------------------------------------+
| Prompt: [a red sphere ▾]                                       |  prompt selector
+----------------------------------------------------------------+
|                              |                                 |
|                              |                                 |
|      Claude                  |      Qwen3-Coder                |
|      claude-sonnet-4-6       |      qwen3-coder:30b            |
|                              |                                 |
|  [3D viewport A]             |  [3D viewport B]                |
|                              |                                 |
|  [show code]                 |  [show code]                    |
|                              |                                 |
+----------------------------------------------------------------+
```

### Behavior

- Prompt selector: dropdown of the six canonical prompts.
- Both viewports render the cached grids for that prompt from `demos/<prompt-slug>/<model-slug>.js`.
- **Shared orbit camera:** one `OrbitControls` instance drives both scenes. Rotating on viewport A rotates viewport B in lockstep (per user story #4). Implementation: single camera state in Zustand, both viewports read from it.
- Below each viewport: model slug and `show code` link. Clicking `show code` opens the Code panel for that side.

### States

- **Default** — first canonical prompt selected, both viewports rendered.
- **Missing cached demo** — if a `demos/<prompt-slug>/<model-slug>.js` is absent, show a `text-secondary` placeholder in that viewport: `No cached result for <model-slug>.` Do not error the whole view.
- **Empty (impossible)** — MVP ships with all 12 cached demos (6 prompts × 2 models) checked in.

### Motion

- Prompt change: viewports crossfade over 180ms (ease-in-out). Camera does not reset.

---

## Error taxonomy

Every error the visitor can see. Copy in `DESIGN.md` voice: what went wrong + what to do, one sentence each, no apologies.

| Class | Where it appears | Copy |
|---|---|---|
| Provider not configured | Chat panel hint | `Add a provider in settings to run live prompts.` |
| Anthropic HTTP error (4xx) | Assistant message | `Anthropic rejected the request (<status>). Check your API key.` |
| Anthropic HTTP error (5xx) | Assistant message | `Anthropic returned an error (<status>). Try again in a moment.` |
| Ollama unreachable | Assistant message | `Could not reach Ollama at <url>. Is it running?` |
| Ollama HTTP error | Assistant message | `Ollama returned an error (<status>).` |
| Model returned non-code | Assistant message | `The model returned something that isn't code.` |
| Script syntax error | Assistant message + Code panel banner | `The generated script has a syntax error at line <n>.` |
| Script runtime throw | Assistant message + Code panel banner | `The generated script threw <error-type> at line <n>.` |
| Script timeout | Assistant message | `The generated script ran too long and was stopped.` |
| Unknown palette color | Assistant message | `The script used an unknown color: <name>.` |

All error copy is single-sentence, `text-secondary` for the hint variant and `danger` for the assistant-message label. No exclamation marks. No emoji. No `Oops`.

---

## Motion summary

Reuses `DESIGN.md` tokens verbatim. No new motion in this spec.

- Hover / active: 100ms ease-out
- Panel / drawer transitions: 180ms ease-in-out
- Camera reset: 220ms ease-in-out
- Copy-confirm: 800ms hold on `success`, then revert
- No entrance animations, no shimmer, no glow, no parallax

---

## Accessibility summary

- Every interactive element is a real `<button>` or `<input>`, never a `<div>` with a click handler.
- Tab order per section is documented above.
- `Esc` closes drawers and the code panel.
- `aria-live="polite"` on the chat message list.
- Focus rings use `accent` (`#5E6AD2`) at 2px offset — matches `DESIGN.md`'s "focus rings" line.
- No text below 11px.
- Color contrast: `text-primary` on `background` = 15.4:1, `text-secondary` on `surface` = 5.2:1 — both pass AA.

---

## What this spec does not cover

- Visual tokens — see `DESIGN.md`.
- Exact React component boundaries — see engineering spec.
- Exact API request/response shapes — see `api-contracts.md`.
- The system prompt sent to the LLM — see engineering spec.
