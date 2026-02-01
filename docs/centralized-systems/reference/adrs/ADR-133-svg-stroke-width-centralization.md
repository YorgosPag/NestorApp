# ADR-133: SVG Stroke Width Centralization

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | Design System |
| **Canonical Location** | `config/panel-tokens.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Problem**: 50+ hardcoded `strokeWidth="2"` values scattered across SVG components
- **Decision**: Add `SVG_ICON` section to `PANEL_LAYOUT` with centralized stroke width tokens
- **Canonical Location**: `config/panel-tokens.ts` → `PANEL_LAYOUT.SVG_ICON`
- **Values Available**:
  - `STROKE_WIDTH.THIN`: 1 (details, grid lines, dashed patterns)
  - `STROKE_WIDTH.STANDARD`: 2 (primary icons, snap indicators, overlays)
  - `STROKE_WIDTH.BOLD`: 3 (emphasis, active states, selected)
  - `STROKE.THIN/STANDARD/BOLD`: String versions for inline attributes
- **Files Updated**:
  - `canvas-v2/overlays/SnapIndicatorOverlay.tsx`
  - `canvas-v2/overlays/RulerCornerBox.tsx` (7 icons)
  - `ui/toolbar/icons/shared/BaseIcon.tsx`
- **Pattern**: Industry standard (Material Design, Figma, AutoCAD = 2px stroke)
