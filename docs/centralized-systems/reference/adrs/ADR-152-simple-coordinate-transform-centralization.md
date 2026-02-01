# ADR-152: Simple Coordinate Transform Centralization

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `worldToScreenSimple` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `worldToScreenSimple`, `screenToWorldSimple`, `transformBoundsToScreen`, `transformBoundsToWorld` from `rendering/core/CoordinateTransforms.ts`
- **Decision**: Centralize inline coordinate transform patterns to eliminate duplicate code
- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Problem**: Duplicate inline coordinate transform patterns in ~20 occurrences across 6 files:
  ```typescript
  // BEFORE: Inline pattern repeated everywhere
  x: point.x * transform.scale + transform.offsetX,
  y: point.y * transform.scale + transform.offsetY
  ```
  Files with duplicates:
  - `utils/overlay-drawing.ts:60-62, 143-145` - Point transforms for overlays
  - `rendering/passes/EntityPass.ts:284-287` - BoundingBox transforms for visibility
  - `rendering/hitTesting/Bounds.ts:414-417` - BoundingBox transforms
  - `hooks/interfaces/useCanvasOperations.ts:220-228` - Local transform functions
  - `canvas-v2/layer-canvas/LayerRenderer.ts:154` - Fallback (no viewport)
  - `CoordinateTransforms.ts:59-60, 69` - Fallback (invalid viewport)
- **Solution**: Add standalone export functions to CoordinateTransforms.ts:
  ```typescript
  // 🏢 ADR-152: Centralized Simple Coordinate Transforms
  import { worldToScreenSimple, transformBoundsToScreen } from '../rendering/core/CoordinateTransforms';

  // Point transform (no Y-inversion)
  const screenVertices = vertices.map(v => worldToScreenSimple(v, transform));

  // BoundingBox transform (no Y-inversion)
  const screenBounds = transformBoundsToScreen(bounds, transform);
  ```
- **Files Migrated** (6 files):
  - `utils/overlay-drawing.ts`:
    - Before: Inline pattern in 2 places
    - After: `worldToScreenSimple(v, transform)`
  - `rendering/passes/EntityPass.ts`:
    - Before: Inline screenBounds calculation
    - After: `transformBoundsToScreen(bounds, transform)`
  - `rendering/hitTesting/Bounds.ts`:
    - Before: Inline transform in ViewportBounds.transform()
    - After: Delegates to `transformBoundsToScreen()`
  - `hooks/interfaces/useCanvasOperations.ts`:
    - Before: Local worldToScreen/screenToWorld functions
    - After: `worldToScreenSimple()` and `screenToWorldSimple()`
  - `canvas-v2/layer-canvas/LayerRenderer.ts`:
    - Before: Inline fallback calculation
    - After: `worldToScreenSimple(point, transform)`
- **New Functions Added** to `CoordinateTransforms.ts`:
  - `worldToScreenSimple(point, transform)` - Point world→screen (no Y-flip)
  - `screenToWorldSimple(point, transform)` - Point screen→world (no Y-flip)
  - `transformBoundsToScreen(bounds, transform)` - BoundingBox world→screen
  - `transformBoundsToWorld(bounds, transform)` - BoundingBox screen→world
- **Pattern**: Single Source of Truth (SSOT)
- **Key Distinction**:
  - `CoordinateTransforms.worldToScreen()` - With Y-axis inversion (for CAD rendering)
  - `worldToScreenSimple()` - Without Y-axis inversion (for overlays, visibility checks)
- **Benefits**:
  - Eliminated ~20 lines of duplicate inline code
  - Single source of truth for simple coordinate transforms
  - Clear distinction between CAD transforms (Y-flip) and simple transforms (no flip)
  - Consistent behavior across overlay systems, visibility checks, bounding boxes
  - Easier maintenance - change in one place affects all
- **Companion**: ADR-046 (Single Coordinate Transform)
