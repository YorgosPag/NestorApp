# ADR-123: PreviewRenderer Color Centralization (hex → UI_COLORS)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-02-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `UI_COLORS` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Status**: ✅ APPROVED
- **Date**: 2026-02-01
- **Canonical**: `UI_COLORS` from `config/color-config.ts`
- **Decision**: Migrate 5 hardcoded hex colors in PreviewRenderer to centralized UI_COLORS
- **Problem**: PreviewRenderer.ts had 5 inline hex color values:
  - Line 105: `color: '#00FF00'` (preview default - green)
  - Line 111: `gripColor: '#00FF00'` (grip default - green)
  - Line 487: `ctx.strokeStyle = '#FFA500'` (arc stroke - orange)
  - Line 517: `ctx.fillStyle = '#FF00FF'` (angle text - fuchsia)
  - Line 710: `ctx.strokeStyle = '#000000'` (grip border - black)
- **Solution**: Replace inline hex with UI_COLORS references
- **New Color Added**:
  - `UI_COLORS.PREVIEW_ARC_ORANGE` (#FFA500) - Arc stroke in angle measurement
- **Existing Colors Used**:
  - `UI_COLORS.BRIGHT_GREEN` (#00ff00) - Preview/grip default
  - `UI_COLORS.DIMENSION_TEXT` (fuchsia) - Angle text
  - `UI_COLORS.BLACK` (#000000) - Grip border
- **Files Changed** (2 files):
  - `config/color-config.ts` - Added PREVIEW_ARC_ORANGE constant
  - `canvas-v2/preview-canvas/PreviewRenderer.ts` - 5 replacements, added UI_COLORS import
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero hardcoded colors in PreviewRenderer
  - Consistent theming support
  - Single point of change for preview appearance
  - Type-safe color references
- **Verification**:
  - TypeScript: `npx tsc --noEmit --project src/subapps/dxf-viewer/tsconfig.json`
  - Grep: `grep -n "#00FF00\|#FFA500\|#FF00FF\|#000000" src/subapps/dxf-viewer/canvas-v2/preview-canvas/PreviewRenderer.ts` (should return nothing)
- **Companion**: ADR-004 (Canvas Theme), ADR-119 (Opacity Constants), ADR-040 (Preview Canvas)
