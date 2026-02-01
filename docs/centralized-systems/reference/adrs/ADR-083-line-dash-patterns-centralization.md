# ADR-083: Line Dash Patterns Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-31 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `LINE_DASH_PATTERNS` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `LINE_DASH_PATTERNS` from `config/text-rendering-config.ts`
- **Decision**: Centralize all `ctx.setLineDash()` patterns (45+ hardcoded across 16 files)
- **API**:
  - `LINE_DASH_PATTERNS.SOLID` - `[]` (reset)
  - `LINE_DASH_PATTERNS.DASHED` - `[5, 5]`
  - `LINE_DASH_PATTERNS.DOTTED` - `[2, 4]`
  - `LINE_DASH_PATTERNS.DASH_DOT` - `[8, 4, 2, 4]`
  - `LINE_DASH_PATTERNS.SELECTION` - `[5, 5]`
  - `LINE_DASH_PATTERNS.GHOST` - `[4, 4]`
  - `LINE_DASH_PATTERNS.HOVER` - `[12, 6]`
  - `LINE_DASH_PATTERNS.LOCKED` - `[4, 4]`
  - `LINE_DASH_PATTERNS.CONSTRUCTION` - `[8, 4]`
  - `LINE_DASH_PATTERNS.ARC` - `[3, 3]`
  - `LINE_DASH_PATTERNS.TEXT_BOUNDING` - `[2, 2]`
  - `LINE_DASH_PATTERNS.CURSOR_DASHED` - `[6, 6]`
  - `LINE_DASH_PATTERNS.CURSOR_DOTTED` - `[2, 4]`
  - `LINE_DASH_PATTERNS.CURSOR_DASH_DOT` - `[8, 4, 2, 4]`
- **Helper Functions**:
  - `applyLineDash(ctx, pattern)` - Apply pattern to canvas context
  - `resetLineDash(ctx)` - Reset to solid line
- **Type**: `LineDashPattern` - Union type of all patterns
- **Industry Standard**: AutoCAD LTSCALE / ISO 128 Line Types
- **Files Migrated**:
  - `CursorRenderer.ts` - Uses `CURSOR_DASHED`, `CURSOR_DOTTED`, `CURSOR_DASH_DOT`
  - `SelectionRenderer.ts` - Uses `CURSOR_DASHED`, `CURSOR_DOTTED`, `CURSOR_DASH_DOT`
  - `ghost-entity-renderer.ts` - Uses `GHOST` pattern
  - `hover/config.ts` - Uses `SELECTION` pattern
  - `canvas-v2/preview-canvas/PreviewRenderer.ts` - Uses `DASHED` for arc preview (2026-01-31)
  - `canvas-v2/layer-canvas/LayerRenderer.ts` - Uses `SELECTION` for polygon highlight (2026-01-31)
  - `canvas-v2/dxf-canvas/DxfRenderer.ts` - Uses `SELECTION` for selection highlights (2026-01-31)
  - `systems/phase-manager/PhaseManager.ts` - Uses `DASHED` for overlay preview (2026-01-31)
  - `debug/CursorSnapAlignmentDebugOverlay.ts` - Uses `DASHED` for debug lines (2026-01-31)
  - `test/visual/overlayRenderer.ts` - Uses `DASHED` for test crosshair (2026-01-31)
  - `collaboration/CollaborationOverlay.tsx` - Uses `SELECTION` for user selections (2026-01-31)
- **Migration Status**: ✅ **COMPLETE** - Zero hardcoded `[5, 5]` patterns remaining
- **Benefits**:
  - Zero hardcoded dash patterns
  - Consistent visual style across all renderers
  - Single point of change for pattern tuning
  - Type-safe pattern references
- **Companion**: ADR-044 (Canvas Line Widths), ADR-058 (Canvas Primitives)
