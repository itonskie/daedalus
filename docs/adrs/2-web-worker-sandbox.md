# ADR 2: Web Worker as the sandbox

**Status:** Accepted
**Date:** 2026-07-08

## Context

The LLM produces a JavaScript string that must run inside daedalus to fill the voxel grid. The output is model-generated code, potentially with syntax errors, infinite loops, or malicious calls. It must not:

- Touch the surrounding page (DOM, cookies, `localStorage` — including the visitor's Anthropic key).
- Make network requests.
- Freeze the main thread on an infinite loop.

The MVP is a local-only `pnpm dev` demo, so the threat model is mostly "model produced garbage, don't break the app." A hosted deployment would raise the bar; this ADR is scoped to the MVP.

## Decision

**Wrap the script in a fresh Web Worker per execution.**

- Bundle the voxel API into a worker module (`src/sandbox/worker.ts`) via Vite's `?worker` suffix.
- Inject `place`, `box`, `sphere`, `line` as globals on `self` before evaluating the script.
- Evaluate via `new Function(script)()` inside a try/catch.
- Enforce a **3000ms** wall-clock timeout on the main thread via `Promise.race`; on timeout, `worker.terminate()`.
- Single-use: terminate the worker after every execution — no state leak between runs.
- Remove hazardous globals inside the worker: `delete self.postMessage; delete self.onmessage; delete self.fetch; delete self.XMLHttpRequest; delete self.WebSocket;` before script eval.

## Alternatives Considered

**`<iframe sandbox>` with `postMessage`.** Rejected: iframes are heavier to spin up (~10× slower cold start than a worker), require serving an HTML shell, and add DOM surface (the script *could* read from the iframe DOM even if isolated). Workers have no DOM by construction.

**QuickJS-WASM.** Rejected for MVP: adds ~600KB to the bundle, adds an engine-boundary shape mismatch (values crossing WASM boundaries need marshalling), and gives us stronger isolation than we need for local-only. Reconsider if daedalus is ever hosted publicly and untrusted scripts run in shared context.

**`Function` on the main thread.** Rejected: infinite loops would freeze the page. Terminating a main-thread eval requires cooperation from the script; workers can be killed with one line.

**Shared worker.** Rejected: state leaks between runs are exactly what "single-use per generation" fixes.

## Consequences

**Positive:**
- Native browser primitive — no dependency, no bundle bloat.
- Killable (`worker.terminate()`) — timeouts are cheap.
- No DOM, no shared globals with the host page.
- The voxel API surface is exactly what we inject — impossible for a script to import something we don't expose.

**Negative:**
- Cold start per generation (~10ms). Imperceptible in this UX.
- `postMessage` transfer copies `Uint8Array` unless we use the `Transferable` overload — noted in the engineering spec.
- Workers don't exist in Node, so `pnpm bench` uses `node:vm` `Script.runInNewContext` behind the same `Executor` interface (see engineering-spec §8).
- If daedalus is ever hosted publicly, Web Worker isolation alone is not enough — a script can still exhaust CPU up to the 3000ms timeout across many parallel visitors. Revisit with a stricter execution budget or move to QuickJS-WASM.

## Related

- Referenced by: [`docs/specs/engineering-spec.md`](../specs/engineering-spec.md) §3.
- Interface: [`docs/specs/api-contracts.md`](../specs/api-contracts.md) §3.
- Depends on: [ADR 1](1-static-frontend-no-backend.md).
