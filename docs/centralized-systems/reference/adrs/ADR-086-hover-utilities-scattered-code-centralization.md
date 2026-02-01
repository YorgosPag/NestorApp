# ADR-086: Hover Utilities Scattered Code Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Decision**: Replace inline calculations/formatting in hover utilities with centralized functions
- **Problem**: 3 hover utility files had inline code instead of using existing centralized functions:
  - `text-labeling-utils.ts`: Inline `Math.sqrt(Math.pow(...))` instead of `calculateDistance()`
  - `angle-utils.ts`: Inline `` `${degrees.toFixed(1)}°` `` instead of `formatAngle()`
  - `text-spline-renderers.ts`: Hardcoded `'14px Arial'` + inline angle format
- **Solution**: Replace with calls to existing enterprise functions:
  - `calculateDistance()` from `geometry-rendering-utils.ts` (ADR-065)
  - `formatAngle()` from `distance-label-utils.ts` (ADR-069)
  - `UI_FONTS.ARIAL.LARGE` from `text-rendering-config.ts` (ADR-042)
- **Files Changed**:
  - `utils/hover/text-labeling-utils.ts` - Use `calculateDistance()` (already imported!)
  - `utils/hover/angle-utils.ts` - Import & use `formatAngle()`
  - `utils/hover/text-spline-renderers.ts` - Import & use `UI_FONTS.ARIAL.LARGE` + `formatAngle()`
- **Lines Changed**: ~6 removed, ~5 added (imports + function calls)
- **Pattern**: DRY (Don't Repeat Yourself) + SSOT (Single Source of Truth)
- **Benefits**:
  - Zero duplicate distance calculation formulas
  - Consistent angle formatting across all hover utilities
  - Centralized font definitions (one place to change)
- **Companion**: ADR-042 (UI Fonts), ADR-065 (Distance Calculation), ADR-069 (formatAngle)

---
