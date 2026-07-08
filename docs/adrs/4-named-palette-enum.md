# ADR 4: Named palette enum (not freeform hex)

**Status:** Accepted
**Date:** 2026-07-08

## Context

The voxel API needs a color argument. Options span a spectrum:

- **Hex strings** — `place(0, 0, 0, "#EF4444")`. Maximum flexibility.
- **RGB tuples** — `place(0, 0, 0, [239, 68, 68])`. Composable, verbose.
- **Named enum** — `place(0, 0, 0, "red")`. Constrained, memorable.

The choice affects: system prompt length, model reliability, cached-demo readability, and the aesthetic of the rendered output.

## Decision

**Fixed named palette of 16 colors.** Locked in [`docs/specs/api-contracts.md`](../specs/api-contracts.md) §1.

Colors: `white`, `black`, `red`, `orange`, `yellow`, `green`, `blue`, `indigo`, `purple`, `pink`, `brown`, `stone`, `wood`, `grass`, `water`, `gold`.

- Unknown name throws `Error("Unknown color: <name>")` — surfaced to the visitor via the [error taxonomy](../specs/design-spec.md#error-taxonomy).
- Additions to the palette require refreshing all cached demos.

## Alternatives Considered

**Freeform hex strings.** Rejected: the model would produce hexes with vague and inconsistent semantics ("what shade of red for a mushroom?"). The rendered output would look less unified across demos. Also longer to type — the system prompt would need to explain hex conventions, inflating tokens.

**RGB tuples.** Rejected: verbose in generated scripts, harder to read in the Code panel, no aesthetic benefit over hex.

**Full CSS color name set (~140 names).** Rejected: too many names to include in the system prompt without bloating it; too many for the model to pick coherently. A curated 16 is more artifact than menu.

**Smaller palette (8 colors).** Rejected: not enough coverage for the six canonical prompts (`castle`, `tree`, `robot`, `mushroom` collectively want stone, wood, grass, gold, brown, red, white).

## Consequences

**Positive:**
- System prompt lists 16 tokens — no explanation needed.
- Cached demos are readable: `sphere(32, 20, 32, 8, "red")` beats `sphere(32, 20, 32, 8, "#EF4444")`.
- Aesthetic coherence across models and prompts — Claude's mushroom and Qwen's mushroom pick from the same palette, so the Compare view compares *shape* choices, not color drift.
- Cheap to render — the renderer builds one `THREE.Color` per palette entry, indexed by integer.

**Negative:**
- **Locked** — the palette is part of the on-disk contract for cached demos. Growing it requires a bench refresh (running `pnpm bench` on both providers). Documented in the api-contracts file.
- Cannot express "a slightly darker red" in a script — the model has to pick one of the 16. This is fine for the MVP; a future ADR could revisit if variety becomes a bottleneck.
- Palette choice is opinionated — reviewer may want a color that isn't in the set. Handled by opening a small change PR that refreshes demos alongside the palette.

## Related

- Referenced by: [`docs/specs/api-contracts.md`](../specs/api-contracts.md) §1.
- Referenced by: [`docs/specs/engineering-spec.md`](../specs/engineering-spec.md) §2.
- Impacts: system prompt length, cached demo aesthetics.
