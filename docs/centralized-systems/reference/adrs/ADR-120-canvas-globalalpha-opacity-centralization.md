# ADR-120: Canvas globalAlpha Opacity Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `OPACITY` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `OPACITY` from `config/color-config.ts`
- **Decision**: Migrate hardcoded `ctx.globalAlpha` values to centralized OPACITY constants
- **Status**: ✅ APPROVED
- **Problem**: 12 hardcoded opacity values across 7 files despite existing OPACITY constant
- **Solution**:
  - Add `OPACITY.SUBTLE = 0.6` for origin markers
  - Replace all hardcoded values with OPACITY.* references
- **API**:
  - `OPACITY.OPAQUE` - 1.0 (full opacity, reset value)
  - `OPACITY.HIGH` - 0.9 (region bubbles, near-opaque overlays)
  - `OPACITY.MEDIUM` - 0.7 (construction lines, semi-transparent)
  - `OPACITY.SUBTLE` - 0.6 (NEW: origin markers, subtle overlays)
  - `OPACITY.LOW` - 0.5
  - `OPACITY.VERY_LOW` - 0.3
  - `OPACITY.FAINT` - 0.1
- **Files Migrated**:
  - `rendering/ui/ruler/RulerRenderer.ts` - 2 occurrences (0.6 → SUBTLE, 1 → OPAQUE)
  - `canvas-v2/preview-canvas/PreviewRenderer.ts` - 2 occurrences (0.7 → MEDIUM, 1 → OPAQUE)
  - `utils/overlay-drawing.ts` - 3 occurrences (0.9 → HIGH, 1 → OPAQUE x2)
  - `systems/phase-manager/PhaseManager.ts` - 1 occurrence (1.0 → OPAQUE)
  - `rendering/entities/BaseEntityRenderer.ts` - 2 occurrences (1.0 → OPAQUE x2)
  - `rendering/canvas/withCanvasState.ts` - 1 occurrence (1.0 → OPAQUE)
  - `debug/OriginMarkersDebugOverlay.ts` - 1 occurrence (1.0 → OPAQUE)
- **Benefits**:
  - Single source of truth for opacity values
  - Consistent visual appearance across canvas operations
  - Easy global adjustments (change one constant, affects all)
  - Type-safe references (TypeScript autocomplete)
- **Companion**: ADR-044 (Line Widths), ADR-083 (Line Dash Patterns), ADR-136 (Extended Opacity)
