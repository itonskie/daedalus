# daedalus

A browser-based voxel editor for makers, indie game devs, and anyone who'd reach for MagicaVoxel but wishes it ran in the browser, was open source, and had power-user export.

Build chunky 3D models by placing/painting voxels in a real-time orbit view, then export to STL for 3D printing, GLTF/GLB for games and the web, or save as MagicaVoxel-compatible `.vox`.

## Why

MagicaVoxel is the gold-standard voxel editor — and it's desktop-only, closed source, and dated. Goxel is open but desktop-only. Browser voxel editors exist but most are toys without serious export pipelines.

`daedalus` is the modern, browser-first, open-source take: instant load via URL, real export pipeline (greedy meshing + STL/GLTF optimization), MagicaVoxel `.vox` import for compatibility with existing libraries, and a clean React-Three-Fiber editor surface.

Named for Daedalus — the mythological master craftsman who built the labyrinth and invented mechanical wings. Patron saint of builders.

## Status

🚧 **In design / pre-alpha.** Public repo is up so the design can iterate in the open. Implementation begins shortly.

## v1 Scope

- **Grid** up to 128³ voxels
- **Tools**: place, erase, paint, eyedropper
- **Custom color palette** with save/load
- **Mirror modes** (X / Y / Z) for symmetrical builds
- **Orbit + pan camera**, orthographic/perspective toggle
- **Undo / redo** history
- **Export**: STL (3D print) and GLTF/GLB (games, web)
- **Import**: MagicaVoxel `.vox` files
- **Project save/load** as plain JSON files — your projects live on your disk, not our servers

Deferred to later: layers, animation, materials (emissive/transparent), STL → voxelize import, multi-user collaboration, asset gallery.

## Stack

**Frontend** — TypeScript / React
- **Vite** — dev server & bundling
- **React Three Fiber** + **drei** — declarative Three.js
- **Three.js InstancedMesh** — fast voxel rendering at 128³ scale
- **Zustand** — state for voxel grid, palette, camera
- **Tailwind CSS** — toolbars & panels
- **Vitest** — tests
- **Biome** — lint + format

**Backend** — Go
- **Go 1.22+**
- **Chi** router (or stdlib `net/http`)
- **Greedy meshing** algorithm (hand-rolled) — the core technical showpiece
- STL writer (binary), GLTF writer via [`qmuntal/gltf`](https://github.com/qmuntal/gltf)
- MagicaVoxel `.vox` parser
- Single static binary that embeds the built frontend via Go `embed`

## Architecture

Interactive editing runs entirely in the browser for instant feedback. The Go backend is invoked for the heavy lifting:

- `POST /export/stl` → voxel data → greedy meshing → optimized STL stream
- `POST /export/gltf` → voxel data → greedy meshing → optimized GLB stream
- `POST /import/vox` → MagicaVoxel `.vox` → JSON voxel data

Local-first by design: no accounts, no database, no cloud storage. Projects are files on your disk.

## Install (when v1 ships)

```bash
# Single binary — opens localhost:7777 in your browser
./daedalus
```

Cross-platform releases (Linux / macOS / Windows) via GoReleaser.

## Development

```bash
# Frontend
cd web && pnpm install && pnpm dev

# Backend
go run ./cmd/daedalus
```

(Once scaffolded.)

## License

[MIT](./LICENSE)
