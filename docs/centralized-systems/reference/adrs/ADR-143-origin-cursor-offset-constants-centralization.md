# ADR-143: Origin/Cursor Offset Constants Centralization

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
- **Decision**: Centralize all origin marker and cursor offset constants
- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Problem**: Hardcoded `15` pixel offset scattered across 4 files with different purposes:
  - `CalibrationGridRenderer.ts`: `± 15` - Origin crosshair arm length
  - `OriginMarkersRenderer.ts`: `+ 15` - Label line spacing, `- markerSize - 15` - "O" label gap
  - `OriginMarkersDebugOverlay.ts`: Same as OriginMarkersRenderer (duplicate code)
  - `useDynamicInputLayout.ts`: `+ 15`, `- 15` - Cursor offset for dynamic input
  - Additional `+ 5` offsets for fine label positioning
- **Solution**: Extended `TEXT_LABEL_OFFSETS` with 6 new constants:
  ```typescript
  // 🏢 ADR-143: ORIGIN MARKER OFFSETS
  ORIGIN_CROSSHAIR_ARM: 15,        // Crosshair extends ±15px from origin point
  ORIGIN_LABEL_LINE_SPACING: 15,   // Second line of label positioned 15px below first
  ORIGIN_LABEL_HORIZONTAL_GAP: 15, // "O" label positioned (markerSize + 15)px left of origin
  LABEL_FINE_OFFSET: 5,            // 5px offset for fine label positioning

  // 🏢 ADR-143: DYNAMIC INPUT CURSOR OFFSETS
  CURSOR_OFFSET_X: 15,             // Input positioned 15px right of cursor
  CURSOR_OFFSET_Y: 15,             // Input base positioned 15px above cursor
  ```
- **Files Migrated** (5 files):
  - `debug/CalibrationGridRenderer.ts` - ORIGIN_CROSSHAIR_ARM
  - `rendering/ui/origin/OriginMarkersRenderer.ts` - ORIGIN_LABEL_LINE_SPACING, ORIGIN_LABEL_HORIZONTAL_GAP, LABEL_FINE_OFFSET
  - `debug/OriginMarkersDebugOverlay.ts` - ORIGIN_LABEL_LINE_SPACING, ORIGIN_LABEL_HORIZONTAL_GAP, LABEL_FINE_OFFSET
  - `systems/dynamic-input/hooks/useDynamicInputLayout.ts` - CURSOR_OFFSET_X, CURSOR_OFFSET_Y
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Eliminates ~10 magic numbers (6x `15` + 4x `5`)
  - Zero duplicate offset code between OriginMarkersRenderer & OriginMarkersDebugOverlay
  - Consistent positioning for origin markers and dynamic input
  - Easy global adjustment (e.g., for high-DPI displays)
  - Clear documentation of offset purposes
- **Companion**: ADR-091 (Text Label Offsets), ADR-139 (Label Box Dimensions)
