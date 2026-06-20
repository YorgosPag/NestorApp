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
  - `GRIP_SIZE`: `GRIP_SIZE_DEFAULT` (7) - Default grip point size (px, AutoCAD GRIPSIZE). Since 2026-06-20 references the SSoT leaf `config/grip-size-default.ts` (see Changelog).
  - `PICK_BOX_SIZE`: 3 - Default pick box size (px, AutoCAD PICKBOX)
  - `TEXT_HEIGHT_FALLBACK`: 10 - Default text height for bounds calculation (drawing units)
- **API**:
  ```typescript
  export const UI_SIZE_DEFAULTS = {
    RULER_FONT_SIZE: 10,
    RULER_UNITS_FONT_SIZE: 10,
    MAJOR_TICK_LENGTH: 10,
    APERTURE_SIZE: 10,
    GRIP_SIZE: GRIP_SIZE_DEFAULT, // 🏢 7 — SSoT leaf config/grip-size-default.ts
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

## Changelog

### 2026-06-20 — Grip base size unified to ONE SSoT leaf (`GRIP_SIZE_DEFAULT = 7`)

**Problem (Giorgio): selection grips rendered "sometimes big, sometimes small" at the same zoom.**

Real root cause (grep audit, not the override path): the base grip pixel size was
declared in **~6 places that disagreed** — split between **14**, **7** and **5**:

| Source | Old value |
|--------|-----------|
| `config/text-rendering-config.ts` `UI_SIZE_DEFAULTS.GRIP_SIZE` | 14 |
| `types/gripSettings.ts` `DEFAULT_GRIP_SETTINGS` | 14 |
| `stores/GripStyleStore.ts` module default | 14 |
| `settings/FACTORY_DEFAULTS.ts` `GRIP_DEFAULTS` (initial state) | 14 (+ `size: 14`) |
| `settings-core/defaults.ts` `DEFAULT_GRIP_SETTINGS` | 7 |
| `settings-core/types/domain.ts` `validateGripSettings` defaults | 7 |
| `settings-core/types/domain.ts` `validateGripSize(undefined)` (effective default) | **5** |
| `ui/hooks/useUnifiedSpecificSettings.ts` mock fallback | 5 |

Three independent sync writers (`GripProvider` effect, `StyleManagerProvider.syncGripStore`,
`gripStyleAdapter`) push `getEffectiveGripSettings()` into `gripStyleStore`; whichever
default/validation path won at a given lifecycle moment determined the size → 7↔14↔5 flicker.
Grips are screen-constant (zoom-independent), which matched Giorgio's observation that the
variation was **not** zoom-related.

**Decision (Giorgio):** unify the base to **7** (AutoCAD GRIPSIZE).

**Fix (FULL SSoT):**
- **NEW** `config/grip-size-default.ts` — a dedicated **zero-import leaf** exporting
  `GRIP_SIZE_DEFAULT = 7`. A leaf (no deps) is the only cycle-proof home: the value is needed
  by both the very low-level `validation-bounds-config → geometry-utils` chain and higher-level
  settings, so hosting it in any module with its own imports causes a circular import
  (verified: hosting in `validation-bounds-config` produced a `geometry-utils → entity-bounds →
  text-rendering-config → validation-bounds-config` cycle).
- All 8 selection/general base-default surfaces above now **import** `GRIP_SIZE_DEFAULT`
  (incl. `validateGripSize` default `5 → 7` and `UI_SIZE_DEFAULTS.GRIP_SIZE`).
- **Preview-DRAW grips** (`PREVIEW_DEFAULTS` / `DEFAULT_PREVIEW_OPTIONS` = 6) are a **separate,
  internally-consistent domain** and intentionally NOT bound to this constant.
- **Dead-code removal (ADR-048 path):** the `draftGripSettingsStore` override machinery in
  `hooks/useGripPreviewStyle.ts` (`updateDraftGripSettingsStore` /
  `getGripPreviewStyleWithOverride`) was **never wired** (no caller anywhere) → removed;
  `GripPhaseRenderer` now reads `getGripPreviewStyle()` directly.
- **Tests:** NEW `config/__tests__/grip-size-default-ssot.test.ts` (regression guard — every
  default surface must equal `GRIP_SIZE_DEFAULT`); updated `settings-core` validation test
  expectation `5 → 7`.

**NOT touched:** `GripSizeCalculator` math + temperature multipliers (by-design hover/active
growth), preview-draw grips, `bim/structural/*`, `codes/*` (shared tree, other agent).

---
