# ADR 1: Static frontend, no backend

**Status:** Accepted
**Date:** 2026-07-08

## Context

The original v1 spec (`README.md`, closed as issue #1) described a browser voxel editor with a **Go backend** running greedy meshing and export pipelines, distributed as a single static binary via `go:embed` + GoReleaser. The MVP PRD reframes daedalus as a demo of the LLM code-execution-tool-use pattern with voxels as output — no export, no import, no manual editing tools.

The remaining pieces (LLM API calls, sandboxing, three.js rendering) can all run in the browser. The question is whether to keep a backend anyway for future headroom.

## Decision

**No backend.** daedalus MVP is a static frontend that ships as a `git clone && pnpm dev` local demo:

- LLM calls go directly from the browser to Anthropic (BYOK header) or a locally-running Ollama (`http://localhost:11434`).
- Cached demos are checked-in files bundled at build time via Vite's `?raw` import glob.
- No server-side state, no build-time secrets, no deployment target beyond static asset hosting.

## Alternatives Considered

**Keep the Go backend.** Rejected: it would exist to run zero code in the MVP. Greedy meshing, STL/GLTF export, and `.vox` import are all out-of-scope. A backend that does nothing is a maintenance burden that clouds the portfolio story.

**Node backend (Vite + Express).** Rejected: adds an origin-server-required deployment step to what is otherwise a `pnpm dev` demo. The BYOK-in-browser posture works only when there's no server between the user's key and Anthropic — a Node proxy adds a place for a key to leak.

**Cloudflare Worker / serverless proxy for Anthropic.** Rejected for MVP: it would hide the key handoff but introduces platform-specific deploy artifacts and rate-limit surface. Revisit if daedalus is ever hosted publicly (flagged in the PRD's Open Questions).

## Consequences

**Positive:**
- One code-base to reason about, one language surface (TypeScript + a small JS string the sandbox executes).
- Zero server-side attack surface for the MVP.
- The portfolio artifact is legibly one thing: "a browser demo of the code-execution pattern."
- Iteration is fast — every change is a Vite HMR reload.

**Negative:**
- **BYOK in the browser** — the visitor's Anthropic key lives in `localStorage` and travels in a request header from their device. Fine for local `pnpm dev` demos; not fine for a publicly hosted daedalus.dev. If daedalus is ever hosted, either add a proxy (this ADR is superseded) or restrict live-play to Ollama.
- **No shared cache, no server-side rate limiting.** Not a problem — cached demos absorb the "just browse the demo" traffic.
- **Sandbox posture is browser-only** — Web Worker. If a future variant of daedalus is hosted, worker isolation is still the right primitive but must be paired with a stricter script scope (see ADR 2).

## Related

- Supersedes: `README.md` v1 backend section (closed as issue #1).
- Referenced by: [`docs/specs/engineering-spec.md`](../specs/engineering-spec.md) §1.
- Flagged for review if daedalus ever gets a public URL.
