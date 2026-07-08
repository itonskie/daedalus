# ADR 3: JavaScript (not TypeScript) inside the sandbox

**Status:** Accepted
**Date:** 2026-07-08

## Context

The daedalus frontend is TypeScript. The LLM produces a code string that the sandbox executes. The choice is what language that string is in — the model can be prompted to emit either.

## Decision

**The generated script is plain JavaScript.**

- The system prompt instructs: `Return only executable JavaScript.`
- The sandbox evaluates the string directly via `new Function(script)()`.
- No transpilation step at runtime.

## Alternatives Considered

**TypeScript inside the sandbox.** Rejected: would require shipping an in-browser transpiler (`esbuild-wasm` or `sucrase`) — ~1MB of bundle for zero visitor-facing benefit. The model doesn't need types to place voxels; the sandbox contract is small enough that types add nothing.

**A restricted DSL.** Rejected: teaching the model a DSL is a research problem. Every capable code model already writes JS reliably.

**WebAssembly text format.** Rejected: absurd for this use case, listed only to acknowledge it was considered.

## Consequences

**Positive:**
- Zero bundle cost for transpilation.
- The generated script is directly readable in the Code panel — no source-map dance.
- Both Anthropic and Ollama models produce JS reliably out of the box (JS is over-represented in code training data).
- Cached demos on disk are `.js` files — runnable anywhere with a stub voxel API.

**Negative:**
- No type-checking on generated scripts — but errors surface as runtime throws in the sandbox with the [error taxonomy](../specs/design-spec.md#error-taxonomy) copy, which is what visitors would see either way.
- The system prompt has to spell out palette names as strings (typed enums would let the compiler catch typos). Mitigated by throwing `Unknown color: <name>` — the same visitor-facing outcome.

## Related

- Referenced by: [`docs/specs/engineering-spec.md`](../specs/engineering-spec.md) §4 (system prompt).
- Contract: [`docs/specs/api-contracts.md`](../specs/api-contracts.md) §1.
