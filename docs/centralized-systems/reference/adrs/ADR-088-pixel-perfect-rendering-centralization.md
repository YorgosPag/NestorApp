# ADR-088: Pixel-Perfect Rendering Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `pixelPerfect()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `pixelPerfect()`, `pixelPerfectPoint()` from `geometry-rendering-utils.ts`
- **Decision**: Centralize pixel-perfect alignment pattern (`Math.round(v) + 0.5`)
- **Problem**: Duplicate inline functions across 4 files:
  - `CrosshairOverlay.tsx`: `Math.round(pos.x) + 0.5` (inline)
  - `LayerRenderer.ts`: `const px = (v: number) => Math.round(v) + 0.5;`
  - `DxfRenderer.ts`: `const px = (v: number) => Math.round(v) + 0.5;`
  - `OriginMarkersRenderer.ts`: `const px = (v: number) => Math.round(v) + 0.5;`
- **Solution**: Single Source of Truth in `geometry-rendering-utils.ts`
- **API**:
  - `pixelPerfect(value: number): number` - Single coordinate (returns `Math.round(value) + 0.5`)
  - `pixelPerfectPoint(point: Point2D): Point2D` - Full point alignment
- **Why +0.5**:
  - Canvas coordinates are at pixel CENTER (not edge)
  - A 1px line at integer coordinate spans 2 pixels (anti-aliased = blurry)
  - Adding 0.5 places the line exactly on pixel boundary = crisp 1px line
- **Industry Standard**: AutoCAD, Figma, Blender all use this pattern
- **Files Migrated**:
  - `canvas-v2/overlays/CrosshairOverlay.tsx` - Crosshair lines
  - `canvas-v2/layer-canvas/LayerRenderer.ts` - Origin marker lines
  - `canvas-v2/dxf-canvas/DxfRenderer.ts` - Origin marker lines
  - `rendering/ui/origin/OriginMarkersRenderer.ts` - Axis lines
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero duplicate pixel-perfect helper functions
  - Consistent crisp line rendering across all canvases
  - Documented reason for the +0.5 pattern
  - CAD-grade visual quality
- **Companion**: ADR-044 (Canvas Line Widths), ADR-058 (Canvas Primitives), ADR-083 (Line Dash Patterns)
