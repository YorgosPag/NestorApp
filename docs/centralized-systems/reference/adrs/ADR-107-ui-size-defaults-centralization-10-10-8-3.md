# ADR-107: UI Size Defaults Centralization (|| 10 / ?? 10 / || 8 / || 3)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Design System |
| **Canonical Location** | `UI_SIZE_DEFAULTS` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `UI_SIZE_DEFAULTS` from `config/text-rendering-config.ts`
- **Decision**: Centralize hardcoded `|| 10` / `?? 10` / `|| 8` / `|| 3` fallback patterns to named constants
- **Problem**: ~30 hardcoded fallback patterns across 7 files:
  - `systems/rulers-grid/utils.ts`: 9 occurrences (fontSize, unitsFontSize)
  - `canvas-v2/layer-canvas/LayerRenderer.ts`: 7 occurrences (fontSize, unitsFontSize, majorTickLength)
  - `hooks/useGripPreviewStyle.ts`: 3 occurrences (apertureSize, gripSize, pickBoxSize)
  - `systems/zoom/utils/bounds.ts`: 2 occurrences (text height fallback)
  - `rendering/grips/UnifiedGripRenderer.ts`: 2 occurrences (gripSize)
  - `ui/components/dxf-settings/settings/core/GripSettings.tsx`: 6 occurrences (gripSize, pickBoxSize)
- **Semantic Categories**:
  - `RULER_FONT_SIZE`: 10 - Default ruler number font size (px)
  - `RULER_UNITS_FONT_SIZE`: 10 - Default ruler units label font size (px)
  - `MAJOR_TICK_LENGTH`: 10 - Default major tick mark length (px)
  - `APERTURE_SIZE`: 10 - Grip selection aperture size (px, AutoCAD APERTURE)
  - `GRIP_SIZE`: 8 - Default grip point size (px, AutoCAD GRIPSIZE)
  - `PICK_BOX_SIZE`: 3 - Default pick box size (px, AutoCAD PICKBOX)
  - `TEXT_HEIGHT_FALLBACK`: 10 - Default text height for bounds calculation (drawing units)
- **API**:
  ```typescript
  export const UI_SIZE_DEFAULTS = {
    RULER_FONT_SIZE: 10,
    RULER_UNITS_FONT_SIZE: 10,
    MAJOR_TICK_LENGTH: 10,
    APERTURE_SIZE: 10,
    GRIP_SIZE: 8,
    PICK_BOX_SIZE: 3,
    TEXT_HEIGHT_FALLBACK: 10,
  } as const;
  ```
- **Industry Standard**: AutoCAD DIMSCALE / APERTURE / GRIPSIZE / PICKBOX system variables
- **Files Migrated** (7 files, 29 replacements):
  - `systems/rulers-grid/utils.ts` - 9 replacements
  - `canvas-v2/layer-canvas/LayerRenderer.ts` - 7 replacements
  - `hooks/useGripPreviewStyle.ts` - 3 replacements (apertureSize, gripSize, pickBoxSize)
  - `systems/zoom/utils/bounds.ts` - 2 replacements
  - `rendering/grips/UnifiedGripRenderer.ts` - 2 replacements (gripSize)
  - `ui/components/dxf-settings/settings/core/GripSettings.tsx` - 6 replacements (gripSize, pickBoxSize)
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero magic numbers `10` and `8` for UI defaults
  - Semantic constant names (`GRIP_SIZE` vs `8`, `RULER_FONT_SIZE` vs `10`)
  - Single point of change for default sizes
  - Consistent fallback behavior across all UI systems
- **Companion**: ADR-042 (UI Fonts), ADR-044 (Canvas Line Widths), ADR-093 (Text Label Offsets)

---
