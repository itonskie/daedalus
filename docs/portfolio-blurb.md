# daedalus — portfolio blurb

A browser-based demo of the code-execution-tool-use pattern. A visitor types a prompt; an LLM writes a short JavaScript program that calls a small voxel API; the program runs in a sandboxed Web Worker and renders a 64³ voxel scene in three.js. Voxels are the medium — the pattern is the artifact. Ships as a `git clone && pnpm dev` static frontend with two live providers (Anthropic BYOK, local Ollama) and six cached demos, so the page always loads into a working scene without a key.

- Deep-module architecture (voxel API, sandbox executor, LLM provider, renderer) behind small, stable interfaces — the LLM provider is a single-method contract, so any new model drops in without touching the rest of the pipeline.
- Static Compare Models view renders Claude and Qwen3-Coder side by side against the same prompt under one shared orbit camera — cached only, so the comparison story works with zero visitor configuration.
- Written in TypeScript against a design system built for density (dark viewport, IBM Plex, grayscale chrome, indigo only for active/primary actions) — the voxels supply the color; the interface stays out of the way.
