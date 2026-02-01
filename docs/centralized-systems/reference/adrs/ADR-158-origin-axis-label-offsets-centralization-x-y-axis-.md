# ADR-158: Origin Axis Label Offsets Centralization (X/Y axis labels)

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `TEXT_LABEL_OFFSETS` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `TEXT_LABEL_OFFSETS` extension in `config/text-rendering-config.ts`
- **Decision**: Centralize X/Y axis label positioning offsets for origin markers
- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Problem**: Duplicate hardcoded magic numbers for axis label positioning in 2 files:
  - `rendering/ui/origin/OriginMarkersRenderer.ts` (lines 109, 116):
    - `ctx.fillText('X', viewport.width - 10, originScreenY - 5);`
    - `ctx.fillText('Y', originScreenX + 5, 10);`
  - `debug/OriginMarkersDebugOverlay.ts` (lines 235, 242):
    - Identical hardcoded values: `10`, `5`, `5`, `10`
- **Magic Numbers Eliminated**:
  | Value | Purpose | Used In |
  |-------|---------|---------|
  | `10` | X-label right margin from viewport edge | 2 files |
  | `5` | X-label bottom offset from axis | 2 files |
  | `5` | Y-label left offset from axis | 2 files |
  | `10` | Y-label top margin from viewport edge | 2 files |
- **Solution**: Extended `TEXT_LABEL_OFFSETS` (ADR-143 extension) with 4 new constants:
  ```typescript
  // 🏢 ADR-158: X/Y AXIS LABEL POSITIONING (2026-02-01)
  X_AXIS_LABEL_RIGHT_MARGIN: 10,   // ctx.fillText('X', viewport.width - X_AXIS_LABEL_RIGHT_MARGIN, ...)
  X_AXIS_LABEL_BOTTOM_OFFSET: 5,   // ctx.fillText('X', ..., originScreenY - X_AXIS_LABEL_BOTTOM_OFFSET)
  Y_AXIS_LABEL_LEFT_OFFSET: 5,     // ctx.fillText('Y', originScreenX + Y_AXIS_LABEL_LEFT_OFFSET, ...)
  Y_AXIS_LABEL_TOP_MARGIN: 10,     // ctx.fillText('Y', ..., Y_AXIS_LABEL_TOP_MARGIN)
  ```
- **Files Migrated** (2 files, 4 replacements):
  - `rendering/ui/origin/OriginMarkersRenderer.ts`:
    - Line ~109: X-label position → `TEXT_LABEL_OFFSETS.X_AXIS_LABEL_RIGHT_MARGIN`, `TEXT_LABEL_OFFSETS.X_AXIS_LABEL_BOTTOM_OFFSET`
    - Line ~116: Y-label position → `TEXT_LABEL_OFFSETS.Y_AXIS_LABEL_LEFT_OFFSET`, `TEXT_LABEL_OFFSETS.Y_AXIS_LABEL_TOP_MARGIN`
  - `debug/OriginMarkersDebugOverlay.ts`:
    - Lines ~235, 242: Same 4 replacements
- **Pattern**: Single Source of Truth (SSOT) in text-rendering-config.ts
- **Benefits**:
  - Eliminates 8 hardcoded magic numbers (4 values × 2 files)
  - Single source of truth for axis label positioning
  - Extends existing ADR-143 pattern (origin/cursor offsets)
  - Consistent X/Y label positioning between renderer and debug overlay
  - Easy global adjustment for different viewport sizes or accessibility needs
- **Companion**: ADR-143 (Origin/Cursor Offset Constants), ADR-091 (Text Label Offsets), ADR-102 (Origin Markers)
