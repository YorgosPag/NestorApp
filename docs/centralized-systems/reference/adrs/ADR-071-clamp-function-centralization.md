# ADR-071: Clamp Function Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Data & State |
| **Canonical Location** | `clamp()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `clamp()`, `clamp01()`, `clamp255()` from `geometry-utils.ts`
- **Impact**: 40+ inline `Math.max(min, Math.min(max, value))` implementations → 3 functions
- **Files Migrated (Phase 1 - Core)**:
  - `geometry-utils.ts` - Canonical source (added `clamp01()`, `clamp255()`)
  - `domain.ts` - Removed local clamp const, uses import
  - `calculations.ts` - `clampScale()` now uses centralized clamp
  - `pdf.types.ts` - `clampPageNumber()`, `clampOpacity()`, `clampScale()` use centralized
- **Files Migrated (Phase 2 - High-Impact)**:
  - `FitToViewService.ts` - safePadding and scale calculations (4 patterns)
  - `gripSettings.ts` - validateGripSettings (5 patterns)
  - `GridSpatialIndex.ts` - Grid cell clamping (5 patterns)
  - `useColorMenuState.ts` - Coordinate validation (2 patterns)
  - `DxfViewerComponents.styles.ts` - Progress bar (2 patterns)
  - `transform-config.ts` - validateScale, validateOffset
  - `SpatialUtils.ts` - calculateOptimalGridSize
  - `HitTester.ts` - closestPointOnLine param
  - `input-validation.ts` - normalizeNumericInput
  - `GripSizeCalculator.ts` - clampSize
  - `ui/color/utils.ts` - RGB value clamping (uses clamp255)
- **Pattern**: Single Source of Truth (SSOT)
- **API**:
  - `clamp(value, min, max)`: Generic clamping
  - `clamp01(value)`: [0, 1] range (opacity, alpha)
  - `clamp255(value)`: [0, 255] range (RGB)
- **Benefits**:
  - Zero duplicate clamp implementations
  - Semantic wrappers for common use cases
  - Consistent, tested clamping behavior
  - Type-safe number parameters
- **Companion**: ADR-065 (Distance), ADR-066 (Angle), ADR-067 (Deg↔Rad), ADR-070 (Magnitude)
