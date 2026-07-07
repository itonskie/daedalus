---
name: daedalus
colors:
  background: "#0A0A0B"
  surface: "#131316"
  surface-elevated: "#1C1C21"
  border: "#26262C"
  text-primary: "#F4F4F5"
  text-secondary: "#8B8B93"
  accent: "#5E6AD2"
  success: "#10B981"
  warning: "#F59E0B"
  danger: "#EF4444"
typography:
  display:
    fontFamily: "IBM Plex Sans"
    fontSize: "20px"
    fontWeight: 600
  body:
    fontFamily: "IBM Plex Sans"
    fontSize: "13px"
  mono:
    fontFamily: "IBM Plex Mono"
    fontSize: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
borderRadius:
  sm: "2px"
  md: "4px"
  lg: "6px"
---

# daedalus

## Philosophy

daedalus is a tool for makers. The UI is a workshop, not a canvas: dark, quiet, dense, and out of the way. Every pixel of chrome that isn't earning its keep is a pixel stealing attention from the model. The voxels supply all the color; the interface supplies structure.

Three influences: Goxel's clean flatness, Linear's typographic discipline, Blender's fearless density. The model — not the toolbar — is the hero.

## Color

The palette is deliberately near-monochrome. The voxel model itself is the source of color in the workspace, so any UI color has to justify its existence.

- **background** `#0A0A0B` — the 3D viewport backdrop. Near-black, never pure black (pure black kills depth perception on OLED). Voxels read cleanly against it regardless of hue.
- **surface** `#131316` — toolbars, side panels, the palette drawer. One notch lighter than the viewport so panels feel like they sit *on* the workspace rather than cut *into* it.
- **surface-elevated** `#1C1C21` — modals, dropdowns, active tool state. One notch again — the elevation ladder is subtle and consistent.
- **border** `#26262C` — hairline dividers only. Never used to "box in" content. If two surfaces already have contrast, don't add a border.
- **text-primary** `#F4F4F5` — headings, active labels, tool names. Off-white, never `#FFF` (pure white burns on dark).
- **text-secondary** `#8B8B93` — hints, keyboard shortcuts, unit suffixes ("px", "vox"), inactive labels.
- **accent** `#5E6AD2` — indigo. Reserved for: active tool, selected voxel outline, focus rings, primary action buttons. Never used for decoration. If you're tempted to use accent to "make something look nicer," don't.
- **success** `#10B981` — export completed, save confirmed. Momentary states only.
- **warning** `#F59E0B` — grid at max size, unsaved changes indicator.
- **danger** `#EF4444` — destructive actions (clear grid, delete palette). Never used for errors that are recoverable — those are `text-secondary` with a warning icon.

**The rule:** UI chrome is grayscale + indigo. Everything else the user sees in color is *their model*.

## Typography

**IBM Plex Sans** for all UI text and **IBM Plex Mono** for numeric fields (coordinates, dimensions, hex codes). Plex is engineered, characterful, and open-source — it matches the tool's identity as an open, maker-built product. Its slightly wider letterforms hold up at the small sizes a dense tool needs.

Hierarchy:
- **Display 20/600** — panel titles, modal headings. Used sparingly.
- **Label 13/500** — tool names, button labels, panel section headers.
- **Body 13/400** — general text.
- **Hint 11/400 text-secondary** — keyboard shortcuts, unit hints.
- **Mono 12/400** — every numeric field. Coordinates `X 42 Y 17 Z 8`, dimensions `128×128×128`, hex codes `#5E6AD2`.

Numbers *always* mono. It removes character-width jitter as values change during scrubbing, and it visually distinguishes "data" from "chrome."

## Spacing

4px base grid. Density is a feature, not a bug — a voxel editor's power comes from having tools *at hand*, not two clicks away.

- **xs 4px** — inside dense inputs (spinner buttons, palette swatches).
- **sm 8px** — between related controls in a row.
- **md 12px** — between grouped sections in a panel.
- **lg 16px** — panel padding (inside edge to content).
- **xl 24px** — between major panel regions.
- **xxl 32px** — only for modal internal padding and the export dialog.

If you're reaching for `xl` or `xxl` in a toolbar, you're doing it wrong.

## Layout

Three-region layout, non-negotiable:
- **Left rail (48px)** — primary tools (place, erase, paint, eyedropper, mirror). Vertical icon column, Blender-style.
- **Center** — the 3D viewport. Bleeds edge-to-edge. No decorative border, no header bar over the model.
- **Right panel (280px, collapsible)** — palette, current color, dimensions, camera mode toggle, mirror axes, undo/redo history.
- **Top strip (32px)** — project name, save state, export button. Minimal.

Full-bleed viewport. Panels float over the viewport edges via a 1px border — no drop shadows, no rounded panel corners on the outer edge (they'd waste pixels the viewport wants).

Breakpoints don't apply — this is a desktop-first tool. Below 1024px width, show a "daedalus is built for a bigger screen" placeholder rather than degrade the density.

## Components

**Tool buttons** — 32px square, `surface` bg, `text-secondary` icon. Active state: `surface-elevated` bg, `accent` icon, 1px `accent` bottom border (not a full outline — a bottom accent nods to how physical tool racks show the picked-up tool).

**Palette swatches** — 20px square, tightly packed (2px gap). Selected swatch: 1px `accent` outline, 2px offset. No labels — the color IS the label.

**Numeric inputs** — mono font, right-aligned, minimum chrome. Drag-to-scrub on the label (Blender-style). No spinner buttons — they steal pixels.

**Buttons** — flat, no gradients, no shadows. Primary: `accent` bg, white text. Secondary: `surface-elevated` bg, `text-primary`. Ghost: no bg, `text-secondary`, becomes `text-primary` on hover. Border-radius `md` (4px).

**Modals** — center-screen, `surface-elevated`, 1px `border`. No backdrop blur — it's slow and it screams "web app." Solid 40% black overlay instead.

**Tooltips** — appear after 400ms hover. `surface-elevated` bg, keyboard shortcut in `text-secondary` mono to the right of the label.

## Motion

Subtle, functional, never decorative. If a motion doesn't communicate a state change, it doesn't ship.

- **Hover / active states**: 100ms ease-out.
- **Panel collapse/expand**: 180ms ease-in-out.
- **Camera transitions** (perspective ↔ ortho toggle): 220ms ease-in-out.
- **Tool switch**: instant. No animation. Frustration multiplies at 60Hz.
- **No entrance animations** on load. The tool is *there* when the page renders.
- **No hover parallax, no glow pulses, no shimmer loaders.**

## Voice

Direct, technical, respectful. The user knows what a voxel is. Don't explain.

- "Export STL" not "Save your creation as STL"
- "128×128×128" not "128 by 128 by 128 voxels"
- "Unsaved" not "You have unsaved changes"
- Error messages: what went wrong + what to do. One sentence each. No apologies.
- No exclamation marks. No emoji. No "Oops!"

## Brand

daedalus feels like a well-worn tool on a workbench. Quiet, precise, ready. The name is mythological but the vibe isn't — no wings, no gold, no ornament. The mythology is a promise about craftsmanship, not a visual motif.

If the design were a physical object, it would be a machinist's caliper: matte, exact, monochrome, valuable because of what it does.

## Anti-Patterns

Explicit "never do" list. Reject any UI that trips these:

- **No purple/pink gradients.** No gradients at all, actually.
- **No system-ui, Inter, Roboto, or Arial.** If Plex fails to load, fall back to `ui-monospace` and let it look weird.
- **No pure `#000` backgrounds** and no pure `#FFF` text.
- **No drop shadows.** Depth comes from elevation via the surface ladder.
- **No glassmorphism, no backdrop-filter blur.** They're expensive and dated.
- **No rounded pill buttons.** Border radius stops at 6px.
- **No hero copy anywhere in the app.** This isn't a marketing site.
- **No emoji in UI, ever.** Not in tooltips, not in success messages, not in empty states.
- **No skeuomorphic 3D-looking buttons.** Everything is flat.
- **No decorative accent color.** Indigo only means "active" or "primary action."
- **No animations on state that changes 60 times a second** (voxel counts, camera coords, brush size while dragging).
- **No modals for confirmations of reversible actions.** Trust the user; trust undo.
- **No "Are you sure?" for anything that undo covers.**
- **No progress bars for operations that take <200ms.** They cause more anxiety than they relieve.
- **No onboarding tour.** The tool is discoverable through the toolbar.
