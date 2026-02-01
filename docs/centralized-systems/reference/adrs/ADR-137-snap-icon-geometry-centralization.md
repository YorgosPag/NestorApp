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
