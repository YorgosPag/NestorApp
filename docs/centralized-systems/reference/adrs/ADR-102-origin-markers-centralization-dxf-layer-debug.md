# ADR-102: Origin Markers Centralization (DXF/Layer/Debug)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `OriginMarkerUtils.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `OriginMarkerUtils.ts` from `rendering/ui/origin/`
- **Decision**: Centralize origin marker rendering from 3 scattered implementations to single utility
- **Problem**: Duplicate origin marker code across 3 files (~50 lines each):
  - `DxfRenderer.ts` (lines 80-103): Orange L-shape (TOP + LEFT)
  - `LayerRenderer.ts` (lines 219-243): Blue inverted L-shape (BOTTOM + RIGHT)
  - `OriginMarkersRenderer.ts`: Magenta crosshair (DEBUG overlay)
- **Duplicate Code Issues**:
  - Same `worldToScreen(worldOrigin, transform, viewport)` calculation in 3 places
  - Hardcoded values: `20px` arm length, `'-45', '-10'` label offset
  - Inconsistent rendering patterns (manual ctx.save/restore, path creation)
- **Solution**: Single Source of Truth utility with variant system
- **API**:
  ```typescript
  // Core functions
  getOriginScreenPosition(transform, viewport): Point2D
  drawOriginMarker(ctx, screenOrigin, { variant: 'dxf' | 'layer' | 'debug' })
  renderOriginMarker(ctx, transform, viewport, options) // Convenience combo

  // Configuration (ORIGIN_MARKER_CONFIG)
  ARM_LENGTH: 20  // Arm length in pixels
  LINE_WIDTH: RENDER_LINE_WIDTHS.THICK
  FONT: UI_FONTS.MONOSPACE.BOLD
  COLORS.DXF: UI_COLORS.DRAWING_HIGHLIGHT  // Orange
  COLORS.LAYER: UI_COLORS.BUTTON_PRIMARY   // Blue
  COLORS.DEBUG: UI_COLORS.DEBUG_ORIGIN     // Magenta
  ```
- **Variant System**:
  - `'dxf'`: Orange L-shape (TOP + LEFT arms) - DXF canvas world origin
  - `'layer'`: Blue inverted L-shape (BOTTOM + RIGHT arms) - Layer canvas
  - `'debug'`: Magenta crosshair (all 4 directions) - Debug overlay
- **Files Migrated**:
  - `canvas-v2/dxf-canvas/DxfRenderer.ts` - 24 lines → 1 line
  - `canvas-v2/layer-canvas/LayerRenderer.ts` - 25 lines → 1 line
- **Pattern**: Single Source of Truth (SSOT) + Variant pattern
- **Benefits**:
  - Zero duplicate coordinate transformation code
  - Consistent marker styling (colors, fonts, sizes)
  - Single point of change for origin marker appearance
  - Type-safe variant selection
  - Uses centralized systems: ADR-088 (pixelPerfect), ADR-042 (UI_FONTS), ADR-044 (LINE_WIDTHS)
- **Companion**: ADR-088 (Pixel-Perfect Rendering), ADR-058 (Canvas Primitives)
