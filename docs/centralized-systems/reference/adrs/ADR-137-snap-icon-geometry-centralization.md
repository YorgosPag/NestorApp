# ADR-137: Snap Icon Geometry Centralization

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `SNAP_ICON_GEOMETRY` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `SNAP_ICON_GEOMETRY` from `rendering/ui/snap/snap-icon-config.ts`
- **Decision**: Centralize all snap indicator geometry constants to eliminate inconsistencies
- **Status**: ✅ IMPLEMENTED
- **Problem**: Snap icon dimensions scattered across 2 files with inconsistencies:
  - Tangent circle ratio: 0.5 (SnapIndicatorOverlay) vs 0.6 (SnapRenderer)
  - Grid dot radius: 3px (SnapIndicatorOverlay) vs 2px (SnapRenderer)
- **Solution**: Single source of truth for snap geometry:
  ```typescript
  export const SNAP_ICON_GEOMETRY = {
    SIZE: 12,                    // Base size in pixels
    HALF_RATIO: 0.5,            // SIZE / 2
    QUARTER_RATIO: 0.25,        // SIZE / 4 (perpendicular, parallel)
    TANGENT_CIRCLE_RATIO: 0.5,  // UNIFIED: was 0.5 vs 0.6
    GRID_DOT_RADIUS: 3,         // UNIFIED: was 3 vs 2
    NODE_DOT_RADIUS: 2,         // Node/insertion center dot
    STROKE_WIDTH: 1.5,          // From ADR-133
  } as const;
  ```
- **Helper Functions**:
  - `getSnapIconHalf(size)` - Calculate half size
  - `getSnapIconQuarter(size)` - Calculate quarter size
  - `getTangentCircleRadius(halfSize)` - Tangent circle radius
  - `getGridDotRadius()` - Grid dot radius
  - `getNodeDotRadius()` - Node dot radius
- **Files Migrated**:
  - `canvas-v2/overlays/SnapIndicatorOverlay.tsx` - SVG-based rendering
  - `rendering/ui/snap/SnapRenderer.ts` - Canvas path-based rendering
- **Benefits**:
  - Visual consistency between SVG and Canvas renderers
  - Single source of truth for snap icon dimensions
  - AutoCAD/MicroStation compatible standard sizes
- **Companion**: ADR-133 (SVG Stroke Width), ADR-064 (Shape Primitives)

---

## Changelog

### 2026-06-24 — Dead canvas SnapRenderer removed (FULL-SSoT snap unification, Step 1)

The canvas-path snap renderer was confirmed **dead at runtime** and removed:

- `rendering/ui/snap/SnapRenderer.ts` — **DELETED**. Its `render()` was never invoked: the
  `LayerRenderer` legacy path never called `uiComposite.render()`, and the unified path skipped
  the `snap` key because `options.snapResults` was hardwired to `EMPTY_SNAP_RESULTS`.
- `rendering/ui/snap/LegacySnapAdapter.ts` — **DELETED**. It was instantiated in `LayerRenderer`
  but its `render()` was never called; it only converted between two stale `SnapResult` type systems.
- `LayerRenderer.ts` — removed the `snapRenderer` field, its construction, the `register('snap', …)`
  line, and the `LegacySnapAdapter` import.
- Barrel re-exports cleaned in `rendering/ui/snap/index.ts` and `rendering/ui/index.ts`.

**Live snap rendering is now exclusively `canvas-v2/overlays/SnapIndicatorOverlay.tsx` (SVG, ADR-040
leaf pattern).** `SNAP_ICON_GEOMETRY` remains the single source of truth, consumed only by the SVG
overlay. The unification of snap result **types** follows in §Step 2 below.

### 2026-06-24 — Snap result TYPE unification → single `ProSnapResult` SSoT (Step 2)

The codebase had **four parallel `SnapResult` type vocabularies** plus inline duplicates, all
modelling "a detected snap point". Collapsed onto the one canonical engine type
(`ProSnapResult` / `SnapCandidate` in `snapping/extended-types.ts`):

- **Deleted** the legacy result types:
  - `rendering/ui/snap/SnapTypes.ts` — removed `SnapType` (10-val), `SnapResult`, `SnapRenderData`,
    `SnapRenderMode`. The file now owns ONLY snap *settings* (`SnapSettings` + `DEFAULT_SNAP_SETTINGS`,
    still consumed by `CanvasSettings`).
  - `canvas-v2/layer-canvas/layer-types.ts` — removed `SnapResult` (4-val) + `EMPTY_SNAP_RESULTS`.
    `SnapType`/`SnapSettings` config kept (used by the layer render hooks).
  - `canvas-v2/layer-canvas/layer-canvas-hooks.ts` — removed its own inline `SnapResult` interface.
  - `SnapIndicatorOverlay.tsx` — removed its inline `SnapResult` interface.
- **Added** the single presentation SSoT in `snapping/extended-types.ts`:
  - `SnapIndicatorView` (the 3-field shape the overlay needs) + `toSnapIndicatorView(ProSnapResult)`
    — the ONE adapter projecting `snappedPoint→point`, `activeMode→type`, `snapPoint.description→description`.
    The inline mapping formerly in `canvas-layer-stack-leaves.tsx` now calls this adapter.
- **Removed the dead `snapResults` plumbing** that only fed the deleted canvas SnapRenderer:
  `LayerRenderOptions.snapResults`, the always-empty `EMPTY_SNAP_RESULTS` pass-through in
  `LayerCanvas`/`CanvasLayerStack`, the no-op `.map()` in `layer-canvas-hooks`, the dead snap branch
  in `layer-ui-settings`, and the always-empty `window.__debugSnapResults` write in `LayerRenderer`.

**Net result:** exactly ONE snap result type (`ProSnapResult`) + ONE presentation view-model
(`SnapIndicatorView`) with ONE adapter. The separate `SnapResultItem` (cursor mouse-handler channel)
and `Dim3DSnapResult` (3D raycasting) are distinct subsystems, intentionally out of scope.

> Note: this type unification was originally slated as "ADR-370" but that number is already taken
> (ADR-370 bim-corner-snap / bim-readonly-visualization); the snap-rendering history lives here in ADR-137.
